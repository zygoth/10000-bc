import { getSeason } from '../game/plantCatalog.mjs';
import {
  isMagicicadaEmergenceYear,
  MAGICICADA_SPECIES_ID,
} from '../game/magicicadaEmergence.mjs';
import { buildTileFeatureSnapshot } from './tileFeatures.mjs';
import { evaluatePopulationResponse } from './populationTerms.mjs';
import { mulberry32 } from './ambientMath.mjs';

/**
 * @typedef {{ speciesId: string, index: number, x: number, y: number }} AmbientEmitter
 */

/**
 * **Habitat map vs trapping map (e.g. turkey):** `buildYearWeightMaps` is **not** the same layer as
 * `getAnimalDensityAtTile` in `../game/simAnimalZones.mjs`. Today, mobile ambient weights come only from each
 * catalog entry’s `population_response` (moisture, shade, plant affinities, etc.), rebuilt on ambient year-bucket
 * boundaries via `syncAmbientLayerCache`. Land-trapping instead uses per-tile values in `state.animalDensityByZone`
 * after `generateAnimalZones` (and those densities move with daily catch / recovery for species in
 * `ANIMAL_CATALOG`). So e.g. `meleagris_gallopavo` *noise* follows the **habitat** model until we wire the two
 * together.
 *
 * **Intended direction:** entries that will represent trap-killable species should set `shared_trapping_species_id` to
 * the same string as the future `ANIMAL_CATALOG` id. When that species exists in the catalog and zones are generated,
 * per-tile ambient weight should be derived from the **trapping** density map (optionally **scaled** and
 * **multiplied** or **combined** with the habitat score so we still avoid sound where the animal cannot live). That
 * keeps gobbles / other calls where animals **actually** are, and allows ambient loudness/emitter counts to
 * **track depletion** from heavy trapping. If you need depletion to affect noise **inside** a 40-day ambient year
 * (not only on year-bucket refresh), add a more frequent or daily multiplier from `getAnimalDensityAtTile` in this
 * pipeline, or shorten the weight refresh interval for `shared_trapping` species.
 */

/**
 * Per-tile **habitat/season** weights for one calendar year in ambient; used for weight maps and emitter
 * distribution. See module comment: **trapping** density is not yet folded in for `shared_trapping_species_id`.
 *
 * @param {object} state
 * @param {object[]} mobileEntries catalog entries with audio_role ambient_mobile
 * @returns {Map<string, Float32Array>} speciesId -> per-tile weight (row-major width*height)
 */
export function buildYearWeightMaps(state, mobileEntries) {
  const w = Number(state?.width);
  const h = Number(state?.height);
  const tiles = state?.tiles;
  const maps = new Map();
  if (!Number.isInteger(w) || !Number.isInteger(h) || !Array.isArray(tiles) || mobileEntries.length === 0) {
    return maps;
  }
  const area = w * h;
  const dayOfYear = Number(state?.dayOfYear) || 1;
  const seasonKey = getSeason(dayOfYear);

  for (const entry of mobileEntries) {
    const sid = entry?.species_id;
    if (typeof sid !== 'string') {
      continue;
    }
    if (sid === MAGICICADA_SPECIES_ID && !isMagicicadaEmergenceYear(state)) {
      continue;
    }
    const arr = new Float32Array(area);
    for (let i = 0; i < area; i += 1) {
      const tile = tiles[i];
      const x = i % w;
      const y = Math.floor(i / w);
      const snap = buildTileFeatureSnapshot(tile, state, x, y);
      const ctx = { state, centerX: x, centerY: y };
      arr[i] = evaluatePopulationResponse(entry, snap, ctx, seasonKey, dayOfYear);
    }
    maps.set(sid, arr);
  }
  return maps;
}

/**
 * @param {Map<string, Float32Array>} weightMaps
 * @param {object[]} mobileEntries
 * @param {number} totalDaysSimulated
 * @param {number} mapSeed state.seed
 * @param {number} width map width
 */
export function placeDailyEmitters(weightMaps, mobileEntries, totalDaysSimulated, mapSeed, width) {
  /** @type {AmbientEmitter[]} */
  const out = [];
  const day = Math.max(0, Math.floor(Number(totalDaysSimulated) || 0));
  const mapW = Math.max(0, Math.floor(Number(width) || 0));
  if (mapW <= 0 || weightMaps.size === 0) {
    return out;
  }

  for (const entry of mobileEntries) {
    const sid = entry?.species_id;
    const weights = weightMaps.get(sid);
    if (!weights) {
      continue;
    }
    const area = weights.length;
    const height = Math.floor(area / mapW);
    const maxN = Math.max(0, Math.floor(Number(entry?.placement?.max_emitters_on_map) || 0));
    const perTileCap = Math.max(1, Math.floor(Number(entry?.placement?.max_emitters_per_tile) || 1));
    if (maxN <= 0) {
      continue;
    }
    const rng = mulberry32(
      (Number(mapSeed) || 0) * 1315423911
        + day * 2246822519
        + sid.split('').reduce((a, c) => a + c.charCodeAt(0), 0),
    );
    const tileCounts = new Uint16Array(area);
    for (let n = 0; n < maxN; n += 1) {
      let eligible = 0;
      for (let i = 0; i < area; i += 1) {
        if (tileCounts[i] < perTileCap) {
          eligible += weights[i];
        }
      }
      if (eligible <= 0) {
        break;
      }
      let r = rng() * eligible;
      let pick = -1;
      for (let i = 0; i < area; i += 1) {
        if (tileCounts[i] >= perTileCap) {
          continue;
        }
        r -= weights[i];
        if (r <= 0) {
          pick = i;
          break;
        }
      }
      if (pick < 0) {
        break;
      }
      tileCounts[pick] += 1;
      const x = pick % mapW;
      const y = Math.floor(pick / mapW);
      out.push({ speciesId: sid, index: n, x, y });
    }
  }
  return out;
}
