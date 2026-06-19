<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { RelayDiscovery } from '../lib/relay-store.js';

  let { relay, visible, x, y, onaction, onclose }: {
    relay: RelayDiscovery;
    visible: boolean;
    x: number;
    y: number;
    onaction: (action: string, relay: RelayDiscovery) => void;
    onclose: () => void;
  } = $props();

  let showRelayListSubmenu = $state(false);

  function handleAction(action: string) {
    showRelayListSubmenu = false;
    onaction(action, relay);
  }

  function handleClickOutside(event: MouseEvent) {
    if (visible) {
      onclose();
    }
  }

  onMount(() => {
    // Delay registration to avoid the opening click closing the menu
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

{#if visible}
  <div
    class="fixed bg-bg-surface border border-border-dim rounded-lg shadow-lg py-1 z-50 min-w-48 text-sm"
    style="left: {x}px; top: {y}px;"
    onclick={(e) => e.stopPropagation()}
  >
    <button
      class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors"
      onclick={() => handleAction('add-to-pool')}
    >
      Add to pool
    </button>

    <div class="relative">
      <button
        class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors flex justify-between items-center"
        onclick={() => showRelayListSubmenu = !showRelayListSubmenu}
      >
        Add to relay list
        <span class="text-text-muted text-xs">&rsaquo;</span>
      </button>

      {#if showRelayListSubmenu}
        <div class="absolute left-full top-0 bg-bg-surface border border-border-dim rounded-lg shadow-lg py-1 min-w-32">
          <button
            class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors"
            onclick={() => handleAction('relay-list-read')}
          >
            Read (inbox)
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors"
            onclick={() => handleAction('relay-list-write')}
          >
            Write (outbox)
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors"
            onclick={() => handleAction('relay-list-both')}
          >
            Read+Write
          </button>
        </div>
      {/if}
    </div>

    <button
      class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors"
      onclick={() => handleAction('feed')}
    >
      Feed
    </button>

    <div class="border-t border-border-dim my-1"></div>

    <button
      class="w-full text-left px-3 py-1.5 text-accent-red hover:bg-bg-elevated transition-colors"
      onclick={() => handleAction('block')}
    >
      Block relay
    </button>

    <button
      class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors"
      onclick={() => handleAction('named-list')}
    >
      Add to named list
    </button>
  </div>
{/if}
