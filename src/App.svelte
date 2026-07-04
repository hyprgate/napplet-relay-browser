<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { relay, identity } from '@napplet/sdk';
  import { relayStore, parseRelayDiscoveryEvent } from './lib/relay-store.js';
  import { addToPool, addToRelayList, blockRelay, addToNamedList, openRelayFeed } from './lib/relay-actions.js';
  import RelayTable from './components/RelayTable.svelte';
  import RelayContextMenu from './components/RelayContextMenu.svelte';
  import type { RelayDiscovery, SortField } from './lib/relay-store.js';
  import type { Subscription } from '@napplet/sdk';

  // Version counter pattern for store reactivity
  let version = $state(0);
  function notifyUpdate() { version++; }

  let relays = $derived.by(() => { version; return relayStore.getRelays(); });
  let loading = $derived.by(() => { version; return relayStore.isLoading(); });
  let sortField = $derived.by(() => { version; return relayStore.getSortField(); });
  let sortDirection = $derived.by(() => { version; return relayStore.getSortDirection(); });

  let expandedUrl = $state<string | null>(null);
  let contextMenu = $state<{ relay: RelayDiscovery; x: number; y: number } | null>(null);
  let search = $state('');

  let filteredRelays = $derived.by(() => {
    if (!search) return relays;
    const q = search.toLowerCase();
    return relays.filter(r => r.url.toLowerCase().includes(q));
  });

  let sub: Subscription | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const RELAY_DISCOVERY_LIMIT = 1000;

  function handleSort(field: SortField) {
    const currentField = relayStore.getSortField();
    const currentDir = relayStore.getSortDirection();
    if (field === currentField) {
      relayStore.setSort(field, currentDir === 'asc' ? 'desc' : 'asc');
    } else {
      relayStore.setSort(field, 'asc');
    }
    notifyUpdate();
  }

  function toggleExpand(url: string) {
    expandedUrl = expandedUrl === url ? null : url;
  }

  function showContextMenu(relay: RelayDiscovery, event: MouseEvent) {
    event.preventDefault();
    contextMenu = { relay, x: event.clientX, y: event.clientY };
  }

  async function handleAction(action: string, relayEntry: RelayDiscovery) {
    contextMenu = null;
    const pubkey = await identity.getPublicKey().catch(() => null);

    switch (action) {
      case 'add-to-pool':
        addToPool(relayEntry.url);
        break;
      case 'relay-list-read':
        if (pubkey) await addToRelayList(relayEntry.url, 'read', pubkey);
        break;
      case 'relay-list-write':
        if (pubkey) await addToRelayList(relayEntry.url, 'write', pubkey);
        break;
      case 'relay-list-both':
        if (pubkey) await addToRelayList(relayEntry.url, 'both', pubkey);
        break;
      case 'feed':
        openRelayFeed(relayEntry.url, `http://localhost:5175?relay=${encodeURIComponent(relayEntry.url)}`);
        break;
      case 'block':
        if (pubkey) await blockRelay(relayEntry.url, pubkey);
        break;
      case 'named-list': {
        const setName = prompt('Set name:');
        if (setName && pubkey) await addToNamedList(relayEntry.url, setName, setName, pubkey);
        break;
      }
    }
  }

  onMount(async () => {
    // Pitfall 7: Query OPFS cache first, then subscribe for live updates
    try {
      const cached = await relay.query({ kinds: [30166], limit: RELAY_DISCOVERY_LIMIT });
      for (const event of cached) {
        const r = parseRelayDiscoveryEvent(event);
        if (r) relayStore.addRelay(r);
      }
    } catch {
      // OPFS cache may not be available — continue with live subscription
    }
    relayStore.setLoading(false);
    notifyUpdate();

    // Also subscribe for live NIP-66 events (new relays discovered after initial load)
    sub = relay.subscribe(
      { kinds: [30166], limit: RELAY_DISCOVERY_LIMIT },
      (result) => {
        const event = result.event as NostrEvent;
        const r = parseRelayDiscoveryEvent(event);
        if (r) { relayStore.addRelay(r); notifyUpdate(); }
      },
      () => {
        // EOSE — initial subscription complete
      },
    );

    pollInterval = setInterval(notifyUpdate, 500);
  });

  onDestroy(() => {
    sub?.close();
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<div class="h-full bg-bg-base flex flex-col overflow-hidden">
  <div class="p-3 border-b border-border-dim">
    <input
      type="text"
      placeholder="Filter by relay URL..."
      bind:value={search}
      class="w-full bg-bg-surface border border-border-dim rounded px-3 py-1.5 text-sm text-text-primary placeholder-text-dim focus:outline-none focus:border-accent-green"
    />
  </div>

  <div class="flex-1 overflow-auto">
    {#if loading && filteredRelays.length === 0}
      <div class="p-4 text-text-muted text-sm">Loading relays...</div>
    {:else if !loading && filteredRelays.length === 0}
      <div class="p-4 text-text-muted text-sm">No relays found. The relay monitor may not have cached data yet.</div>
    {:else}
      <RelayTable
        relays={filteredRelays}
        {sortField}
        {sortDirection}
        {expandedUrl}
        onsort={handleSort}
        ontoggleexpand={toggleExpand}
        oncontextmenu={showContextMenu}
      />
    {/if}
  </div>

  {#if contextMenu}
    <RelayContextMenu
      relay={contextMenu.relay}
      visible={true}
      x={contextMenu.x}
      y={contextMenu.y}
      onaction={handleAction}
      onclose={() => contextMenu = null}
    />
  {/if}
</div>
