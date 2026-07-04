// napplets/relay-browser/src/lib/relay-actions.ts
// Action functions for relay operations — NIP-65, NIP-51, shell pool.
// All write operations use relay.publish with merge-before-publish (Pitfall 4).

import { relay, inc as ipc } from '@napplet/sdk';
import type { NostrEvent, NostrFilter } from '@hyprgate/types';

/** Subscribe, collect events, resolve on EOSE. */
function collectOnEose(filters: NostrFilter | NostrFilter[]): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const sub = relay.subscribe(filters, (result) => events.push(result.event as NostrEvent), () => { sub.close(); resolve(events); });
  });
}

/**
 * Add relay to shell's shared pool (RELAY-03).
 * Uses shell:relay-add ipc channel — shell-admin-channels.ts (plan 09-03) handles it.
 */
export function addToPool(relayUrl: string): void {
  ipc.emit('shell:relay-add', [
    ['tier', 'discovery'],
    ['url', relayUrl],
  ]);
}

/**
 * Add relay to user's NIP-65 relay list (kind 10002).
 * Pitfall 4: MUST fetch existing list and merge — replaceable event overwrites entirely.
 * Note: we use relay.query (not identity.getRelays) because getRelays() returns a
 * normalized Record<string,{read,write}> map — we need the raw 'r' tags for merge.
 */
export async function addToRelayList(
  relayUrl: string,
  marker: 'read' | 'write' | 'both',
  pubkey: string,
): Promise<void> {
  // Pitfall 4: fetch kind-10002 via relay.query (not identity.getRelays — that returns a normalized map without raw tags; we need raw tags for merge).
  const existing = await collectOnEose({ kinds: [10002], authors: [pubkey], limit: 1 });
  const existingTags = existing[0]?.tags.filter(t => t[0] === 'r') ?? [];
  const newTag = marker === 'both' ? ['r', relayUrl] : ['r', relayUrl, marker];
  const mergedTags = [...existingTags.filter(t => t[1] !== relayUrl), newTag];

  await relay.publish({
    kind: 10002,
    content: '',
    tags: mergedTags,
    created_at: Math.floor(Date.now() / 1000),
  });
}

/**
 * Block relay via NIP-51 kind 10006.
 * Pitfall 4: MUST fetch existing list and merge.
 */
export async function blockRelay(relayUrl: string, pubkey: string): Promise<void> {
  const existing = await collectOnEose({ kinds: [10006], authors: [pubkey], limit: 1 });
  const existingTags = existing[0]?.tags.filter(t => t[0] === 'relay') ?? [];
  const mergedTags = [...existingTags.filter(t => t[1] !== relayUrl), ['relay', relayUrl]];

  await relay.publish({
    kind: 10006,
    content: '',
    tags: mergedTags,
    created_at: Math.floor(Date.now() / 1000),
  });
}

/**
 * Add relay to a named relay set via NIP-51 kind 30002 (NOT kind 30000).
 * Pitfall 4: MUST fetch existing list and merge.
 */
export async function addToNamedList(
  relayUrl: string,
  setName: string,
  setTitle: string,
  pubkey: string,
): Promise<void> {
  const existing = await collectOnEose({ kinds: [30002], authors: [pubkey], '#d': [setName], limit: 1 });
  const existingTags = existing[0]?.tags.filter(t => t[0] === 'relay') ?? [];
  const mergedTags = [
    ['d', setName],
    ['title', setTitle],
    ...existingTags.filter(t => t[1] !== relayUrl),
    ['relay', relayUrl],
  ];

  await relay.publish({
    kind: 30002,
    content: '',
    tags: mergedTags,
    created_at: Math.floor(Date.now() / 1000),
  });
}

/**
 * Open a feed window filtered to a specific relay.
 * Posts create-window command to shell parent via ipc.
 */
export function openRelayFeed(relayUrl: string, nappUrl: string): void {
  ipc.emit('shell:create-window', [], JSON.stringify({
    title: `Feed: ${relayUrl}`,
    class: 'feed',
    iframeSrc: nappUrl,
  }));
}
