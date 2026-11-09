import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inc, intentInvoke, relay } from '@napplet/sdk';
import { addToPool, runRelayAction } from './relay-actions';

vi.mock('@napplet/sdk', () => ({
  inc: { emit: vi.fn() },
  intentInvoke: vi.fn(),
  relay: {
    publish: vi.fn(),
    subscribe: vi.fn(),
    query: vi.fn(),
  },
}));

describe('relay action INC requests', () => {
  it('requests a relay-pool addition with the shell handler payload shape', () => {
    addToPool('wss://relay.example');

    expect(inc.emit).toHaveBeenCalledWith('shell:relay-add', {
      tier: 'discovery',
      url: 'wss://relay.example',
    });
  });

});

describe('relay feed and actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(intentInvoke).mockResolvedValue({ ok: true } as never);
    vi.mocked(relay.subscribe).mockImplementation(((_filter: unknown, _onEvent: unknown, onEose: () => void) => {
      queueMicrotask(onEose);
      return { close: vi.fn() };
    }) as never);
  });

  it('opens a feed pinned to the relay through the feed intent, not a dev URL', async () => {
    const outcome = await runRelayAction('feed', 'wss://relay.example', 'Example', async () => null);
    expect(outcome.ok).toBe(true);
    const [convention, options] = vi.mocked(intentInvoke).mock.calls[0]!;
    expect(convention).toContain('feed');
    expect((options as { payload: unknown }).payload).toEqual({
      filters: [{ kinds: [1] }],
      origin: 'relay',
      relays: ['wss://relay.example'],
      title: 'Example',
    });
    expect(inc.emit).not.toHaveBeenCalled();
  });

  it('reports when no feed app can take the intent', async () => {
    vi.mocked(intentInvoke).mockResolvedValue({ ok: false, error: 'No handler' } as never);
    const outcome = await runRelayAction('feed', 'wss://relay.example', 'Example', async () => null);
    expect(outcome).toEqual({ ok: false, message: "That didn't go through: No handler" });
  });

  it('publishes a kind 10002 r tag, keeping existing entries', async () => {
    vi.mocked(relay.subscribe).mockImplementation(((_filter: unknown, onEvent: (result: unknown) => void, onEose: () => void) => {
      onEvent({ event: { tags: [['r', 'wss://kept.example', 'write'], ['alt', 'dropped']] } });
      queueMicrotask(onEose);
      return { close: vi.fn() };
    }) as never);
    vi.mocked(relay.publish).mockResolvedValue({} as never);
    const outcome = await runRelayAction('relay-list-read', 'wss://relay.example', 'Example', async () => 'a'.repeat(64));
    expect(outcome.ok).toBe(true);
    expect(vi.mocked(relay.publish).mock.calls[0]![0]).toMatchObject({
      kind: 10002,
      tags: [['r', 'wss://kept.example', 'write'], ['r', 'wss://relay.example', 'read']],
    });
  });

  it('says why a publish failed, and asks to sign in when there is no key', async () => {
    vi.mocked(relay.publish).mockRejectedValue(new Error('rate-limited'));
    expect(await runRelayAction('block', 'wss://relay.example', 'Example', async () => 'a'.repeat(64)))
      .toEqual({ ok: false, message: "That didn't go through: rate-limited" });
    vi.mocked(relay.publish).mockRejectedValue(new Error('Cant sign events with readonly'));
    expect((await runRelayAction('block', 'wss://relay.example', 'Example', async () => 'a'.repeat(64))).message)
      .toContain('This account is read-only');
    expect(await runRelayAction('block', 'wss://relay.example', 'Example', async () => null))
      .toEqual({ ok: false, message: 'Sign in to change your relay lists.' });
  });
});
