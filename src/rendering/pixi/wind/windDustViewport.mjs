import {
  ISO_TILE_HALF_HEIGHT_PX,
  ISO_TILE_HALF_WIDTH_PX,
} from '../isoConstants.js';

/**
 * @typedef {{
 *   panPx: number,
 *   panPy: number,
 *   originX: number,
 *   originY: number,
 *   baseCamX: number,
 *   baseCamY: number,
 * }} ViewportFrameState
 */

/**
 * How far fixed world content moved on screen between frames (iso-aware).
 * Apply this delta to viewport-pinned dust so it scrolls with the map.
 *
 * Uses sync-relative pan + sync tile anchor + origin only. Pan is measured from
 * the last tile sync anchor (not floor(camera)), so scroll stays continuous
 * while async sync is pending.
 * @param {ViewportFrameState | null} prev
 * @param {ViewportFrameState} curr
 */
export function computeViewportScrollDelta(prev, curr) {
  if (!prev) {
    return { dx: 0, dy: 0 };
  }
  const dPanPx = curr.panPx - prev.panPx;
  const dPanPy = curr.panPy - prev.panPy;
  const dOx = curr.originX - prev.originX;
  const dOy = curr.originY - prev.originY;
  const dBaseCx = curr.baseCamX - prev.baseCamX;
  const dBaseCy = curr.baseCamY - prev.baseCamY;
  return {
    dx: dPanPx + dOx - ((dBaseCx - dBaseCy) * ISO_TILE_HALF_WIDTH_PX),
    dy: dPanPy + dOy - ((dBaseCx + dBaseCy) * ISO_TILE_HALF_HEIGHT_PX),
  };
}

/**
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} [pad]
 */
export function computeScreenViewportBounds(viewW, viewH, pad = 0) {
  const p = Math.max(0, Number(pad) || 0);
  return {
    minX: -p,
    maxX: viewW + p,
    minY: -p,
    maxY: viewH + p,
  };
}

/**
 * @param {number} sx
 * @param {number} sy
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} [margin]
 */
export function isOnScreen(sx, sy, viewW, viewH, margin = 32) {
  const m = Math.max(0, Number(margin) || 0);
  return sx >= -m && sx <= viewW + m && sy >= -m && sy <= viewH + m;
}

/**
 * Toroidal wrap: when a particle leaves the viewport it re-enters on the opposite edge.
 * Preserves overshoot so fast scroll does not bunch particles on one edge.
 * @param {number} sx
 * @param {number} sy
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} [margin]
 */
export function wrapScreenPosition(sx, sy, viewW, viewH, margin = 0) {
  const m = Math.max(0, Number(margin) || 0);
  const minX = -m;
  const maxX = viewW + m;
  const minY = -m;
  const maxY = viewH + m;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  let x = Number(sx) || 0;
  let y = Number(sy) || 0;
  if (spanX > 0) {
    while (x < minX) {
      x += spanX;
    }
    while (x > maxX) {
      x -= spanX;
    }
  }
  if (spanY > 0) {
    while (y < minY) {
      y += spanY;
    }
    while (y > maxY) {
      y -= spanY;
    }
  }
  return { sx: x, sy: y };
}
