// napplets/relay-browser/src/lib/relay-store.ts
// NIP-66 relay discovery state — pure TypeScript, no Svelte runes.
// Hand-parses NIP-66 tags (~50 LOC) per research decision (no @nostrwatch/route66).

import type { NostrEvent } from '@hyprgate/types';

export interface RelayDiscovery {
  url: string;              // d-tag
  nips: number[];           // N tags
  rttOpen: number | null;   // rtt-open tag (ms)
  rttRead: number | null;   // rtt-read tag (ms)
  rttWrite: number | null;  // rtt-write tag (ms)
  networkType: string;      // n tag (clearnet/tor/i2p)
  relayType: string | null; // T tag
  requiresAuth: boolean;    // R tag contains "auth"
  requiresPayment: boolean; // R tag contains "payment"
  requiresPow: boolean;     // R tag contains "pow"
  writesAllowed: boolean;   // R tag does not contain "!writes"
  topics: string[];         // t tags
  kinds: number[];          // k tags
  nip11: Record<string, unknown> | null; // JSON.parse(content)
}

export type SortField = 'url' | 'rttOpen' | 'nips' | 'networkType';
export type SortDirection = 'asc' | 'desc';

/**
 * Parse a NIP-66 kind 30166 relay discovery event.
 * Returns null if the d-tag (relay URL) is missing.
 */
export function parseRelayDiscoveryEvent(event: NostrEvent): RelayDiscovery | null {
  const dTag = event.tags.find(t => t[0] === 'd');
  const url = dTag?.[1];
  if (!url) return null;

  const getTag = (key: string) => event.tags.find(t => t[0] === key)?.[1];
  const getAllTags = (key: string) => event.tags
    .filter(t => t[0] === key)
    .map(t => t[1])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const rTagValues = getAllTags('R');

  let nip11: Record<string, unknown> | null = null;
  try { nip11 = event.content ? JSON.parse(event.content) : null; } catch { /* ignore */ }

  return {
    url,
    nips: getAllTags('N').map(Number).filter(n => !isNaN(n)),
    rttOpen: getTag('rtt-open') ? parseInt(getTag('rtt-open')!, 10) : null,
    rttRead: getTag('rtt-read') ? parseInt(getTag('rtt-read')!, 10) : null,
    rttWrite: getTag('rtt-write') ? parseInt(getTag('rtt-write')!, 10) : null,
    networkType: getTag('n') ?? 'clearnet',
    relayType: getTag('T') ?? null,
    requiresAuth: rTagValues.includes('auth'),
    requiresPayment: rTagValues.includes('payment'),
    requiresPow: rTagValues.includes('pow'),
    writesAllowed: !rTagValues.includes('!writes'),
    topics: getAllTags('t'),
    kinds: getAllTags('k').map(Number).filter(n => !isNaN(n)),
    nip11,
  };
}

const relays = new Map<string, RelayDiscovery>();
let loading = true;
let sortField: SortField = 'url';
let sortDirection: SortDirection = 'asc';

function sortRelays(items: RelayDiscovery[]): RelayDiscovery[] {
  return [...items].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'url': return dir * a.url.localeCompare(b.url);
      case 'rttOpen': {
        if (a.rttOpen === null && b.rttOpen === null) return 0;
        if (a.rttOpen === null) return 1;
        if (b.rttOpen === null) return -1;
        return dir * (a.rttOpen - b.rttOpen);
      }
      case 'nips': return dir * (a.nips.length - b.nips.length);
      case 'networkType': return dir * a.networkType.localeCompare(b.networkType);
      default: return 0;
    }
  });
}

export const relayStore = {
  addRelay(relay: RelayDiscovery): void {
    relays.set(relay.url, relay);
  },
  getRelays(): RelayDiscovery[] {
    return sortRelays(Array.from(relays.values()));
  },
  getRelay(url: string): RelayDiscovery | undefined {
    return relays.get(url);
  },
  isLoading(): boolean {
    return loading;
  },
  setLoading(v: boolean): void {
    loading = v;
  },
  getSortField(): SortField {
    return sortField;
  },
  getSortDirection(): SortDirection {
    return sortDirection;
  },
  setSort(field: SortField, direction: SortDirection): void {
    sortField = field;
    sortDirection = direction;
  },
};
