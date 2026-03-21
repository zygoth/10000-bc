import GROUND_FUNGUS_CATALOG_SOURCE from './groundFungusCatalog.source.mjs';

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

function normalizeToleranceRange(rawRange) {
  if (Array.isArray(rawRange) && rawRange.length === 2) {
    const min = Math.max(0, Math.min(1, Number(rawRange[0])));
    const max = Math.max(0, Math.min(1, Number(rawRange[1])));
    return [Math.min(min, max), Math.max(min, max)];
  }

  return [0, 1];
}

function normalizeGroundFungus(rawFungus) {
  const drainageToleranceRange = normalizeToleranceRange(rawFungus.soil_requirements?.drainage?.tolerance_range);
  const fertilityToleranceRange = normalizeToleranceRange(rawFungus.soil_requirements?.fertility?.tolerance_range);
  const moistureToleranceRange = normalizeToleranceRange(rawFungus.soil_requirements?.moisture?.tolerance_range);
  const shadeToleranceRange = normalizeToleranceRange(rawFungus.soil_requirements?.shade?.tolerance_range);

  return {
    id: rawFungus.id,
    type: rawFungus.type || 'ground_fungus',
    commonName: rawFungus.common_name || rawFungus.id,
    latinName: rawFungus.latin_name || rawFungus.id,
    zoneCountRange: rawFungus.zone_count_range || [15, 40],
    zoneRadiusRange: rawFungus.zone_radius_range || [2, 5],
    annualFruitChance: Number(rawFungus.annual_fruit_chance) || 0,
    soilRequirements: {
      ...(rawFungus.soil_requirements || {}),
      drainage: {
        ...(rawFungus.soil_requirements?.drainage || {}),
        tolerance_range: drainageToleranceRange,
      },
      fertility: {
        ...(rawFungus.soil_requirements?.fertility || {}),
        tolerance_range: fertilityToleranceRange,
      },
      moisture: {
        ...(rawFungus.soil_requirements?.moisture || {}),
        tolerance_range: moistureToleranceRange,
      },
      shade: {
        ...(rawFungus.soil_requirements?.shade || {}),
        tolerance_range: shadeToleranceRange,
      },
    },
    fruitingWindows: (rawFungus.fruiting_windows || [])
      .map((window) => normalizeSeasonalWindow(window))
      .filter(Boolean),
    perTileYieldRange: rawFungus.per_tile_yield_range || [1, 1],
  };
}

export const GROUND_FUNGUS_CATALOG = GROUND_FUNGUS_CATALOG_SOURCE.map(normalizeGroundFungus);
export const GROUND_FUNGUS_BY_ID = Object.fromEntries(
  GROUND_FUNGUS_CATALOG.map((fungus) => [fungus.id, fungus]),
);

export function isDayInSeasonWindow(dayOfYear, window) {
  if (!window) {
    return true;
  }

  if (window.endDay >= window.startDay) {
    return dayOfYear >= window.startDay && dayOfYear <= window.endDay;
  }

  return dayOfYear >= window.startDay || dayOfYear <= window.endDay;
}
