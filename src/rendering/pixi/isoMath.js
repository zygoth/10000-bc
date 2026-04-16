import { getTileAt } from '../../game/simCore.mjs';
import { getTerrainSpriteFrame } from '../../game/plantSpriteCatalog.mjs';
import { computeTileTopCenterYFromGroundAnchor } from '../../ui/isoProjection.js';
import {
  ISO_TILE_HALF_HEIGHT_PX,
  ISO_TILE_HALF_WIDTH_PX,
  ISO_TILE_HEIGHT_PX,
  ISO_TILE_WIDTH_PX,
  ISO_PLAY_TOP_HUD_CENTER_BIAS_PX,
  ISO_PLAY_VERTICAL_NUDGE_EXTRA_TILE_HEIGHTS,
  ISO_BASE_SCALE,
  ISO_SOURCE_TILE_WIDTH,
  elevationToIsoOffsetPx,
} from './isoConstants.js';

/**
 * Screen corners → local tile offsets (relative to camera) for the isometric frustum.
 * Same geometry as the old DOM `visibleIsoTiles` culling.
 */
export function computeIsoFrustumLocalExtents(windowWidth, windowHeight, cameraAnchorElevationPx) {
  const originX = Math.round(windowWidth / 2);
  const originY = Math.round(windowHeight / 2)
    + ISO_PLAY_TOP_HUD_CENTER_BIAS_PX
    + ISO_PLAY_VERTICAL_NUDGE_EXTRA_TILE_HEIGHTS * ISO_TILE_HEIGHT_PX
    + cameraAnchorElevationPx;
  const xMin = -ISO_TILE_WIDTH_PX;
  const xMax = windowWidth + ISO_TILE_WIDTH_PX;
  const yMin = -ISO_TILE_HEIGHT_PX;
  const yMax = windowHeight + ISO_TILE_HEIGHT_PX;
  const corners = [
    [xMin, yMin],
    [xMax, yMin],
    [xMin, yMax],
    [xMax, yMax],
  ];

  let minLocalX = Number.POSITIVE_INFINITY;
  let maxLocalX = Number.NEGATIVE_INFINITY;
  let minLocalY = Number.POSITIVE_INFINITY;
  let maxLocalY = Number.NEGATIVE_INFINITY;

  for (const [sx, sy] of corners) {
    const sum = (sy - originY) / ISO_TILE_HALF_HEIGHT_PX;
    const diff = (sx - originX) / ISO_TILE_HALF_WIDTH_PX;
    const localX = (sum + diff) / 2;
    const localY = (sum - diff) / 2;
    minLocalX = Math.min(minLocalX, localX);
    maxLocalX = Math.max(maxLocalX, localX);
    minLocalY = Math.min(minLocalY, localY);
    maxLocalY = Math.max(maxLocalY, localY);
  }

  return {
    minLocalX,
    maxLocalX,
    minLocalY,
    maxLocalY,
    originX,
    originY,
  };
}

/**
 * Integer camera bounds so no screen area maps outside `[0, mapWidth)×[0, mapHeight)`.
 * Rectangular `map - viewport` clamp is wrong for isometric; this matches the frustum.
 */
export function computeIsoCameraClampBounds(
  mapWidth,
  mapHeight,
  windowWidth,
  windowHeight,
  cameraAnchorElevationPx,
) {
  const w = Math.max(1, Math.floor(Number(mapWidth) || 0));
  const h = Math.max(1, Math.floor(Number(mapHeight) || 0));
  const { minLocalX, maxLocalX, minLocalY, maxLocalY } = computeIsoFrustumLocalExtents(
    windowWidth,
    windowHeight,
    cameraAnchorElevationPx,
  );

  let minCameraX = Math.ceil(-minLocalX);
  let maxCameraX = Math.floor((w - 1) - maxLocalX);
  let minCameraY = Math.ceil(-minLocalY);
  let maxCameraY = Math.floor((h - 1) - maxLocalY);

  minCameraX = Math.min(w - 1, Math.max(0, minCameraX));
  maxCameraX = Math.min(w - 1, Math.max(0, maxCameraX));
  minCameraY = Math.min(h - 1, Math.max(0, minCameraY));
  maxCameraY = Math.min(h - 1, Math.max(0, maxCameraY));

  if (minCameraX > maxCameraX) {
    const cx = Math.min(w - 1, Math.max(0, Math.floor((w - 1) / 2)));
    minCameraX = cx;
    maxCameraX = cx;
  }
  if (minCameraY > maxCameraY) {
    const cy = Math.min(h - 1, Math.max(0, Math.floor((h - 1) / 2)));
    minCameraY = cy;
    maxCameraY = cy;
  }

  return { minCameraX, maxCameraX, minCameraY, maxCameraY };
}

/**
 * Visible world tiles for isometric game view (same frustum as `visibleIsoTiles` in App.js).
 */
export function computeVisibleIsoTiles(
  gameState,
  cameraX,
  cameraY,
  windowWidth,
  windowHeight,
  cameraAnchorElevationPx,
) {
  const { minLocalX, maxLocalX, minLocalY, maxLocalY, originX, originY } = computeIsoFrustumLocalExtents(
    windowWidth,
    windowHeight,
    cameraAnchorElevationPx,
  );

  /** Integer anchor for culling; screen projection still uses float `cameraX` / `cameraY`. */
  const baseCamX = Math.floor(Number(cameraX) + 1e-9);
  const baseCamY = Math.floor(Number(cameraY) + 1e-9);
  const pad = 4;
  const startLocalX = Math.floor(minLocalX) - pad;
  const endLocalX = Math.ceil(maxLocalX) + pad;
  const startLocalY = Math.floor(minLocalY) - pad;
  const endLocalY = Math.ceil(maxLocalY) + pad;

  const visible = [];
  for (let localY = startLocalY; localY <= endLocalY; localY += 1) {
    for (let localX = startLocalX; localX <= endLocalX; localX += 1) {
      const worldX = baseCamX + localX;
      const worldY = baseCamY + localY;
      if (worldX < 0 || worldY < 0 || worldX >= gameState.width || worldY >= gameState.height) {
        continue;
      }
      const tile = getTileAt(gameState, worldX, worldY);
      if (!tile) {
        continue;
      }
      visible.push({ worldX, worldY, tile });
    }
  }

  return { visible, originX, originY };
}

export function sortVisibleIsoTiles(visible) {
  const sorted = visible.slice();
  sorted.sort((a, b) => {
    const da = a.worldY + a.worldX;
    const db = b.worldY + b.worldX;
    if (da !== db) {
      return da - db;
    }
    return a.worldX - b.worldX;
  });
  return sorted;
}

/** Normalized L1 distance to iso diamond boundary (1 = on edge, <1 = inside). */
export function isoDiamondDistance(px, py, cx, cy, halfW = 64, halfH = 32) {
  return Math.abs(px - cx) / halfW + Math.abs(py - cy) / halfH;
}

/** Diamond hit test matching `.iso-tile-hitbox` (128×64, axis-aligned rhombus). */
export function pointInIsoDiamond(px, py, cx, cy, halfW = 64, halfH = 32) {
  return isoDiamondDistance(px, py, cx, cy, halfW, halfH) <= 1;
}

function tileTopCenterYForPick(
  gameState,
  worldX,
  worldY,
  tile,
  cameraX,
  cameraY,
  originX,
  originY,
) {
  const localX = worldX - cameraX;
  const localY = worldY - cameraY;
  const screenX = Math.round((localX - localY) * ISO_TILE_HALF_WIDTH_PX + originX);
  const screenY = Math.round((localX + localY) * ISO_TILE_HALF_HEIGHT_PX + originY);
  const elevationOffsetPx = elevationToIsoOffsetPx(tile.elevation);
  const groundY = screenY + ISO_TILE_HALF_HEIGHT_PX - elevationOffsetPx;
  const grassSprite = !tile.waterType ? getTerrainSpriteFrame('grass') : null;
  const dirtSprite = !tile.waterType ? getTerrainSpriteFrame('dirt') : null;
  const waterSprite = tile.waterType ? getTerrainSpriteFrame('water') : null;
  const topFaceReferenceSprite = grassSprite || dirtSprite || waterSprite || null;
  const topFaceReferenceAnchorY = (
    topFaceReferenceSprite?.frame?.anchorY
    ?? topFaceReferenceSprite?.frame?.sourceH
    ?? topFaceReferenceSprite?.frame?.h
    ?? ISO_SOURCE_TILE_WIDTH
  ) * ISO_BASE_SCALE;
  const tileTopCenterY = computeTileTopCenterYFromGroundAnchor(
    groundY,
    topFaceReferenceAnchorY,
    ISO_TILE_HALF_HEIGHT_PX,
  );
  return { screenX, tileTopCenterY };
}

/**
 * Closest visible tile face in iso diamond distance (elevation-aware), matching rendered tiles.
 * Tie-break: smaller distance wins; equal distance → front-most tile (painter order).
 *
 * @returns {{ worldX: number, worldY: number, screenX: number, tileTopCenterY: number, tile: object } | null}
 */
export function pickTopTileAtScreen(
  sortedVisibleIsoTiles,
  gameState,
  cameraX,
  cameraY,
  originX,
  originY,
  pointerX,
  pointerY,
) {
  if (!sortedVisibleIsoTiles.length) {
    return null;
  }
  const halfW = ISO_TILE_HALF_WIDTH_PX;
  const halfH = ISO_TILE_HALF_HEIGHT_PX;
  let best = null;
  for (let i = sortedVisibleIsoTiles.length - 1; i >= 0; i -= 1) {
    const { worldX, worldY, tile } = sortedVisibleIsoTiles[i];
    const { screenX, tileTopCenterY } = tileTopCenterYForPick(
      gameState,
      worldX,
      worldY,
      tile,
      cameraX,
      cameraY,
      originX,
      originY,
    );
    const d = isoDiamondDistance(pointerX, pointerY, screenX, tileTopCenterY, halfW, halfH);
    if (
      !best
      || d < best.d - 1e-7
      || (Math.abs(d - best.d) <= 1e-7 && i > best.i)
    ) {
      best = {
        worldX,
        worldY,
        screenX,
        tileTopCenterY,
        tile,
        d,
        i,
      };
    }
  }
  if (!best) {
    return null;
  }
  return {
    worldX: best.worldX,
    worldY: best.worldY,
    screenX: best.screenX,
    tileTopCenterY: best.tileTopCenterY,
    tile: best.tile,
  };
}
