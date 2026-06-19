import { describe, it, expect, beforeEach } from 'vitest';
import { parseRelayDiscoveryEvent, relayStore } from './relay-store.js';
import type { NostrEvent } from '@hyprgate/types';

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'test-id',
    pubkey: 'test-pubkey',
    created_at: 1700000000,
    kind: 30166,
    tags: [
      ['d', 'wss://relay.example.com'],
      ['N', '1'],
      ['N', '2'],
      ['N', '11'],
      ['rtt-open', '150'],
      ['rtt-read', '80'],
      ['rtt-write', '120'],
      ['n', 'clearnet'],
      ['T', 'general'],
      ['R', 'auth'],
      ['t', 'social'],
      ['t', 'media'],
      ['k', '1'],
      ['k', '0'],
    ],
    content: JSON.stringify({ name: 'Example Relay', description: 'A test relay' }),
    sig: 'test-sig',
    ...overrides,
  };
}

describe('parseRelayDiscoveryEvent', () => {
  it('parses valid event with all tags', () => {
    const relay = parseRelayDiscoveryEvent(makeEvent());
    expect(relay).not.toBeNull();
    expect(relay!.url).toBe('wss://relay.example.com');
    expect(relay!.nips).toEqual([1, 2, 11]);
    expect(relay!.rttOpen).toBe(150);
    expect(relay!.rttRead).toBe(80);
    expect(relay!.rttWrite).toBe(120);
    expect(relay!.networkType).toBe('clearnet');
    expect(relay!.relayType).toBe('general');
    expect(relay!.requiresAuth).toBe(true);
    expect(relay!.requiresPayment).toBe(false);
    expect(relay!.requiresPow).toBe(false);
    expect(relay!.writesAllowed).toBe(true);
    expect(relay!.topics).toEqual(['social', 'media']);
    expect(relay!.kinds).toEqual([1, 0]);
    expect(relay!.nip11).toEqual({ name: 'Example Relay', description: 'A test relay' });
  });

  it('returns null when d-tag is missing', () => {
    const event = makeEvent({ tags: [['N', '1']] });
    expect(parseRelayDiscoveryEvent(event)).toBeNull();
  });

  it('extracts multiple N tags as nips array', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com'], ['N', '1'], ['N', '11'], ['N', '42']],
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.nips).toEqual([1, 11, 42]);
  });

  it('R tag "auth" sets requiresAuth true', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com'], ['R', 'auth']],
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.requiresAuth).toBe(true);
    expect(relay!.requiresPayment).toBe(false);
  });

  it('R tag "payment" sets requiresPayment true', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com'], ['R', 'payment']],
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.requiresPayment).toBe(true);
    expect(relay!.requiresAuth).toBe(false);
  });

  it('R tag "!writes" sets writesAllowed false', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com'], ['R', '!writes']],
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.writesAllowed).toBe(false);
  });

  it('no R tags: requiresAuth false, requiresPayment false, writesAllowed true', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com']],
      content: '',
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.requiresAuth).toBe(false);
    expect(relay!.requiresPayment).toBe(false);
    expect(relay!.writesAllowed).toBe(true);
  });

  it('parses nip11 from valid JSON content', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com']],
      content: JSON.stringify({ name: 'Test', software: 'strfry' }),
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.nip11).toEqual({ name: 'Test', software: 'strfry' });
  });

  it('empty content results in nip11 null', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com']],
      content: '',
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.nip11).toBeNull();
  });

  it('malformed JSON content results in nip11 null (no crash)', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com']],
      content: 'not valid json{{{',
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.nip11).toBeNull();
  });

  it('no rtt tags: rttOpen/rttRead/rttWrite are null', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com']],
      content: '',
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.rttOpen).toBeNull();
    expect(relay!.rttRead).toBeNull();
    expect(relay!.rttWrite).toBeNull();
  });

  it('defaults networkType to clearnet when n tag is absent', () => {
    const event = makeEvent({
      tags: [['d', 'wss://test.com']],
      content: '',
    });
    const relay = parseRelayDiscoveryEvent(event);
    expect(relay!.networkType).toBe('clearnet');
  });
});

describe('relayStore', () => {
  beforeEach(() => {
    relayStore.setLoading(true);
    relayStore.setSort('url', 'asc');
  });

  it('addRelay + getRelays returns sorted list', () => {
    relayStore.addRelay(parseRelayDiscoveryEvent(makeEvent({
      tags: [['d', 'wss://bravo.com']],
      content: '',
    }))!);
    relayStore.addRelay(parseRelayDiscoveryEvent(makeEvent({
      tags: [['d', 'wss://alpha.com']],
      content: '',
    }))!);

    const list = relayStore.getRelays();
    const alphaIdx = list.findIndex(r => r.url === 'wss://alpha.com');
    const bravoIdx = list.findIndex(r => r.url === 'wss://bravo.com');
    expect(alphaIdx).toBeLessThan(bravoIdx);
  });

  it('setSort changes sorting order', () => {
    relayStore.addRelay(parseRelayDiscoveryEvent(makeEvent({
      tags: [['d', 'wss://alpha.com']],
      content: '',
    }))!);
    relayStore.addRelay(parseRelayDiscoveryEvent(makeEvent({
      tags: [['d', 'wss://bravo.com']],
      content: '',
    }))!);

    relayStore.setSort('url', 'desc');
    const list = relayStore.getRelays();
    const bravoIdx = list.findIndex(r => r.url === 'wss://bravo.com');
    const alphaIdx = list.findIndex(r => r.url === 'wss://alpha.com');
    expect(bravoIdx).toBeLessThan(alphaIdx);
  });

  it('null RTT values sort last in rttOpen sort', () => {
    relayStore.addRelay(parseRelayDiscoveryEvent(makeEvent({
      tags: [['d', 'wss://no-rtt.com']],
      content: '',
    }))!);
    relayStore.addRelay(parseRelayDiscoveryEvent(makeEvent({
      tags: [['d', 'wss://has-rtt.com'], ['rtt-open', '100']],
      content: '',
    }))!);

    relayStore.setSort('rttOpen', 'asc');
    const list = relayStore.getRelays();
    const hasRttIdx = list.findIndex(r => r.url === 'wss://has-rtt.com');
    const noRttIdx = list.findIndex(r => r.url === 'wss://no-rtt.com');
    expect(hasRttIdx).toBeLessThan(noRttIdx);
  });
});
