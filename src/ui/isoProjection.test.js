import {
  computeOccupantAnchorYFromTileTop,
  computeTileTopCenterY,
  computeTileTopCenterYFromGroundAnchor,
} from './isoProjection.js';

describe('isoProjection anchoring', () => {
  it('moves occupant anchor with tile elevation offset', () => {
    const screenY = 400;
    const lowElevationOffset = 10;
    const highElevationOffset = 46;
    const nudgePx = 28;

    const lowTileTop = computeTileTopCenterY(screenY, lowElevationOffset);
    const highTileTop = computeTileTopCenterY(screenY, highElevationOffset);

    const lowAnchor = computeOccupantAnchorYFromTileTop(lowTileTop, nudgePx);
    const highAnchor = computeOccupantAnchorYFromTileTop(highTileTop, nudgePx);

    expect(highAnchor - lowAnchor).toBe(-(highElevationOffset - lowElevationOffset));
  });

  it('keeps a stable local offset from tile top center', () => {
    const tileTopY = 312;
    const nudgePx = 28;

    const anchorY = computeOccupantAnchorYFromTileTop(tileTopY, nudgePx);
    expect(anchorY - tileTopY).toBe(nudgePx);
  });

  it('derives tile top center from rendered terrain anchor', () => {
    const groundY = 420;
    const halfCubeFootAnchorY = 52;
    const isoHalfHeightPx = 32;

    const tileTopY = computeTileTopCenterYFromGroundAnchor(groundY, halfCubeFootAnchorY, isoHalfHeightPx);
    expect(tileTopY).toBe(400);
  });
});
