import {
  FISH_DENSITY_VARIATION_MAX,
  FISH_DENSITY_VARIATION_MIN,
  FISH_LARGE_SCALE_CELL_SIZE,
  FISH_LARGE_SCALE_WEIGHT,
} from '../simCore.constants.mjs';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function fnv1aHash32(input) {
  const text = String(input ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return hash >>> 0;
}

function hashToUnitFloat(input) {
  return fnv1aHash32(input) / 0xFFFFFFFF;
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function smoothStep01(value) {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  return clamped * clamped * (3 - (2 * clamped));
}

function coherentFishNoise2D(seedToken, x, y, cellSize) {
  const safeCellSize = Math.max(1, Math.floor(Number(cellSize) || 1));
  const sx = (Number(x) || 0) / safeCellSize;
  const sy = (Number(y) || 0) / safeCellSize;

  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const tx = smoothStep01(sx - x0);
  const ty = smoothStep01(sy - y0);

  const v00 = hashToUnitFloat(`${seedToken}|${x0}|${y0}`);
  const v10 = hashToUnitFloat(`${seedToken}|${x1}|${y0}`);
  const v01 = hashToUnitFloat(`${seedToken}|${x0}|${y1}`);
  const v11 = hashToUnitFloat(`${seedToken}|${x1}|${y1}`);

  const top = lerp(v00, v10, tx);
  const bottom = lerp(v01, v11, tx);
  return lerp(top, bottom, ty);
}

export function deterministicFishTileVariationFactor(state, fishId, tile) {
  const normalizedSeed = Number.isFinite(Number(state?.seed))
    ? Math.abs(Math.floor(Number(state.seed)))
    : 0;
  const speciesToken = fishId || 'unknown_fish';
  const x = Number(tile?.x) || 0;
  const y = Number(tile?.y) || 0;
  const largeScaleNoise = coherentFishNoise2D(
    `fish_large|${normalizedSeed}|${speciesToken}`,
    x,
    y,
    FISH_LARGE_SCALE_CELL_SIZE,
  );
  const smallScaleNoise = hashToUnitFloat(`fish_small|${normalizedSeed}|${speciesToken}|${x}|${y}`);
  const normalized = clamp01(
    (largeScaleNoise * FISH_LARGE_SCALE_WEIGHT)
      + (smallScaleNoise * (1 - FISH_LARGE_SCALE_WEIGHT)),
  );
  const span = FISH_DENSITY_VARIATION_MAX - FISH_DENSITY_VARIATION_MIN;
  return FISH_DENSITY_VARIATION_MIN + (span * normalized);
}
