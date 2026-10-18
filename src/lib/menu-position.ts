/**
 * Viewport clamping for the relay context menu.
 *
 * The napplet runs inside a sandboxed iframe, so `window.innerWidth/innerHeight`
 * describe the *visible* menu area. A menu anchored at the click point overflows
 * whenever the kebab button sits near the right or bottom edge of a narrow
 * window, and an overflowing `position: fixed` element inside the iframe is
 * simply clipped — it cannot be scrolled to. Everything here keeps the menu box
 * inside that visible area instead.
 */

export const MENU_VIEWPORT_GUTTER = 8;

export interface Viewport {
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface MenuPlacement {
  left: number;
  /**
   * Exactly one of `top`/`bottom` is set: the menu is pinned to the edge it
   * opens away from, and `maxHeight` is the space available in that direction.
   * Pinning plus a directional cap is what makes containment structural — the
   * menu can grow (a submenu expanding inline) or shrink without any
   * re-measurement, and still cannot cross the viewport edge.
   */
  top: number | null;
  bottom: number | null;
  /** Max height the menu may occupy before it needs to scroll internally. */
  maxHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Horizontal placement: open right of the anchor, flipping left if it fits better. */
function placeHorizontally(
  anchorX: number,
  width: number,
  viewport: Viewport,
  gutter: number,
): number {
  const left = anchorX + width > viewport.width - gutter ? anchorX - width : anchorX;
  return clamp(left, gutter, Math.max(gutter, viewport.width - width - gutter));
}

/**
 * Pin vertically to the anchor, opening downward when the content fits below and
 * upward otherwise, and cap the height to that direction's available space.
 */
function pinVertically(
  anchorY: number,
  height: number,
  viewport: Viewport,
  gutter: number,
): Pick<MenuPlacement, 'top' | 'bottom' | 'maxHeight'> {
  const anchor = clamp(anchorY, gutter, Math.max(gutter, viewport.height - gutter));
  const spaceBelow = Math.max(0, viewport.height - gutter - anchor);
  const spaceAbove = Math.max(0, anchor - gutter);

  // Open down when the content fits below, or when below is simply the roomier
  // side; either way the cap keeps the far edge inside the gutter.
  if (height <= spaceBelow || spaceBelow >= spaceAbove) {
    return { top: anchor, bottom: null, maxHeight: spaceBelow };
  }
  return { top: null, bottom: viewport.height - anchor, maxHeight: spaceAbove };
}

/**
 * Place a menu of `size` near `anchor`, flipping it back over the anchor point
 * when it would overflow, and capping it when it is too large to fit either way.
 */
export function placeMenu(
  anchor: { x: number; y: number },
  size: Size,
  viewport: Viewport,
  gutter: number = MENU_VIEWPORT_GUTTER,
): MenuPlacement {
  const availableWidth = Math.max(0, viewport.width - gutter * 2);
  const width = Math.min(size.width, availableWidth);

  return {
    left: placeHorizontally(anchor.x, width, viewport, gutter),
    ...pinVertically(anchor.y, size.height, viewport, gutter),
  };
}

export interface SubmenuPlacement extends MenuPlacement {
  /**
   * Where the submenu opens. `right`/`left` float it beside the parent menu;
   * `inline` expands it inside the parent's own flow, which is the only layout
   * that neither overflows nor covers the parent in a window too narrow to hold
   * both boxes side by side.
   */
  side: 'right' | 'left' | 'inline';
}

/**
 * Place a submenu beside its parent menu, in viewport coordinates. The parent
 * menu is a scroll container, so a floating submenu is positioned against the
 * viewport rather than nested inside it — an `absolute` child would be clipped
 * by the parent's overflow.
 *
 * `triggerTop` is the submenu trigger's viewport-relative top edge.
 */
export function placeSubmenu(
  parent: { left: number; width: number },
  triggerTop: number,
  size: Size,
  viewport: Viewport,
  gutter: number = MENU_VIEWPORT_GUTTER,
): SubmenuPlacement {
  const availableWidth = Math.max(0, viewport.width - gutter * 2);
  const width = Math.min(size.width, availableWidth);

  const rightSide = parent.left + parent.width;
  const leftSide = parent.left - width;

  let side: SubmenuPlacement['side'];
  if (rightSide + width <= viewport.width - gutter) {
    side = 'right';
  } else if (leftSide >= gutter) {
    side = 'left';
  } else {
    // Inline expansion lives inside the parent's flow, so it has no viewport
    // coordinates of its own — the parent's placement already contains it.
    return {
      side: 'inline',
      left: 0,
      top: null,
      bottom: null,
      maxHeight: Math.max(0, viewport.height - gutter * 2),
    };
  }

  // The chosen side keeps the near edge clear; clamp so the far edge is safe too
  // (a parent menu flush against an edge can still push the box over).
  const left = clamp(
    side === 'right' ? rightSide : leftSide,
    gutter,
    Math.max(gutter, viewport.width - width - gutter),
  );

  return { side, left, ...pinVertically(triggerTop, size.height, viewport, gutter) };
}
