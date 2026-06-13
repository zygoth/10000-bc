import { ISO_TILE_HALF_WIDTH_PX, ISO_TILE_HALF_HEIGHT_PX } from './isoConstants.js';

/**
 * Integer tile anchor used for iso layout + roll (must match `commitGameCamera` / Pixi sync).
 */
export function tileAnchorFromFloat(cameraFx, cameraFy) {
  return {
    x: Math.floor(Number(cameraFx) + 1e-9),
    y: Math.floor(Number(cameraFy) + 1e-9),
  };
}

/**
 * Sub-pixel pan applied to the world layer for fractional camera (see `IsoWorldScene.applyCameraPixelRoll`).
 */
export function computeWorldPanLayerPixels(cameraFx, cameraFy) {
  const bx = Math.floor(Number(cameraFx) + 1e-9);
  const by = Math.floor(Number(cameraFy) + 1e-9);
  return computeWorldPanLayerPixelsForSyncAnchor(cameraFx, cameraFy, bx, by);
}

/**
 * Pan relative to the last tile sync anchor (matches iso tile local coords until sync catches up).
 * Fractional parts may exceed 1.0 while float camera has crossed a tile edge but sync is pending.
 */
export function computeWorldPanLayerPixelsForSyncAnchor(cameraFx, cameraFy, baseCamX, baseCamY) {
  const bx = Math.floor(Number(baseCamX) + 1e-9);
  const by = Math.floor(Number(baseCamY) + 1e-9);
  const fracX = Number(cameraFx) - bx;
  const fracY = Number(cameraFy) - by;
  const px = (fracY - fracX) * ISO_TILE_HALF_WIDTH_PX;
  const py = -(fracX + fracY) * ISO_TILE_HALF_HEIGHT_PX;
  return {
    bx,
    by,
    fracX,
    fracY,
    px,
    py,
  };
}
