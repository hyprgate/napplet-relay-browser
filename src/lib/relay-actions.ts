// napplets/relay-browser/src/lib/relay-actions.ts
// Action functions for relay operations — NIP-65, NIP-51, shell pool.
// All write operations use relay.publish with merge-before-publish (Pitfall 4).

import { relay, inc } from '@napplet/sdk';
import { createFeedIntentRequest, createProfileIntentRequest, invokeNappletIntent } from '@hyprgate/utils';
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
 * Uses the shell:relay-add INC topic handled by shell-admin-channels.ts.
 */
export function addToPool(relayUrl: string): void {
  inc.emit('shell:relay-add', { tier: 'discovery', url: relayUrl });
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

/** Open the feed pinned to one relay, through the same intent saved feeds use. */
export async function openRelayFeed(relayUrl: string, title: string): Promise<void> {
  const request = createFeedIntentRequest({
    filters: [{ kinds: [1] }],
    origin: 'relay',
    relays: [relayUrl],
    title,
  }, { behavior: { focus: true } });
  if (!request) throw new Error('Could not open a feed for this relay');
  const result = await invokeNappletIntent(request);
  if (!result.ok) throw new Error(result.error ?? 'No feed app is available');
}

export async function openOperatorProfile(pubkey: string): Promise<void> {
  const request = createProfileIntentRequest({ pubkey }, { behavior: { focus: true, reuse: true } });
  if (request) await invokeNappletIntent(request);
}

export type RelayAction =
  | 'add-to-pool'
  | 'relay-list-read'
  | 'relay-list-write'
  | 'relay-list-both'
  | 'feed'
  | 'block';

export interface ActionOutcome {
  ok: boolean;
  message: string;
}

/** Every action ends in a message: these publish lists, so silence reads as success. */
export async function runRelayAction(
  action: RelayAction,
  relayUrl: string,
  name: string,
  getPubkey: () => Promise<string | null>,
): Promise<ActionOutcome> {
  try {
    if (action === 'add-to-pool') {
      addToPool(relayUrl);
      return { ok: true, message: `Asked Hyprgate to use ${name} for discovery.` };
    }
    if (action === 'feed') {
      await openRelayFeed(relayUrl, name);
      return { ok: true, message: `Opened a feed from ${name}.` };
    }
    const pubkey = await getPubkey();
    if (!pubkey) return { ok: false, message: 'Sign in to change your relay lists.' };
    if (action === 'block') {
      await blockRelay(relayUrl, pubkey);
      return { ok: true, message: `Blocked ${name}.` };
    }
    const marker = action === 'relay-list-read' ? 'read' : action === 'relay-list-write' ? 'write' : 'both';
    await addToRelayList(relayUrl, marker, pubkey);
    return { ok: true, message: `Added ${name} to your relay list.` };
  } catch (cause) {
    return { ok: false, message: describeFailure(cause) };
  }
}

export function describeFailure(cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : '';
  if (/read-?only/i.test(detail)) {
    return 'This account is read-only. Sign in with a browser extension or remote signer to change your relay lists.';
  }
  return detail ? `That didn't go through: ${detail}` : "That didn't go through.";
}
