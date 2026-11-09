<script lang="ts">
  import { common, type CommonProfileData } from '@napplet/sdk';
  import { resourceImageBatch } from '@hyprgate/utils';
  import { openOperatorProfile } from '../lib/relay-actions.js';
  import { relayDescription, relayOperator, type RelayDiscovery } from '../lib/relay-store.js';

  let { relay }: { relay: RelayDiscovery } = $props();

  const operator = $derived(relayOperator(relay));
  const description = $derived(relayDescription(relay));
  let profile = $state<CommonProfileData | null>(null);
  let npub = $state('');

  const operatorKey = $derived(npub || operator || '');
  const operatorShortKey = $derived(operatorKey.length > 18 ? `${operatorKey.slice(0, 10)}…${operatorKey.slice(-6)}` : operatorKey);
  const operatorName = $derived.by(() => {
    for (const candidate of [profile?.displayName, profile?.display_name, profile?.name, profile?.nip05]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    return '';
  });
  const operatorPicture = $derived(typeof profile?.picture === 'string' ? profile.picture : '');

  $effect(() => {
    const pubkey = operator;
    profile = null;
    npub = '';
    if (!pubkey) return;
    let current = true;
    void common.getProfile(pubkey).then((result) => { if (current) profile = result.profile ?? null; }).catch(() => {});
    void common.encodeNip19({ type: 'npub', hex: pubkey }).then((result) => { if (current && result.ok && result.value) npub = result.value; }).catch(() => {});
    return () => { current = false; };
  });
</script>

<div class="bg-bg-surface border-t border-border-dim p-4 text-xs" data-testid="relay-detail">
  {#if description || operator}
    <div class="mb-4 space-y-2">
      {#if description}<p class="text-sm text-text-primary">{description}</p>{/if}
      {#if operator}
        <div class="flex items-center gap-2 text-text-secondary">
          <span>Run by</span>
          <button type="button" class="operator" title={operatorKey} onclick={() => { void openOperatorProfile(operator); }} data-testid="relay-operator">
            <span class="operator-avatar" aria-hidden="true">
              {(operatorName || operatorShortKey.replace(/^npub1/, '')).slice(0, 1).toUpperCase()}
              {#if operatorPicture}<img use:resourceImageBatch={operatorPicture} alt="" />{/if}
            </span>
            <span class="operator-name text-text-primary">{operatorName || operatorShortKey}</span>
            {#if operatorName}<span class="text-text-muted font-mono">{operatorShortKey}</span>{/if}
          </button>
        </div>
      {/if}
    </div>
  {/if}
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <h4 class="text-text-muted font-semibold mb-1 uppercase">NIP Support</h4>
      <div class="flex flex-wrap gap-1">
        {#each relay.nips as nip}
          <span class="px-1.5 py-0.5 bg-bg-elevated text-text-secondary rounded">{nip}</span>
        {/each}
        {#if relay.nips.length === 0}
          <span class="text-text-muted">No NIPs reported</span>
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

  </div>
</div>

<style>
  .operator { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; }
  .operator:hover .operator-name, .operator:focus-visible .operator-name { text-decoration: underline; }
  .operator:focus-visible { outline: 2px solid var(--hg-accent-primary); outline-offset: 2px; border-radius: 2px; }
  .operator-avatar { position: relative; display: grid; place-items: center; width: 22px; height: 22px; flex: 0 0 auto; overflow: hidden; border-radius: 3px; border: 1px solid var(--hg-border-default); background: var(--hg-bg-elevated); font-weight: 700; }
  .operator-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
</style>
