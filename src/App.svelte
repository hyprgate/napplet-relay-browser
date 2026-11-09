<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { relay, identity } from '@napplet/sdk';
  import { relayStore, parseRelayDiscoveryEvent, relayMatches, relayName } from './lib/relay-store.js';
  import { addToNamedList, describeFailure, runRelayAction, type ActionOutcome, type RelayAction } from './lib/relay-actions.js';
  import RelayTable from './components/RelayTable.svelte';
  import RelayContextMenu from './components/RelayContextMenu.svelte';
  import type { RelayDiscovery, SortField } from './lib/relay-store.js';
  import type { Subscription } from '@napplet/sdk';
  import type { NostrEvent } from '@hyprgate/types';

  // Version counter pattern for store reactivity
  let version = $state(0);
  function notifyUpdate() { version++; }

  let relays = $derived.by(() => { version; return relayStore.getRelays(); });
  let loading = $derived.by(() => { version; return relayStore.isLoading(); });
  let sortField = $derived.by(() => { version; return relayStore.getSortField(); });
  let sortDirection = $derived.by(() => { version; return relayStore.getSortDirection(); });

  let expandedUrl = $state<string | null>(null);
  let contextMenu = $state<{ relay: RelayDiscovery; x: number; y: number; trigger: HTMLElement | null } | null>(null);
  let search = $state('');
  let notice = $state<ActionOutcome | null>(null);
  let setDialogRelay = $state<RelayDiscovery | null>(null);
  let setName = $state('');
  let returnFocusTo: HTMLElement | null = null;

  let filteredRelays = $derived(relays.filter((entry) => relayMatches(entry, search)));

  let sub: Subscription | null = null;
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
    // A keyboard-activated click reports 0,0, so anchor to the button when there is one.
    const trigger = event.currentTarget instanceof HTMLElement && event.currentTarget.tagName === 'BUTTON'
      ? event.currentTarget
      : null;
    const rect = trigger?.getBoundingClientRect();
    contextMenu = {
      relay,
      x: rect ? rect.left : event.clientX,
      y: rect ? rect.bottom + 2 : event.clientY,
      trigger,
    };
  }

  function closeMenu() {
    const trigger = contextMenu?.trigger;
    contextMenu = null;
    trigger?.focus();
  }

  async function handleAction(action: string, relayEntry: RelayDiscovery) {
    returnFocusTo = contextMenu?.trigger ?? null;
    contextMenu = null;
    if (action === 'named-list') {
      setName = '';
      setDialogRelay = relayEntry;
      return;
    }
    returnFocusTo?.focus();
    notice = await runRelayAction(action as RelayAction, relayEntry.url, relayName(relayEntry), getPubkey);
  }

  function getPubkey(): Promise<string | null> {
    return identity.getPublicKey().catch(() => null);
  }

  function closeSetDialog() {
    setDialogRelay = null;
    returnFocusTo?.focus();
  }

  async function addToSet() {
    const entry = setDialogRelay;
    const name = setName.trim();
    if (!entry || !name) return;
    closeSetDialog();
    try {
      const pubkey = await getPubkey();
      if (!pubkey) {
        notice = { ok: false, message: 'Sign in to change your relay lists.' };
        return;
      }
      await addToNamedList(entry.url, name, name, pubkey);
      notice = { ok: true, message: `Added ${relayName(entry)} to ${name}.` };
    } catch (cause) {
      notice = { ok: false, message: describeFailure(cause) };
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
  });

  onDestroy(() => {
    sub?.close();
  });
</script>

<div class="h-full bg-bg-base flex flex-col overflow-hidden">
  <div class="p-3 border-b border-border-dim flex items-center gap-3">
    <input
      type="text"
      aria-label="Filter relays"
      placeholder="Filter by name, address or topic"
      bind:value={search}
      data-testid="relay-filter"
      class="filter-input flex-1 min-w-0 bg-bg-surface border border-border-dim rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-green"
    />
    <span class="text-xs text-text-muted whitespace-nowrap" role="status" data-testid="relay-count">
      {#if search.trim()}{filteredRelays.length} of {relays.length}{:else}{relays.length} {relays.length === 1 ? 'relay' : 'relays'}{/if}
    </span>
  </div>

  {#if notice}
    <div
      class="px-3 py-2 border-b border-border-dim text-sm flex items-center justify-between gap-3 {notice.ok ? 'text-text-primary bg-bg-surface' : 'text-accent-red bg-bg-surface'}"
      role={notice.ok ? 'status' : 'alert'}
      data-testid="relay-notice"
    >
      <span>{notice.message}</span>
      <button type="button" class="text-text-muted hover:text-text-primary px-1" aria-label="Dismiss message" onclick={() => notice = null}>&times;</button>
    </div>
  {/if}

  <div class="flex-1 overflow-auto">
    {#if loading && relays.length === 0}
      <div class="p-4 text-text-muted text-sm" role="status">Loading relays…</div>
    {:else if relays.length === 0}
      <div class="p-6 text-center" data-testid="relay-empty">
        <p class="text-text-primary text-sm font-semibold">No relay data yet</p>
        <p class="text-text-muted text-sm mt-1">Relay listings come from monitors publishing to the relays you're connected to. None have turned up so far.</p>
      </div>
    {:else if filteredRelays.length === 0}
      <div class="p-6 text-center" data-testid="relay-no-match">
        <p class="text-text-primary text-sm font-semibold">Nothing matches “{search.trim()}”</p>
        <p class="text-text-muted text-sm mt-1 mb-3">Filters look at names, addresses, descriptions and topics.</p>
        <button type="button" class="px-3 py-1 text-sm border border-border-dim rounded text-text-primary hover:bg-bg-surface" onclick={() => search = ''}>Clear filter</button>
      </div>
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
      onclose={closeMenu}
    />
  {/if}

  {#if setDialogRelay}
    <!-- prompt() returns null under the allow-scripts sandbox, so this is inline. -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 dialog-scrim">
      <div class="bg-bg-surface border border-border-dim rounded-lg p-4 w-full max-w-sm" role="dialog" aria-modal="true" aria-labelledby="relay-set-title" data-testid="relay-set-dialog">
        <h2 id="relay-set-title" class="text-sm font-semibold text-text-primary">Add {relayName(setDialogRelay)} to a relay set</h2>
        <label class="block text-xs text-text-muted mt-3 mb-1" for="relay-set-name">Set name</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          id="relay-set-name"
          autofocus
          bind:value={setName}
          onkeydown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); void addToSet(); }
            if (event.key === 'Escape') { event.preventDefault(); closeSetDialog(); }
          }}
          class="filter-input w-full bg-bg-base border border-border-dim rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-green"
          placeholder="For example: favourites"
          data-testid="relay-set-name"
        />
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="px-3 py-1 text-sm rounded border border-border-dim text-text-primary hover:bg-bg-elevated" onclick={closeSetDialog}>Cancel</button>
          <button type="button" class="px-3 py-1 text-sm rounded border border-border-dim text-text-primary hover:bg-bg-elevated disabled:opacity-50" disabled={!setName.trim()} onclick={() => { void addToSet(); }} data-testid="relay-set-add">Add</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-input::placeholder { color: var(--hg-text-muted); opacity: .75; }
  .dialog-scrim { background: color-mix(in srgb, var(--hg-bg-base) 70%, transparent); }
</style>
