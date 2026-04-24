import { clamp01 } from './ambientMath.mjs';
import { minChebyshevToPlantSpecies } from './plantProximity.mjs';

/**
 * @param {object} snapshot from buildTileFeatureSnapshot
 * @param {object} term
 * @param {{ state: object, centerX: number, centerY: number }} context
 * @returns {number} non-negative factor (typically ~0..2)
 */
export function evaluatePopulationTerm(snapshot, term, context) {
  const kind = term?.kind;
  switch (kind) {
    case 'trapezoid':
      return evalTrapezoid(snapshot, term);
    case 'enum_weight':
      return evalEnumWeight(snapshot, term);
    case 'bool_weight':
      return evalBoolWeight(snapshot, term);
    case 'plant_affinity_neighbors':
      return evalPlantAffinity(term, context);
    default:
      throw new Error(`Unknown population term kind: ${kind}`);
  }
}

function evalTrapezoid(snapshot, term) {
  const key = term.feature;
  const v = Number(snapshot[key]);
  if (!Number.isFinite(v)) {
    return Number(term.floor) || 0;
  }
  const peak = Number(term.peak_at);
  const half = Math.max(1e-6, Number(term.half_width) || 0.1);
  const floor = Number(term.floor);
  const ceiling = Number(term.ceiling);
  const f = Number.isFinite(floor) ? floor : 0;
  const c = Number.isFinite(ceiling) ? ceiling : 1;
  const dist = Math.abs(v - peak);
  if (dist >= half) {
    return f;
  }
  const t = 1 - dist / half;
  return f + (c - f) * t;
}

function evalEnumWeight(snapshot, term) {
  const key = term.feature;
  const val = snapshot[key];
  const weights = term.weights && typeof term.weights === 'object' ? term.weights : {};
  const w = weights[val];
  return Number.isFinite(Number(w)) ? Math.max(0, Number(w)) : 0;
}

function evalBoolWeight(snapshot, term) {
  const key = term.feature;
  const v = Boolean(snapshot[key]);
  const t = v ? term.if_true : term.if_false;
  return Number.isFinite(Number(t)) ? Math.max(0, Number(t)) : 0;
}

function evalPlantAffinity(term, context) {
  const { state, centerX, centerY } = context;
  const ids = Array.isArray(term.target_plant_species_ids) ? term.target_plant_species_ids : [];
  const maxD = Math.max(0, Math.floor(Number(term.max_distance) || 0));
  const at0 = Number(term.at_distance_0);
  const beyond = Number(term.beyond_max);
  const a0 = Number.isFinite(at0) ? at0 : 1;
  const b = Number.isFinite(beyond) ? beyond : 0.85;
  if (!state || !Number.isInteger(centerX) || !Number.isInteger(centerY)) {
    return b;
  }
  const d = minChebyshevToPlantSpecies(state, centerX, centerY, ids, maxD);
  if (d === null) {
    return b;
  }
  if (maxD <= 0) {
    return a0;
  }
  const t = clamp01(d / maxD);
  return a0 + (b - a0) * t;
}

/**
 * Sim calendar is 1–40 (dayOfYear). First matching segment wins; else `default_relative` (0 if unset).
 * @param {object} pr population_response
 * @param {number} dayOfYear
 * @returns {number|null} null = use legacy season_multiplier_by_key
 */
function resolveCalendarTimelineMultiplier(pr, dayOfYear) {
  const cal = pr?.calendar_timeline;
  if (!cal || cal.kind !== 'day_segments' || !Array.isArray(cal.segments)) {
    return null;
  }
  const d = Math.max(1, Math.min(40, Math.floor(Number(dayOfYear) || 1)));
  for (const seg of cal.segments) {
    const from = Number(seg.from_day);
    const to = Number(seg.to_day);
    const rel = Number(seg.relative);
    if (Number.isFinite(from) && Number.isFinite(to) && d >= from && d <= to && Number.isFinite(rel)) {
      return Math.max(0, rel);
    }
  }
  const def = Number(cal.default_relative);
  return Number.isFinite(def) ? Math.max(0, def) : 0;
}

/**
 * @param {string} seasonKey from getSeason(dayOfYear)
 * @param {number} [dayOfYear=1] 1–40; used when `calendar_timeline` is set
 */
export function evaluatePopulationResponse(entry, snapshot, context, seasonKey, dayOfYear = 1) {
  const pr = entry?.population_response;
  if (!pr || typeof pr !== 'object') {
    return 0;
  }
  const base = Number(pr.base);
  const b = Number.isFinite(base) ? Math.max(0, base) : 0;
  const calMult = resolveCalendarTimelineMultiplier(pr, dayOfYear);
  const mult = pr.season_multiplier_by_key?.[seasonKey];
  const season = calMult != null
    ? calMult
    : (Number.isFinite(Number(mult)) ? Math.max(0, Number(mult)) : 1);
  const terms = Array.isArray(pr.terms) ? pr.terms : [];
  let product = 1;
  for (const term of terms) {
    product *= evaluatePopulationTerm(snapshot, term, context);
  }
  let w = b * season * product;
  const clamp = pr.weight_clamp;
  if (Array.isArray(clamp) && clamp.length === 2) {
    const lo = Number(clamp[0]);
    const hi = Number(clamp[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      w = Math.max(lo, Math.min(hi, w));
    }
  }
  return w;
}
