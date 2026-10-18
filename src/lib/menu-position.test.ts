import { describe, it, expect } from 'vitest';
import { placeMenu, placeSubmenu, MENU_VIEWPORT_GUTTER } from './menu-position.js';
import type { MenuPlacement, Viewport } from './menu-position.js';

// Approximates the relay-browser iframe at the size the overflow was reported
// at: a narrow tiled pane with the kebab button hard against the right edge.
const NARROW = { width: 241, height: 217 };
const MENU = { width: 192, height: 190 };
const G = MENU_VIEWPORT_GUTTER;

/**
 * Resolve a placement into the box the browser actually paints, given the
 * content height at render time. `contentHeight` is deliberately separate from
 * the height passed to placeMenu: the menu grows when a submenu expands inline,
 * and the whole point of pinning one edge is that growth cannot escape the
 * viewport without a re-measure.
 */
function renderedBox(placed: MenuPlacement, contentHeight: number, viewport: Viewport) {
  const height = Math.min(contentHeight, placed.maxHeight);
  if (placed.top !== null) {
    return { top: placed.top, bottom: placed.top + height };
  }
  const bottom = viewport.height - (placed.bottom ?? 0);
  return { top: bottom - height, bottom };
}

function expectContained(
  placed: MenuPlacement,
  contentHeight: number,
  viewport: Viewport,
  width: number,
  label: string,
): void {
  const box = renderedBox(placed, contentHeight, viewport);
  expect(placed.left, `${label}: left edge`).toBeGreaterThanOrEqual(G);
  expect(placed.left + width, `${label}: right edge`).toBeLessThanOrEqual(viewport.width - G);
  expect(box.top, `${label}: top edge`).toBeGreaterThanOrEqual(G);
  expect(box.bottom, `${label}: bottom edge`).toBeLessThanOrEqual(viewport.height - G);
}

describe('placeMenu', () => {
  it('pins exactly one vertical edge', () => {
    const down = placeMenu({ x: 40, y: 20 }, MENU, { width: 1280, height: 800 });
    expect(down.top).not.toBeNull();
    expect(down.bottom).toBeNull();

    const up = placeMenu({ x: 40, y: 780 }, MENU, { width: 1280, height: 800 });
    expect(up.top).toBeNull();
    expect(up.bottom).not.toBeNull();
  });

  it('opens right/down from the anchor when there is room', () => {
    const placed = placeMenu({ x: 40, y: 60 }, MENU, { width: 1280, height: 800 });
    expect(placed.left).toBe(40);
    expect(placed.top).toBe(60);
  });

  it('flips left when the anchor sits near the right edge', () => {
    // Kebab button at x=225 in a 241px-wide iframe: 225 + 192 overflows.
    const placed = placeMenu({ x: 225, y: 40 }, MENU, NARROW);
    expect(placed.left).toBe(225 - MENU.width);
    expect(placed.left + MENU.width).toBeLessThanOrEqual(NARROW.width - G);
  });

  it('opens upward from an anchor near the bottom edge', () => {
    const viewport = { width: 1280, height: 800 };
    const placed = placeMenu({ x: 40, y: 780 }, MENU, viewport);
    // Bottom pinned to the anchor, so the menu grows up from the click point.
    expect(placed.bottom).toBe(viewport.height - 780);
    expectContained(placed, MENU.height, viewport, MENU.width, 'upward menu');
  });

  it('pins to the gutter when the menu is wider than the viewport', () => {
    const placed = placeMenu({ x: 20, y: 20 }, { width: 400, height: 190 }, NARROW);
    expect(placed.left).toBe(G);
    expect(placed.top).toBe(20);
  });

  it('caps a tall menu to the space in the direction it opens', () => {
    const placed = placeMenu({ x: 40, y: 20 }, { width: 192, height: 5000 }, NARROW);
    expect(placed.top).toBe(20);
    expect(placed.maxHeight).toBe(NARROW.height - G - 20);
    expectContained(placed, 5000, NARROW, 192, 'tall menu');
  });

  it('degrades to the gutter in a viewport smaller than the menu', () => {
    const tiny = { width: 10, height: 10 };
    const placed = placeMenu({ x: 5, y: 5 }, MENU, tiny);
    expect(placed.left).toBe(G);
    expect(placed.maxHeight).toBe(0);
  });

  it('stays contained for any anchor, even when the menu later grows', () => {
    // The grown heights model a submenu expanding inline after placement.
    for (const contentHeight of [40, MENU.height, 400, 5000]) {
      for (let x = 0; x <= NARROW.width; x += 10) {
        for (let y = 0; y <= NARROW.height; y += 10) {
          const placed = placeMenu({ x, y }, MENU, NARROW);
          expectContained(placed, contentHeight, NARROW, MENU.width, `anchor ${x},${y} @ ${contentHeight}px`);
        }
      }
    }
  });
});

describe('placeSubmenu', () => {
  const SUB = { width: 128, height: 110 };

  it('opens to the right of the parent menu when there is room', () => {
    const placed = placeSubmenu({ left: 40, width: 192 }, 100, SUB, { width: 1280, height: 800 });
    expect(placed.side).toBe('right');
    expect(placed.left).toBe(232);
    expect(placed.top).toBe(100);
  });

  it('flips to the left of the parent when the right side overflows', () => {
    const viewport = { width: 360, height: 640 };
    const placed = placeSubmenu({ left: 148, width: 192 }, 100, SUB, viewport);
    expect(placed.side).toBe('left');
    expect(placed.left).toBe(148 - SUB.width);
    expect(placed.left).toBeGreaterThanOrEqual(G);
  });

  it('falls back to inline expansion when neither side has room', () => {
    // The reported geometry: a 192px menu in a 241px iframe leaves no room for a
    // 128px submenu on either side.
    const placed = placeSubmenu({ left: 41, width: 192 }, 100, SUB, NARROW);
    expect(placed.side).toBe('inline');
    expect(placed.top).toBeNull();
    expect(placed.bottom).toBeNull();
  });

  it('prefers the left side over inline when the left has room', () => {
    const placed = placeSubmenu({ left: 140, width: 192 }, 100, SUB, { width: 340, height: 640 });
    expect(placed.side).toBe('left');
    expect(placed.left).toBe(12);
  });

  it('opens upward when the trigger sits near the bottom edge', () => {
    const short = { width: 1280, height: 620 };
    const placed = placeSubmenu({ left: 40, width: 192 }, 600, SUB, short);
    expect(placed.side).toBe('right');
    expect(placed.top).toBeNull();
    expectContained(placed, SUB.height, short, SUB.width, 'upward submenu');
  });

  it('never floats the submenu outside the viewport for any trigger position', () => {
    const viewport = { width: 360, height: 640 };
    for (let parentLeft = 0; parentLeft <= viewport.width; parentLeft += 10) {
      for (let triggerTop = 0; triggerTop <= viewport.height; triggerTop += 20) {
        const placed = placeSubmenu({ left: parentLeft, width: 192 }, triggerTop, SUB, viewport);
        // Inline expansion is contained by the parent menu's own placement.
        if (placed.side === 'inline') continue;
        expectContained(placed, SUB.height, viewport, SUB.width, `submenu ${parentLeft},${triggerTop}`);
      }
    }
  });
});
