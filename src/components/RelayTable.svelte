<script lang="ts">
  import { relayAccess, relayDescription, relayName, relayNetworkLabel, relaySpeed } from '../lib/relay-store.js';
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

  function ariaSort(field: SortField): 'ascending' | 'descending' | 'none' {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  function sortMark(field: SortField): string {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  const SPEED_CLASS = {
    fast: 'text-accent-green',
    ok: 'text-accent-amber',
    slow: 'text-accent-red',
    unknown: 'text-text-muted',
  } as const;
</script>

{#snippet SortHeader(field: SortField, label: string, extraClass = '')}
  <th class="px-3 py-2 {extraClass}" aria-sort={ariaSort(field)}>
    <button type="button" class="sort-button uppercase hover:text-text-primary" class:sorted={sortField === field} onclick={() => onsort(field)} data-testid={`relay-sort-${field}`}>
      {label} <span aria-hidden="true">{sortMark(field)}</span>
    </button>
  </th>
{/snippet}

<table class="w-full text-sm text-left">
  <thead class="sticky top-0 bg-bg-surface text-text-secondary text-xs z-10">
    <tr>
      {@render SortHeader('url', 'Relay')}
      <th class="px-3 py-2 uppercase col-wide">Topics</th>
      {@render SortHeader('nips', 'NIPs', 'col-wide')}
      {@render SortHeader('rttOpen', 'Speed')}
      <th class="px-3 py-2 uppercase col-wide">Access</th>
      <th class="px-2 py-2 w-8"><span class="sr-only">Actions</span></th>
    </tr>
  </thead>
  <tbody>
    {#each relays as relay (relay.url)}
      {@const speed = relaySpeed(relay.rttOpen)}
      {@const network = relayNetworkLabel(relay)}
      {@const description = relayDescription(relay)}
      <tr
        class="border-b border-border-dim hover:bg-bg-surface/50 cursor-pointer"
        data-relay={relay.url}
        onclick={() => ontoggleexpand(relay.url)}
        oncontextmenu={(e) => oncontextmenu(relay, e)}
      >
        <td class="px-3 py-2 relay-cell">
          <button
            type="button"
            class="expand-button"
            aria-expanded={expandedUrl === relay.url}
            data-testid="relay-expand"
            onclick={(e) => { e.stopPropagation(); ontoggleexpand(relay.url); }}
          >
            <span class="relay-title">
              <span class="chevron text-text-muted" class:open={expandedUrl === relay.url} aria-hidden="true">›</span>
              <span class="text-text-primary font-semibold truncate">{relayName(relay)}</span>
              {#if network}<span class="px-1 rounded text-xs bg-bg-elevated text-text-secondary">{network}</span>{/if}
            </span>
            <span class="relay-url font-mono text-xs text-text-muted truncate">{relay.url}</span>
            {#if description && expandedUrl !== relay.url}<span class="text-xs text-text-secondary truncate">{description}</span>{/if}
          </button>
        </td>
        <td class="px-3 py-2 col-wide">
          <div class="flex gap-1 flex-wrap">
            {#each relay.topics.slice(0, 3) as topic}
              <span class="px-1 bg-bg-elevated text-text-secondary rounded text-xs">{topic}</span>
            {/each}
            {#if relay.topics.length > 3}<span class="text-text-muted text-xs">+{relay.topics.length - 3}</span>{/if}
          </div>
        </td>
        <td class="px-3 py-2 text-xs text-text-secondary col-wide whitespace-nowrap" title={relay.nips.length ? `NIPs ${relay.nips.join(', ')}` : 'No NIPs reported'}>
          {relay.nips.length}
        </td>
        <td class="px-3 py-2 text-xs whitespace-nowrap">
          <div class={SPEED_CLASS[speed.tone]}>{speed.label}</div>
          {#if relay.rttOpen !== null}<div class="text-text-muted font-mono">{relay.rttOpen} ms</div>{/if}
        </td>
        <td class="px-3 py-2 text-xs text-text-secondary col-wide">{relayAccess(relay)}</td>
        <td class="px-2 py-2 text-right">
          <button
            type="button"
            class="actions-button text-text-secondary hover:text-text-primary border border-border-dim rounded"
            aria-label={`Actions for ${relayName(relay)}`}
            aria-haspopup="true"
            title="Actions"
            data-testid="relay-actions"
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

<style>
  .sort-button { display: inline-flex; gap: 4px; padding: 0; background: none; border: 0; color: inherit; font: inherit; }
  .sort-button span { opacity: .55; }
  .sort-button.sorted { color: var(--hg-text-primary); }
  .sort-button.sorted span { opacity: 1; }
  .relay-cell { max-width: 0; width: 45%; }
  .expand-button { display: grid; gap: 1px; width: 100%; padding: 0; border: 0; background: none; text-align: left; font: inherit; }
  .relay-title { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .relay-url { padding-left: 14px; }
  .expand-button > span:last-child:not(.relay-url) { padding-left: 14px; }
  .chevron { display: inline-block; width: 8px; flex: 0 0 auto; transition: transform .1s; }
  .chevron.open { transform: rotate(90deg); }
  .actions-button { min-width: 28px; min-height: 28px; font-size: 16px; line-height: 1; background: var(--hg-bg-surface); }
  button:focus-visible { outline: 2px solid var(--hg-accent-primary); outline-offset: 1px; border-radius: 2px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
  @media (max-width: 640px) {
    .col-wide { display: none; }
    .relay-cell { width: 100%; }
  }
</style>
