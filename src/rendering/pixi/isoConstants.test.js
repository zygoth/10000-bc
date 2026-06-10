import {
  elevationToIsoOffsetPx,
  ISO_VISUALIZE_TILE_ELEVATION,
} from './isoConstants.js';

describe('isoConstants elevationToIsoOffsetPx', () => {
  it('returns 0 for all elevations when ISO_VISUALIZE_TILE_ELEVATION is false', () => {
    expect(ISO_VISUALIZE_TILE_ELEVATION).toBe(false);
    expect(elevationToIsoOffsetPx(0)).toBe(0);
    expect(elevationToIsoOffsetPx(0.5)).toBe(0);
    expect(elevationToIsoOffsetPx(1)).toBe(0);
  });
});
