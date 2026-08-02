import { describe, expect, it, vi } from 'vitest';
import { inc } from '@napplet/sdk';
import { addToPool, openRelayFeed } from './relay-actions';

vi.mock('@napplet/sdk', () => ({
  inc: { emit: vi.fn() },
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

  it('requests a filtered feed window through one canonical INC payload', () => {
    openRelayFeed('wss://relay.example', 'https://hyprgate.example/feed?relay=wss%3A%2F%2Frelay.example');

    expect(inc.emit).toHaveBeenCalledWith('shell:create-window', {
      title: 'Feed: wss://relay.example',
      class: 'feed',
      iframeSrc: 'https://hyprgate.example/feed?relay=wss%3A%2F%2Frelay.example',
    });
  });
});
