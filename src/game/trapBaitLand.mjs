import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { PLANT_BY_ID } from './plantCatalog.mjs';
import { parsePlantPartItemId } from './plantPartDescriptors.mjs';
import { DEADFALL_MAX_CATCH_WEIGHT_G } from './simCore.constants.mjs';

export const SIMPLE_SNARE_TARGET_SPECIES_ID = 'sylvilagus_floridanus';

export function listDeadfallLandTrapCandidateSpeciesIds() {
  return Object.values(ANIMAL_BY_ID || {})
    .filter((species) => {
      const waterRequired = species?.waterRequired === true || species?.water_required === true;
      const animalClass = typeof species?.animalClass === 'string' ? species.animalClass : species?.animal_class;
      if (!species || waterRequired || animalClass === 'fish') {
        return false;
      }
      const weightRange = Array.isArray(species?.weightRangeGrams)
        ? species.weightRangeGrams
        : Array.isArray(species?.weight_range_g) ? species.weight_range_g : [];
      const minWeight = Number(weightRange[0]);
      return Number.isFinite(minWeight) && minWeight <= DEADFALL_MAX_CATCH_WEIGHT_G;
    })
    .map((species) => species.id)
    .filter((speciesId) => typeof speciesId === 'string' && speciesId)
    .sort();
}

export function animalDietIncludesPlant(animalSpeciesId, plantSpeciesId) {
  if (typeof animalSpeciesId !== 'string' || !animalSpeciesId
    || typeof plantSpeciesId !== 'string' || !plantSpeciesId) {
    return false;
  }
  const animal = ANIMAL_BY_ID[animalSpeciesId];
  const diet = Array.isArray(animal?.diet) ? animal.diet : [];
  return diet.includes(plantSpeciesId);
}

/** True if this plant species appears in the diet of at least one deadfall-eligible land animal. */
export function plantSpeciesEligibleForDeadfallLandBait(plantSpeciesId) {
  const candidates = listDeadfallLandTrapCandidateSpeciesIds();
  for (let i = 0; i < candidates.length; i += 1) {
    if (animalDietIncludesPlant(candidates[i], plantSpeciesId)) {
      return true;
    }
  }
  return false;
}

/** True if this plant species appears in the simple-snare target species' diet. */
export function plantSpeciesEligibleForSimpleSnareBait(plantSpeciesId) {
  return animalDietIncludesPlant(SIMPLE_SNARE_TARGET_SPECIES_ID, plantSpeciesId);
}

/**
 * Land traps (snare, deadfall) use plant-part inventory items as bait (GDD §12.1):
 * the bait's plant species id must appear in the target animal's `diet` array.
 * When it matches, catch rate is multiplied by (1 + plant.scent.strength), clamped.
 */
export function parseLandTrapBaitPlantSpeciesId(itemId) {
  const parsed = parsePlantPartItemId(itemId);
  return typeof parsed?.speciesId === 'string' && parsed.speciesId ? parsed.speciesId : null;
}

export function getPlantScentStrengthForLandTrapBait(plantSpeciesId) {
  const plant = PLANT_BY_ID[plantSpeciesId];
  const raw = Number(plant?.scent?.strength);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.min(1, raw));
}

/** Per GDD: scent_strength 0.8 → 1.8× effective catch term for that species roll. */
export function landTrapBaitMultiplierForTargetSpecies(baitItemId, targetAnimalSpeciesId) {
  const plantSpeciesId = parseLandTrapBaitPlantSpeciesId(baitItemId);
  if (!plantSpeciesId) {
    return 1;
  }
  if (!animalDietIncludesPlant(targetAnimalSpeciesId, plantSpeciesId)) {
    return 1;
  }
  const scent = getPlantScentStrengthForLandTrapBait(plantSpeciesId);
  return 1 + scent;
}
