import { ensureHarvestEntryState } from './harvestEntryState.mjs';
import {
  catalogHarvestActionsMidpoint,
  scaledHarvestActionsCap,
  scaledUnitsPerHarvestActionMidpoint,
  unitsPerHarvestActionCatalogMidpoint,
} from './harvestYieldResolve.mjs';

/** Cap so patch-scaled mature plants do not spawn unbounded debris. */
export const WIND_DEBRIS_MAX_INSTANCE_FACTOR = 4;

function catalogMatureSubStageCountMidpoint(subStage) {
  const actions = Math.max(1, catalogHarvestActionsMidpoint(subStage));
  const units = Math.max(1, unitsPerHarvestActionCatalogMidpoint(subStage));
  return actions * units;
}

function scaledSubStageCountCap(subStage, species, plant) {
  const actions = Math.max(1, scaledHarvestActionsCap(subStage, species, plant));
  const units = Math.max(1, scaledUnitsPerHarvestActionMidpoint(subStage, species, plant));
  return actions * units;
}

function estimatedRemainingSubStageCount(activeEntry, subStage, species, plant) {
  ensureHarvestEntryState(activeEntry, subStage, plant, species);
  const remainingActions = Math.max(0, Math.floor(Number(activeEntry.remainingActions) || 0));
  if (remainingActions <= 0) {
    return 0;
  }
  const unitsPerAction = Math.max(1, scaledUnitsPerHarvestActionMidpoint(subStage, species, plant));
  return remainingActions * unitsPerAction;
}

/**
 * Spawn-rate multiplier from estimated harvestable units still on the plant
 * (`remainingActions × units_per_action`, with the same age/patch scaling as harvest).
 * @param {object} activeEntry
 * @param {object} subStage
 * @param {import('./plantCatalog.mjs').PlantDefinition} species
 * @param {object} plant
 */
export function windDebrisSubStageInstanceFactor(activeEntry, subStage, species, plant) {
  if (!activeEntry || !subStage || !species || !plant) {
    return 0;
  }
  const remainingCount = estimatedRemainingSubStageCount(activeEntry, subStage, species, plant);
  if (remainingCount <= 0) {
    return 0;
  }
  const catalogMid = Math.max(1, catalogMatureSubStageCountMidpoint(subStage));
  const factor = remainingCount / catalogMid;
  const cap = Math.max(1, scaledSubStageCountCap(subStage, species, plant));
  const capFactor = cap / catalogMid;
  return Math.min(WIND_DEBRIS_MAX_INSTANCE_FACTOR, factor, capFactor);
}
