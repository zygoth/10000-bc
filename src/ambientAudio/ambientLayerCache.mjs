import { buildYearWeightMaps, placeDailyEmitters } from './buildAmbientLayer.mjs';

/**
 * Year weights here are the **habitat** layer from `buildYearWeightMaps`. For `ambient_mobile` species that map to
 * `shared_trapping_species_id` + `getAnimalDensityAtTile`, a future pass should apply trapping density in this
 * file or in `buildYearWeightMaps` so sound tracks realized populations; see `buildAmbientLayer.mjs` module
 * comment.
 *
 * 40-day calendar years in sim (dayOfYear 1–40, totalDaysSimulated increments once per sim day).
 * Year bucket advances when crossing …40 → 41…, etc.
 *
 * **Sim `state.year` vs bucket:** `getAmbientYearBucket` is derived from `totalDaysSimulated` only, while
 * `state.year` advances on `dayOfYear` wrap. Rebuild weights when the bucket or `state.year` changes
 * (e.g. periodical cicada). Also rebuild when **`dayOfYear` changes** — `population_response.calendar_timeline`
 * (day 1–40) depends on it; otherwise the first sim day in a “quiet” window can zero weights for the whole bucket.
 * @param {number} totalDaysSimulated
 * @returns {number} 0-based year index
 */
export function getAmbientYearBucket(totalDaysSimulated) {
  const tds = Math.max(0, Math.floor(Number(totalDaysSimulated) || 0));
  if (tds <= 0) {
    return 0;
  }
  return Math.floor((tds - 1) / 40);
}

/**
 * Per plan: **population / year weight maps** refresh on **year boundary** only.
 * **Emitter placement** refreshes on **each new sim day** (and whenever weights were rebuilt).
 *
 * @param {object} state
 * @param {object[]} mobileEntries
 * @param {{ cacheYearBucket?: number|null, cacheGameYear?: number|null, cacheDayOfYear?: number|null, cacheDay?: number|null, weightMaps?: Map|null, emitters?: unknown[]|null }} prev
 */
export function syncAmbientLayerCache(state, mobileEntries, prev = {}) {
  const tds = Math.max(0, Math.floor(Number(state?.totalDaysSimulated) || 0));
  const width = Number(state?.width) || 0;
  const yearBucket = getAmbientYearBucket(tds);
  const gameYear = Number(state?.year) || 1;
  const dayOfYear = Math.max(1, Math.min(40, Math.floor(Number(state?.dayOfYear) || 1)));

  let weightMaps = prev.weightMaps ?? null;
  let emitters = prev.emitters ?? null;
  const prevYear = prev.cacheYearBucket ?? null;
  const prevGameYear = prev.cacheGameYear;
  const prevDoy = prev.cacheDayOfYear;
  const prevDay = prev.cacheDay ?? null;

  let weightsRebuilt = false;
  const yearBucketChanged = yearBucket !== prevYear;
  const gameYearChanged = prevGameYear != null && gameYear !== prevGameYear;
  const dayOfYearChanged = prevDoy != null && dayOfYear !== prevDoy;
  if (!weightMaps || yearBucketChanged || gameYearChanged || dayOfYearChanged) {
    weightMaps = buildYearWeightMaps(state, mobileEntries);
    weightsRebuilt = true;
  }

  if (!emitters || tds !== prevDay || weightsRebuilt) {
    emitters = placeDailyEmitters(
      weightMaps,
      mobileEntries,
      tds,
      Number(state?.seed) || 0,
      width,
    );
  }

  return {
    weightMaps,
    emitters,
    cacheYearBucket: yearBucket,
    cacheGameYear: gameYear,
    cacheDayOfYear: dayOfYear,
    cacheDay: tds,
    weightsRebuilt,
  };
}
