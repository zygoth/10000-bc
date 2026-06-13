/** Terrain sprites stay in the low band (insertion order among zIndex 0). */
export const ISO_TILE_TERRAIN_Z = 0;

/** Occupants + debris sort above terrain in this band. */
export const ISO_TILE_OCCUPANT_Z_BASE = 10000;

/**
 * Draw order within a tile for plants and falling debris.
 * Higher screen Y (lower on screen) draws in front; patch depthY breaks ties.
 * @param {number} layerX tile-local screen X
 * @param {number} layerY tile-local screen Y (foot / center)
 * @param {number} [zBias] patch layout depthY or spawn lift
 */
export function isoOccupantDepthZ(layerX, layerY, zBias = 0) {
  return ISO_TILE_OCCUPANT_Z_BASE
    + Math.round((Number(layerY) + Number(zBias)) * 10 + (Number(layerX) || 0) * 0.05);
}

/** @deprecated use isoOccupantDepthZ */
export function isoSpriteDepthZ(layerX, layerY, zBias = 0) {
  return isoOccupantDepthZ(layerX, layerY, zBias);
}
