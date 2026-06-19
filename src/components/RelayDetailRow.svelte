<script lang="ts">
  import { pubkeyColorStyle } from '@hyprgate/utils';
  import type { RelayDiscovery } from '../lib/relay-store.js';

  let { relay }: { relay: RelayDiscovery } = $props();
</script>

<div class="bg-bg-surface border-t border-border-dim p-4 text-xs">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <h4 class="text-text-muted font-semibold mb-1 uppercase">NIP Support</h4>
      <div class="flex flex-wrap gap-1">
        {#each relay.nips as nip}
          <span class="px-1.5 py-0.5 bg-bg-elevated text-text-secondary rounded">{nip}</span>
        {/each}
        {#if relay.nips.length === 0}
          <span class="text-text-dim">No NIPs reported</span>
        {/if}
      </div>
    </div>

    <div>
      <h4 class="text-text-muted font-semibold mb-1 uppercase">RTT Latency</h4>
      <div class="space-y-1 text-text-secondary">
        <div>Open: <span class="font-mono">{relay.rttOpen !== null ? `${relay.rttOpen}ms` : '—'}</span></div>
        <div>Read: <span class="font-mono">{relay.rttRead !== null ? `${relay.rttRead}ms` : '—'}</span></div>
        <div>Write: <span class="font-mono">{relay.rttWrite !== null ? `${relay.rttWrite}ms` : '—'}</span></div>
      </div>
    </div>

    <div>
      <h4 class="text-text-muted font-semibold mb-1 uppercase">Access Requirements</h4>
      <div class="space-y-1 text-text-secondary">
        <div>Auth: {relay.requiresAuth ? 'Required' : 'No'}</div>
        <div>Payment: {relay.requiresPayment ? 'Required' : 'No'}</div>
        <div>PoW: {relay.requiresPow ? 'Required' : 'No'}</div>
        <div>Writes: {relay.writesAllowed ? 'Allowed' : 'Read-only'}</div>
      </div>
    </div>

    <div>
      <h4 class="text-text-muted font-semibold mb-1 uppercase">Details</h4>
      <div class="space-y-1 text-text-secondary">
        <div>Network: {relay.networkType}</div>
        {#if relay.relayType}
          <div>Type: {relay.relayType}</div>
        {/if}
        {#if relay.topics.length > 0}
          <div>Topics: {relay.topics.join(', ')}</div>
        {/if}
      </div>
    </div>

    {#if relay.kinds.length > 0}
      <div>
        <h4 class="text-text-muted font-semibold mb-1 uppercase">Supported Kinds</h4>
        <div class="flex flex-wrap gap-1">
          {#each relay.kinds as kind}
            <span class="px-1.5 py-0.5 bg-bg-elevated text-text-secondary rounded font-mono">{kind}</span>
          {/each}
        </div>
      </div>
    {/if}

    {#if relay.nip11}
      <div>
        <h4 class="text-text-muted font-semibold mb-1 uppercase">NIP-11 Info</h4>
        <div class="space-y-1 text-text-secondary">
          {#if relay.nip11.name}
            <div>Name: {relay.nip11.name}</div>
          {/if}
          {#if relay.nip11.description}
            <div>Description: {relay.nip11.description}</div>
          {/if}
          {#if relay.nip11.pubkey}
            <div class="font-mono truncate">Operator: <span style={pubkeyColorStyle(relay.nip11.pubkey)}>{relay.nip11.pubkey}</span></div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
