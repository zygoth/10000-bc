import PLANT_CATALOG_SOURCE from './plantCatalog.source.mjs';
import { assertKnownItemId } from './itemCatalog.mjs';

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

function normalizeOptionalUnitInterval(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(1, parsed));
}

function normalizeProcessingOutputs(outputs, contextLabel) {
  if (!Array.isArray(outputs)) {
    return [];
  }

  return outputs.map((output, idx) => {
    if (!output || typeof output !== 'object') {
      return output;
    }

    if (typeof output.itemId === 'string' && output.itemId) {
      assertKnownItemId(output.itemId, `${contextLabel} output[${idx}].itemId`);
    }

    return { ...output };
  });
}

function normalizeProcessingOptions(options, contextLabel) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option, idx) => {
    if (!option || typeof option !== 'object') {
      return option;
    }

    return {
      ...option,
      outputs: normalizeProcessingOutputs(option.outputs, `${contextLabel} processing_options[${idx}]`),
    };
  });
}

export function getSeason(dayOfYear) {
  if (dayOfYear <= 10) {
    return 'spring';
  }
  if (dayOfYear <= 20) {
    return 'summer';
  }
  if (dayOfYear <= 30) {
    return 'fall';
  }
  return 'winter';
}

function normalizePlant(rawPlant) {
  const shadeToleranceRange = normalizeToleranceRange(rawPlant.soil?.shade?.tolerance_range);
  const drainageToleranceRange = normalizeToleranceRange(rawPlant.soil?.drainage?.tolerance_range);
  const fertilityToleranceRange = normalizeToleranceRange(rawPlant.soil?.fertility?.tolerance_range);
  const moistureToleranceRange = normalizeToleranceRange(rawPlant.soil?.moisture?.tolerance_range);
  const normalizedSoil = {
    ...rawPlant.soil,
    drainage: {
      ...(rawPlant.soil?.drainage || {}),
      tolerance_range: drainageToleranceRange,
    },
    fertility: {
      ...(rawPlant.soil?.fertility || {}),
      tolerance_range: fertilityToleranceRange,
    },
    moisture: {
      ...(rawPlant.soil?.moisture || {}),
      tolerance_range: moistureToleranceRange,
    },
    shade: {
      ...(rawPlant.soil?.shade || {}),
      tolerance_range: shadeToleranceRange,
    },
  };
  const normalizedParts = (rawPlant.parts || []).map((part) => ({
    ...part,
    availableLifeStages: part.available_life_stages || [],
    subStages: (part.sub_stages || []).map((subStage) => ({
      ...subStage,
      harvestYieldFullAgeDays: subStage.harvest_yield_full_age_days ?? subStage.harvestYieldFullAgeDays,
      harvestUnitWeightScalesWithAge: subStage.harvest_unit_weight_scales_with_age === true
        || subStage.harvestUnitWeightScalesWithAge === true,
      seasonalWindow: normalizeSeasonalWindow(subStage.seasonal_window),
      tannin_level: normalizeOptionalUnitInterval(subStage.tannin_level),
      processing_options: normalizeProcessingOptions(
        subStage.processing_options,
        `${rawPlant.id || 'unknown_plant'}:${part.name || 'unknown_part'}:${subStage.id || 'unknown_sub_stage'}`,
      ),
    })),
  }));

  return {
    id: rawPlant.id,
    name: rawPlant.name,
    longevity: rawPlant.longevity,
    ageOfMaturity: rawPlant.age_of_maturity,
    soil: normalizedSoil,
    seedingWindow: normalizeSeasonalWindow(rawPlant.seeding_window),
    dispersal: rawPlant.dispersal,
    parts: normalizedParts,
    ingestion: rawPlant.ingestion && typeof rawPlant.ingestion === 'object'
      ? { ...rawPlant.ingestion }
      : null,
    lifeStages: rawPlant.life_stages.map((stage) => ({
      ...stage,
      seasonalWindow: normalizeSeasonalWindow(stage.seasonal_window),
    })),
  };
}

export const PLANT_CATALOG = PLANT_CATALOG_SOURCE.map(normalizePlant);

export const PLANT_BY_ID = Object.fromEntries(PLANT_CATALOG.map((plant) => [plant.id, plant]));

export function isDayInWindow(dayOfYear, window) {
  if (!window) {
    return true;
  }

  return dayOfYear >= window.startDay && dayOfYear <= window.endDay;
}
