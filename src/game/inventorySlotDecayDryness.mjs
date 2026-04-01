/**
 * Shared decay / dryness display helpers for inventory-style grids (HUD + drying rack).
 */

/** Spoilage amount 0 = fresh, 1 = fully spoiled (for bar length and green→red tint). */
export function computeSpoilageProgress(decayDaysRemaining, catalogDecayDays) {
  if (!Number.isFinite(catalogDecayDays) || catalogDecayDays <= 0) {
    return null;
  }
  if (!Number.isFinite(decayDaysRemaining)) {
    return null;
  }
  const raw = 1 - decayDaysRemaining / catalogDecayDays;
  return Math.max(0, Math.min(1, raw));
}

/** Interpolate bar color fresh green → spoiled red. */
export function spoilageProgressToBarColor(t) {
  const p = Math.max(0, Math.min(1, t));
  const r = Math.round(34 + (220 - 34) * p);
  const g = Math.round(197 + (38 - 197) * p);
  const b = Math.round(94 + (38 - 94) * p);
  return `rgb(${r},${g},${b})`;
}

/**
 * Native `title` tooltip for grid cells (inventory, stockpile, ground, rack).
 * @param {object} opts
 * @param {string} opts.name
 * @param {number} opts.totalWeightKg
 * @param {(kg: number) => string} opts.formatWeightLabel
 * @param {number|null} [opts.decayDays]
 * @param {number|null} [opts.decayDaysRemaining]
 * @param {number|null} [opts.drynessPercent] 0–100 or null
 * @param {boolean} [opts.isFullyDried]
 * @param {boolean} [opts.canDry] show dryness 0% when true even if stack has no dryness field
 */
export function buildInventoryGridItemTooltipTitle(opts) {
  const {
    name,
    totalWeightKg,
    formatWeightLabel,
    decayDays = null,
    decayDaysRemaining = null,
    drynessPercent = null,
    isFullyDried = false,
    canDry = false,
  } = opts;
  const parts = [`${name}`, `${formatWeightLabel(totalWeightKg ?? 0)}`];
  if (Number.isFinite(decayDaysRemaining)) {
    parts.push(`Decay: ~${Number(decayDaysRemaining).toFixed(1)} d until spoiled`);
  }
  if (Number.isFinite(decayDays) && decayDays > 0) {
    parts.push(`Base shelf life (mild): ~${decayDays} d`);
  }
  if (canDry || (drynessPercent != null && Number.isFinite(drynessPercent))) {
    if (isFullyDried || drynessPercent >= 100) {
      parts.push('Dryness: fully dry');
    } else {
      parts.push(`Dryness: ${Math.round(Number(drynessPercent) || 0)}%`);
    }
  }
  return parts.join(' · ');
}
