import ANIMAL_CATALOG_SOURCE from './animalCatalog.source.mjs';
import { ITEM_BY_ID, assertKnownItemId } from './itemCatalog.mjs';

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
      return { ...output };
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

function normalizePart(rawPart, contextLabel) {
  const part = {
    ...rawPart,
    processing_options: normalizeProcessingOptions(rawPart?.processing_options, contextLabel),
  };

  const canonicalItem = ITEM_BY_ID[part.id];
  if (!canonicalItem) {
    return part;
  }

  return {
    ...part,
    unit_weight_g: canonicalItem.unit_weight_g,
    ...(Number.isFinite(canonicalItem.decay_days) ? { decay_days: canonicalItem.decay_days } : {}),
    can_dry: canonicalItem.can_dry,
    can_freeze: canonicalItem.can_freeze,
    craft_tags: Array.isArray(canonicalItem.craft_tags) ? [...canonicalItem.craft_tags] : [],
    ...(canonicalItem.nutrition ? { nutrition: { ...canonicalItem.nutrition } } : {}),
  };
}

function normalizeAnimal(rawAnimal) {
  const population = rawAnimal.population || {};
  const seasonModifiers = {
    spring: Number(population.season_modifiers?.spring ?? 1),
    summer: Number(population.season_modifiers?.summer ?? 1),
    fall: Number(population.season_modifiers?.fall ?? 1),
    winter: Number(population.season_modifiers?.winter ?? 1),
  };

  return {
    id: rawAnimal.id,
    name: rawAnimal.name || rawAnimal.id,
    animalClass: rawAnimal.animal_class || 'mammal',
    physicalDescription: rawAnimal.physical_description || '',
    habitat: Array.isArray(rawAnimal.habitat) ? [...rawAnimal.habitat] : [],
    waterRequired: rawAnimal.water_required === true,
    weightRangeGrams: Array.isArray(rawAnimal.weight_range_g) ? [...rawAnimal.weight_range_g] : [100, 100],
    behaviors: Array.isArray(rawAnimal.behaviors) ? [...rawAnimal.behaviors] : [],
    diet: Array.isArray(rawAnimal.diet) ? [...rawAnimal.diet] : [],
    population: {
      startingDensity: Number(population.starting_density ?? 0),
      densityPerCatch: Number(population.density_per_catch ?? 0),
      dailyRecovery: Number(population.daily_recovery ?? 0),
      spilloverRate: Number(population.spillover_rate ?? 0),
      depletionThreshold: Number(population.depletion_threshold ?? 0),
      hibernates: population.hibernates === true,
      seasonModifiers,
    },
    baseCatchRate: Number(rawAnimal.base_catch_rate ?? 0),
    rodCompatible: rawAnimal.rod_compatible !== false,
    currentSensitivity: Number(rawAnimal.current_sensitivity ?? 0),
    parts: Array.isArray(rawAnimal.parts)
      ? rawAnimal.parts.map((part, idx) => normalizePart(part, `${rawAnimal.id || 'unknown_animal'} part[${idx}]`))
      : [],
  };
}

export const ANIMAL_CATALOG = ANIMAL_CATALOG_SOURCE.map(normalizeAnimal);
export const ANIMAL_BY_ID = Object.fromEntries(ANIMAL_CATALOG.map((animal) => [animal.id, animal]));
