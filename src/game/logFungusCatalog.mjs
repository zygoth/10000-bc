import LOG_FUNGUS_CATALOG_SOURCE from './logFungusCatalog.source.mjs';

const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];

function seasonBounds(season) {
  const index = SEASON_ORDER.indexOf(season);
  if (index === -1) {
    return null;
  }

  const start = index * 10 + 1;
  return { start, end: start + 9 };
}

function seasonalLabelToDay(label) {
  if (!label) {
    return null;
  }

  const [part, season] = label.split('_');
  const bounds = seasonBounds(season || part);
  if (!bounds) {
    return null;
  }

  if (!season) {
    return bounds;
  }

  if (part === 'early') {
    return { start: bounds.start, end: bounds.start + 2 };
  }

  if (part === 'mid') {
    return { start: bounds.start + 3, end: bounds.start + 6 };
  }

  if (part === 'late') {
    return { start: bounds.start + 7, end: bounds.end };
  }

  return null;
}

function normalizeSeasonalWindow(window) {
  if (!window) {
    return null;
  }

  if (typeof window.start_day === 'number' && typeof window.end_day === 'number') {
    return { startDay: window.start_day, endDay: window.end_day };
  }

  const start = seasonalLabelToDay(window.start);
  const end = seasonalLabelToDay(window.end);
  if (!start || !end) {
    return null;
  }

  return { startDay: start.start, endDay: end.end };
}

function normalizeLogFungus(rawFungus) {
  return {
    id: rawFungus.id,
    type: rawFungus.type || 'log_fungus',
    commonName: rawFungus.common_name || rawFungus.id,
    latinName: rawFungus.latin_name || rawFungus.id,
    hostTrees: Array.isArray(rawFungus.host_trees) ? [...rawFungus.host_trees] : [],
    preferredDecayStages: Array.isArray(rawFungus.preferred_decay_stages)
      ? rawFungus.preferred_decay_stages.map((value) => Math.max(1, Math.min(4, Math.round(Number(value) || 1))))
      : [2, 3],
    baseSpawnChance: Number(rawFungus.base_spawn_chance) || 0,
    fruitingWindows: (rawFungus.fruiting_windows || [])
      .map((window) => normalizeSeasonalWindow(window))
      .filter(Boolean),
    perLogYieldRange: Array.isArray(rawFungus.per_log_yield_range)
      ? [...rawFungus.per_log_yield_range]
      : [100, 300],
  };
}

export const LOG_FUNGUS_CATALOG = LOG_FUNGUS_CATALOG_SOURCE.map(normalizeLogFungus);
export const LOG_FUNGUS_BY_ID = Object.fromEntries(LOG_FUNGUS_CATALOG.map((fungus) => [fungus.id, fungus]));

export function isDayInLogWindow(dayOfYear, window) {
  if (!window) {
    return true;
  }

  if (window.endDay >= window.startDay) {
    return dayOfYear >= window.startDay && dayOfYear <= window.endDay;
  }

  return dayOfYear >= window.startDay || dayOfYear <= window.endDay;
}
