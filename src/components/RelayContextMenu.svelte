<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import type { RelayDiscovery } from '../lib/relay-store.js';
  import { placeMenu, placeSubmenu, MENU_VIEWPORT_GUTTER } from '../lib/menu-position.js';
  import type { MenuPlacement, SubmenuPlacement } from '../lib/menu-position.js';

  let { relay, visible, x, y, onaction, onclose }: {
    relay: RelayDiscovery;
    visible: boolean;
    x: number;
    y: number;
    onaction: (action: string, relay: RelayDiscovery) => void;
    onclose: () => void;
  } = $props();

  let showRelayListSubmenu = $state(false);

  let menuEl = $state<HTMLDivElement | null>(null);
  let submenuEl = $state<HTMLDivElement | null>(null);
  let submenuTriggerEl = $state<HTMLButtonElement | null>(null);

  let placement = $state<MenuPlacement | null>(null);
  let submenuPlacement = $state<SubmenuPlacement | null>(null);

  function viewport() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function reposition(): void {
    if (!menuEl) return;
    // Measure unclamped so the natural size drives the flip decision.
    placement = placeMenu(
      { x, y },
      { width: menuEl.offsetWidth, height: menuEl.scrollHeight },
      viewport(),
    );
  }

  function repositionSubmenu(): void {
    if (!menuEl || !submenuEl || !submenuTriggerEl) return;
    const parent = menuEl.getBoundingClientRect();
    const trigger = submenuTriggerEl.getBoundingClientRect();
    submenuPlacement = placeSubmenu(
      { left: parent.left, width: parent.width },
      trigger.top,
      { width: submenuEl.offsetWidth, height: submenuEl.scrollHeight },
      viewport(),
    );
  }

  // Re-place whenever the anchor moves or the menu is (re)mounted.
  $effect(() => {
    void x;
    void y;
    if (!visible || !menuEl) {
      placement = null;
      return;
    }
    reposition();
  });

  $effect(() => {
    if (!showRelayListSubmenu) {
      submenuPlacement = null;
      return;
    }
    void tick().then(repositionSubmenu);
  });

  function handleClickOutside(event: MouseEvent) {
    if (visible) {
      onclose();
    }
  }

  function handleResize() {
    reposition();
    if (showRelayListSubmenu) repositionSubmenu();
  }

  function handleAction(action: string) {
    showRelayListSubmenu = false;
    onaction(action, relay);
  }

  onMount(() => {
    // Delay registration to avoid the opening click closing the menu
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', handleResize);
  });

  // Before the first measurement the menu is rendered at the raw anchor and
  // hidden, so an unplaced frame never flashes in the wrong spot.
  function boxStyle(placed: MenuPlacement | null, fallbackX: number, fallbackY: number): string {
    if (!placed) return `left: ${fallbackX}px; top: ${fallbackY}px; visibility: hidden;`;
    const edge: 'top' | 'bottom' = placed.top !== null ? 'top' : 'bottom';
    const offset: number = (placed.top !== null ? placed.top : placed.bottom) ?? 0;
    // The cap is expressed against `100vh` rather than the measured pixel height:
    // the shell resizes napplet iframes as windows open and tile, and a cap baked
    // from the pre-resize viewport would let the pinned menu overhang the new
    // one. `100vh` tracks the iframe viewport live, so the pinned edge plus this
    // cap keep the menu contained with no re-measurement.
    return `left: ${placed.left}px; ${edge}: ${offset}px;`
      + ` max-height: calc(100vh - ${offset + MENU_VIEWPORT_GUTTER}px);`
      + ` max-width: calc(100vw - ${placed.left + MENU_VIEWPORT_GUTTER}px);`;
  }

  const submenuInline = $derived(submenuPlacement?.side === 'inline');

  const submenuClass = $derived(
    submenuInline
      ? 'border-y border-border-dim bg-bg-elevated/40 my-1'
      : 'fixed bg-bg-surface border border-border-dim rounded-lg shadow-lg py-1 min-w-32 max-w-[calc(100vw-16px)] z-50 overflow-y-auto',
  );

  const submenuStyle = $derived(
    submenuInline ? '' : boxStyle(submenuPlacement, 0, 0),
  );

  // Inline items are indented so the nesting stays readable without the
  // floating box's border to carry it.
  const submenuItemClass = $derived(
    `w-full text-left ${submenuInline ? 'pl-6 pr-3' : 'px-3'} py-1.5 text-text-primary hover:bg-bg-elevated transition-colors`,
  );
</script>

{#if visible}
  <div
    bind:this={menuEl}
    class="fixed bg-bg-surface border border-border-dim rounded-lg shadow-lg py-1 z-50 min-w-48 text-sm overflow-y-auto overflow-x-hidden"
    style={boxStyle(placement, x, y)}
    onclick={(e) => e.stopPropagation()}
    onscroll={() => { if (showRelayListSubmenu) repositionSubmenu(); }}
  >
    <button
      class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors"
      onclick={() => handleAction('add-to-pool')}
    >
      Add to pool
    </button>

    <div>
      <button
        bind:this={submenuTriggerEl}
        class="w-full text-left px-3 py-1.5 text-text-primary hover:bg-bg-elevated transition-colors flex justify-between items-center"
        onclick={() => showRelayListSubmenu = !showRelayListSubmenu}
      >
        Add to relay list
        <span
          class="text-text-muted text-xs transition-transform"
          class:rotate-90={submenuInline && showRelayListSubmenu}
        >&rsaquo;</span>
      </button>

      {#if showRelayListSubmenu}
        <div
          bind:this={submenuEl}
          class={submenuClass}
          style={submenuStyle}
        >
          <button
            class={submenuItemClass}
            onclick={() => handleAction('relay-list-read')}
          >
            Read (inbox)
          </button>
          <button
            class={submenuItemClass}
            onclick={() => handleAction('relay-list-write')}
          >
            Write (outbox)
          </button>
          <button
            class={submenuItemClass}
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
