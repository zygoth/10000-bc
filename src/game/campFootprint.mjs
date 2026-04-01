/**
 * Camp footprint matches UI “inside camp tiles” (GDD + simCore getCampFootprintBounds).
 */

export function getCampFootprintBounds(state) {
  const anchorX = Number(state?.camp?.anchorX);
  const anchorY = Number(state?.camp?.anchorY);
  if (!Number.isInteger(anchorX) || !Number.isInteger(anchorY)) {
    return null;
  }
  return {
    minX: anchorX - 1,
    maxX: anchorX + 2,
    minY: anchorY - 1,
    maxY: anchorY + 2,
  };
}

export function isTileWithinCampFootprint(state, x, y) {
  const bounds = getCampFootprintBounds(state);
  if (!bounds || !Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

export function isActorWithinCampFootprint(state, actor) {
  const x = Number(actor?.x);
  const y = Number(actor?.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }
  return isTileWithinCampFootprint(state, x, y);
}
