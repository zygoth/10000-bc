export function computeTileTopCenterY(screenY, elevationOffsetPx) {
  return Number(screenY) - Number(elevationOffsetPx || 0);
}

export function computeTileTopCenterYFromGroundAnchor(groundY, footAnchorY, isoHalfHeightPx) {
  return Number(groundY) - Number(footAnchorY || 0) + Number(isoHalfHeightPx || 0);
}

export function computeOccupantAnchorYFromTileTop(tileTopCenterY, visualNudgePx = 0) {
  return Number(tileTopCenterY) + Number(visualNudgePx || 0);
}
