import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISPLAY_TEXTURE_CELL_PX,
  RASTER_TO_DISPLAY_FOR_MAIN_SHEET,
  RASTER_TO_DISPLAY_FOR_WORLD_SHEET,
  SVG_RASTER_CELL_PX,
  SVG_RASTER_CELL_PX_WORLD,
  rasterToDisplayRatioForCell,
} from './svgSheetRaster.mjs';

test('rasterToDisplayRatioForCell matches full vs world sheet constants', () => {
  assert.equal(rasterToDisplayRatioForCell(256), 4);
  assert.equal(rasterToDisplayRatioForCell(128), 2);
  assert.equal(RASTER_TO_DISPLAY_FOR_MAIN_SHEET, SVG_RASTER_CELL_PX / DISPLAY_TEXTURE_CELL_PX);
  assert.equal(RASTER_TO_DISPLAY_FOR_WORLD_SHEET, SVG_RASTER_CELL_PX_WORLD / DISPLAY_TEXTURE_CELL_PX);
});
