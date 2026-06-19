<script lang="ts">
  import type { RelayDiscovery, SortField, SortDirection } from '../lib/relay-store.js';
  import RelayDetailRow from './RelayDetailRow.svelte';

  let { relays, sortField, sortDirection, expandedUrl, onsort, ontoggleexpand, oncontextmenu }: {
    relays: RelayDiscovery[];
    sortField: SortField;
    sortDirection: SortDirection;
    expandedUrl: string | null;
    onsort: (field: SortField) => void;
    ontoggleexpand: (url: string) => void;
    oncontextmenu: (relay: RelayDiscovery, event: MouseEvent) => void;
  } = $props();

  function sortIndicator(field: SortField): string {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  function rttColor(rtt: number | null): string {
    if (rtt === null) return 'text-text-dim';
    if (rtt < 200) return 'text-accent-green';
    if (rtt < 500) return 'text-accent-amber';
    return 'text-accent-red';
  }
</script>

<div class="overflow-x-auto">
  <table class="w-full text-sm text-left">
    <thead class="sticky top-0 bg-bg-surface text-text-secondary text-xs uppercase z-10">
      <tr>
        <th class="px-3 py-2 cursor-pointer hover:text-text-primary" onclick={() => onsort('url')}>
          Relay{sortIndicator('url')}
        </th>
        <th class="px-3 py-2 cursor-pointer hover:text-text-primary" onclick={() => onsort('nips')}>
          NIPs{sortIndicator('nips')}
        </th>
        <th class="px-3 py-2 cursor-pointer hover:text-text-primary" onclick={() => onsort('rttOpen')}>
          RTT{sortIndicator('rttOpen')}
        </th>
        <th class="px-3 py-2">Access</th>
        <th class="px-3 py-2">Status</th>
        <th class="px-3 py-2 w-8"></th>
      </tr>
    </thead>
    <tbody>
      {#each relays as relay (relay.url)}
        <tr
          class="border-b border-border-dim hover:bg-bg-surface/50 cursor-pointer"
          onclick={() => ontoggleexpand(relay.url)}
        >
          <td class="px-3 py-2 text-text-primary font-mono text-xs truncate max-w-64">
            {relay.url}
          </td>
          <td class="px-3 py-2">
            <div class="flex gap-1 flex-wrap">
              {#each relay.nips.slice(0, 5) as nip}
                <span class="px-1 bg-bg-elevated text-text-secondary rounded text-xs">{nip}</span>
              {/each}
              {#if relay.nips.length > 5}
                <span class="text-text-dim text-xs">+{relay.nips.length - 5}</span>
              {/if}
            </div>
          </td>
          <td class="px-3 py-2 {rttColor(relay.rttOpen)} text-xs font-mono">
            {relay.rttOpen !== null ? `${relay.rttOpen}ms` : '—'}
          </td>
          <td class="px-3 py-2 text-xs">
            {#if relay.requiresAuth}
              <span class="text-accent-amber" title="Requires authentication">🔒</span>
            {/if}
            {#if relay.requiresPayment}
              <span class="text-accent-amber" title="Requires payment">$</span>
            {/if}
            {#if !relay.requiresAuth && !relay.requiresPayment}
              <span class="text-accent-green">Free</span>
            {/if}
          </td>
          <td class="px-3 py-2">
            {#if relay.rttOpen !== null}
              <span class="inline-block w-2 h-2 rounded-full bg-accent-green" title="Online"></span>
            {:else}
              <span class="inline-block w-2 h-2 rounded-full bg-text-dim" title="Offline/Unknown"></span>
            {/if}
          </td>
          <td class="px-3 py-2">
            <button
              class="text-text-muted hover:text-text-primary px-1"
              onclick={(e) => { e.stopPropagation(); oncontextmenu(relay, e); }}
            >
              &#8942;
            </button>
          </td>
        </tr>
        {#if expandedUrl === relay.url}
          <tr>
            <td colspan="6" class="p-0">
              <RelayDetailRow {relay} />
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
