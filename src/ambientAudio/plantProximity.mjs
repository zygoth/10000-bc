import { chebyshev } from './ambientMath.mjs';

/**
 * Minimum Chebyshev distance from (x,y) to a tile that hosts any of `speciesIds`.
 * @returns {number|null} null if none within maxDistance
 */
export function minChebyshevToPlantSpecies(state, x, y, speciesIds, maxDistance) {
  if (!Array.isArray(speciesIds) || speciesIds.length === 0 || !state?.tiles) {
    return null;
  }
  const w = Number(state.width);
  const h = Number(state.height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }
  const idSet = new Set(speciesIds);
  let best = maxDistance + 1;
  for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
    for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > maxDistance) {
        continue;
      }
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
        continue;
      }
      const tile = state.tiles[ny * w + nx];
      const plantIds = Array.isArray(tile?.plantIds) ? tile.plantIds : [];
      for (const pid of plantIds) {
        const plant = state.plants?.[pid];
        const sid = plant?.speciesId || plant?.species_id;
        if (typeof sid === 'string' && idSet.has(sid)) {
          const d = chebyshev(x, y, nx, ny);
          if (d < best) {
            best = d;
          }
        }
      }
    }
  }
  return best <= maxDistance ? best : null;
}
