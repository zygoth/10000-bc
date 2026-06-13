import { computeWorldPanLayerPixelsForSyncAnchor } from '../isoCameraRoll.js';
import { ISO_TILE_HALF_HEIGHT_PX, ISO_TILE_HALF_WIDTH_PX } from '../isoConstants.js';
import {
  computeScreenViewportBounds,
  computeViewportScrollDelta,
  isOnScreen,
  wrapScreenPosition,
} from './windDustViewport.mjs';

describe('windDustViewport', () => {
  it('computeViewportScrollDelta is zero on first frame', () => {
    const curr = {
      panPx: 4,
      panPy: -2,
      originX: 640,
      originY: 400,
      baseCamX: 32,
      baseCamY: 35,
    };
    expect(computeViewportScrollDelta(null, curr)).toEqual({ dx: 0, dy: 0 });
  });

  it('computeViewportScrollDelta matches pan-only motion for fractional camera roll', () => {
    const baseCamX = 32;
    const baseCamY = 35;
    const prevPan = computeWorldPanLayerPixelsForSyncAnchor(32, 35, baseCamX, baseCamY);
    const currPan = computeWorldPanLayerPixelsForSyncAnchor(32.5, 35.2, baseCamX, baseCamY);
    const prev = {
      panPx: prevPan.px,
      panPy: prevPan.py,
      originX: 640,
      originY: 400,
      baseCamX,
      baseCamY,
    };
    const curr = {
      panPx: currPan.px,
      panPy: currPan.py,
      originX: 640,
      originY: 400,
      baseCamX,
      baseCamY,
    };
    const d = computeViewportScrollDelta(prev, curr);
    expect(d.dx).toBeCloseTo(currPan.px - prevPan.px, 5);
    expect(d.dy).toBeCloseTo(currPan.py - prevPan.py, 5);
  });

  it('computeViewportScrollDelta does not double-count camera float when pan already moved', () => {
    const prev = {
      panPx: 0,
      panPy: 0,
      originX: 640,
      originY: 400,
      baseCamX: 32,
      baseCamY: 35,
    };
    const currPan = computeWorldPanLayerPixelsForSyncAnchor(32.1, 35, 32, 35);
    const curr = {
      panPx: currPan.px,
      panPy: currPan.py,
      originX: 640,
      originY: 400,
      baseCamX: 32,
      baseCamY: 35,
    };
    const d = computeViewportScrollDelta(prev, curr);
    expect(d.dx).toBeCloseTo(currPan.px, 5);
    expect(d.dy).toBeCloseTo(currPan.py, 5);
    expect(d.dx).not.toBeCloseTo(currPan.px * 2, 5);
  });

  it('computeViewportScrollDelta includes origin jumps from sync', () => {
    const prev = {
      panPx: 0,
      panPy: 0,
      originX: 640,
      originY: 400,
      baseCamX: 33,
      baseCamY: 35,
    };
    const curr = { ...prev, originX: 600, originY: 380 };
    const d = computeViewportScrollDelta(prev, curr);
    expect(d.dx).toBe(-40);
    expect(d.dy).toBe(-20);
  });

  it('computeViewportScrollDelta is zero when sync re-anchors without camera motion', () => {
    const camX = 33;
    const camY = 35;
    const prevPan = computeWorldPanLayerPixelsForSyncAnchor(camX, camY, 32, 35);
    const currPan = computeWorldPanLayerPixelsForSyncAnchor(camX, camY, 33, 35);
    const prev = {
      panPx: prevPan.px,
      panPy: prevPan.py,
      originX: 640,
      originY: 400,
      baseCamX: 32,
      baseCamY: 35,
    };
    const curr = {
      panPx: currPan.px,
      panPy: currPan.py,
      originX: 640,
      originY: 400,
      baseCamX: 33,
      baseCamY: 35,
    };
    const d = computeViewportScrollDelta(prev, curr);
    expect(d.dx).toBeCloseTo(0, 5);
    expect(d.dy).toBeCloseTo(0, 5);
  });

  it('computeViewportScrollDelta stays smooth across a tile edge before sync', () => {
    const prevPan = computeWorldPanLayerPixelsForSyncAnchor(32.9, 35, 32, 35);
    const currPan = computeWorldPanLayerPixelsForSyncAnchor(33.1, 35, 32, 35);
    const prev = {
      panPx: prevPan.px,
      panPy: prevPan.py,
      originX: 640,
      originY: 400,
      baseCamX: 32,
      baseCamY: 35,
    };
    const curr = {
      panPx: currPan.px,
      panPy: currPan.py,
      originX: 640,
      originY: 400,
      baseCamX: 32,
      baseCamY: 35,
    };
    const d = computeViewportScrollDelta(prev, curr);
    expect(Math.abs(d.dx)).toBeLessThan(20);
    expect(Math.abs(d.dy)).toBeLessThan(20);
  });

  it('computeViewportScrollDelta includes sync tile-anchor steps with camera motion', () => {
    const prevPan = computeWorldPanLayerPixelsForSyncAnchor(32.9, 35, 32, 35);
    const currPan = computeWorldPanLayerPixelsForSyncAnchor(33, 35, 33, 35);
    const prev = {
      panPx: prevPan.px,
      panPy: prevPan.py,
      originX: 640,
      originY: 400,
      baseCamX: 32,
      baseCamY: 35,
    };
    const curr = {
      panPx: currPan.px,
      panPy: currPan.py,
      originX: 640,
      originY: 400,
      baseCamX: 33,
      baseCamY: 35,
    };
    const d = computeViewportScrollDelta(prev, curr);
    const expectedDx =
      (currPan.px - prevPan.px) - (1 - 0) * ISO_TILE_HALF_WIDTH_PX;
    const expectedDy =
      (currPan.py - prevPan.py) - (1 + 0) * ISO_TILE_HALF_HEIGHT_PX;
    expect(d.dx).toBeCloseTo(expectedDx, 5);
    expect(d.dy).toBeCloseTo(expectedDy, 5);
  });

  it('computeScreenViewportBounds pads edges', () => {
    const b = computeScreenViewportBounds(800, 600, 20);
    expect(b.minX).toBe(-20);
    expect(b.maxX).toBe(820);
  });

  it('isOnScreen respects margin', () => {
    expect(isOnScreen(400, 300, 800, 600, 0)).toBe(true);
    expect(isOnScreen(900, 300, 800, 600, 0)).toBe(false);
    expect(isOnScreen(810, 300, 800, 600, 20)).toBe(true);
  });

  it('wrapScreenPosition moves off-left particles to the right edge', () => {
    const wrapped = wrapScreenPosition(-12, 200, 800, 600, 0);
    expect(wrapped.sx).toBeCloseTo(788, 5);
    expect(wrapped.sy).toBe(200);
  });

  it('wrapScreenPosition moves off-right particles to the left edge', () => {
    const wrapped = wrapScreenPosition(820, 100, 800, 600, 0);
    expect(wrapped.sx).toBeCloseTo(20, 5);
    expect(wrapped.sy).toBe(100);
  });

  it('wrapScreenPosition handles large scroll overshoot in one step', () => {
    const wrapped = wrapScreenPosition(-1700, -50, 800, 600, 0);
    expect(wrapped.sx).toBeCloseTo(700, 5);
    expect(wrapped.sy).toBeCloseTo(550, 5);
  });
});
