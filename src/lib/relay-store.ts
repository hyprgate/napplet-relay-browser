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
  try {
    const parsed: unknown = event.content ? JSON.parse(event.content) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) nip11 = parsed as Record<string, unknown>;
  } catch { /* ignore */ }

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

function nip11Text(relay: RelayDiscovery, key: string): string | null {
  const value = relay.nip11?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** What the relay calls itself, falling back to its address without the scheme. */
export function relayName(relay: RelayDiscovery): string {
  return nip11Text(relay, 'name') ?? relay.url.replace(/^wss?:\/\//, '').replace(/\/$/, '');
}

export function relayDescription(relay: RelayDiscovery): string | null {
  return nip11Text(relay, 'description');
}

/** Operator pubkey, only when the self-reported value is really a key. */
export function relayOperator(relay: RelayDiscovery): string | null {
  const pubkey = nip11Text(relay, 'pubkey');
  return pubkey && /^[0-9a-f]{64}$/i.test(pubkey) ? pubkey.toLowerCase() : null;
}

export function relayMatches(relay: RelayDiscovery, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [relay.url, relayName(relay), relayDescription(relay) ?? '', ...relay.topics]
    .some((value) => value.toLowerCase().includes(needle));
}

export interface RelaySpeed {
  label: string;
  tone: 'fast' | 'ok' | 'slow' | 'unknown';
}

/** Words as well as colour, so speed never depends on telling red from green. */
export function relaySpeed(rtt: number | null): RelaySpeed {
  if (rtt === null) return { label: 'Not measured', tone: 'unknown' };
  if (rtt < 200) return { label: 'Fast', tone: 'fast' };
  if (rtt < 500) return { label: 'OK', tone: 'ok' };
  return { label: 'Slow', tone: 'slow' };
}

export function relayAccess(relay: RelayDiscovery): string {
  const needs = [
    relay.requiresAuth ? 'Sign-in' : null,
    relay.requiresPayment ? 'Paid' : null,
    relay.requiresPow ? 'Proof of work' : null,
  ].filter(Boolean);
  return needs.length > 0 ? needs.join(', ') : 'Open';
}

const NETWORK_LABELS: Record<string, string> = { tor: 'Tor', i2p: 'I2P', loki: 'Lokinet', hyper: 'Hyper' };

/** Clearnet is the assumed case, so only other networks get a label. */
export function relayNetworkLabel(relay: RelayDiscovery): string | null {
  return NETWORK_LABELS[relay.networkType] ?? (relay.networkType === 'clearnet' ? null : relay.networkType);
}

const relays = new Map<string, RelayDiscovery>();
let loading = true;
let sortField: SortField = 'url';
let sortDirection: SortDirection = 'asc';

function sortRelays(items: RelayDiscovery[]): RelayDiscovery[] {
  return [...items].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'url': return dir * (relayName(a).localeCompare(relayName(b)) || a.url.localeCompare(b.url));
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
