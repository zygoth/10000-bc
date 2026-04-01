import { resolveEffectiveReachTier } from '../harvestReachTier.mjs';

export function applyHarvestActionImpl(state, plantId, partName, subStageId, options = {}, deps) {
  const {
    PLANT_BY_ID,
    findPartAndSubStage,
    ensureHarvestEntryState,
    perActionVitalityDamage,
    clamp01,
  } = deps;
  const plant = state?.plants?.[plantId];
  if (!plant || !plant.alive) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'missing_plant' };
  }

  const species = PLANT_BY_ID[plant.speciesId];
  if (!species) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'missing_species' };
  }

  const { part, subStage } = findPartAndSubStage(species, partName, subStageId);
  if (!part || !subStage) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'missing_part_or_sub_stage' };
  }

  const entry = (plant.activeSubStages || []).find(
    (candidate) => candidate.partName === partName && candidate.subStageId === subStageId,
  );
  if (!entry) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'inactive_sub_stage' };
  }

  if (Number.isInteger(entry.regrowthCountdown) && entry.regrowthCountdown > 0) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'regrowing' };
  }

  const requestedActions = Math.max(1, Math.floor(options.actions ?? 1));
  const reachTier = typeof options?.reachTier === 'string'
    ? options.reachTier
    : resolveEffectiveReachTier(subStage, plant.stageName);
  // Direct callers (tests/utilities) historically bypass reach-tool validation.
  // Validation-backed action execution passes an explicit boolean here.
  const canAccessElevatedPool = options?.canAccessElevatedPool !== false;
  const canAccessCanopyPool = options?.canAccessCanopyPool !== false;
  ensureHarvestEntryState(entry, subStage, plant, species);

  let appliedActions = 0;
  let consumedGroundActions = 0;
  let consumedElevatedActions = 0;
  let consumedCanopyActions = 0;
  let vitalityLoss = 0;
  let depleted = false;

  function consumeOneHarvestAction() {
    if (reachTier === 'canopy') {
      if (canAccessCanopyPool) {
        if (entry.remainingActionsCanopy > 0) {
          entry.remainingActionsCanopy -= 1;
          consumedCanopyActions += 1;
          return true;
        }
        if (entry.remainingActionsElevated > 0) {
          entry.remainingActionsElevated -= 1;
          consumedElevatedActions += 1;
          return true;
        }
        if (entry.remainingActionsGround > 0) {
          entry.remainingActionsGround -= 1;
          consumedGroundActions += 1;
          return true;
        }
        return false;
      }
      if (entry.remainingActionsGround > 0) {
        entry.remainingActionsGround -= 1;
        consumedGroundActions += 1;
        return true;
      }
      if (canAccessElevatedPool && entry.remainingActionsElevated > 0) {
        entry.remainingActionsElevated -= 1;
        consumedElevatedActions += 1;
        return true;
      }
      return false;
    }

    if (reachTier === 'elevated') {
      if (canAccessElevatedPool && entry.remainingActionsElevated > 0) {
        entry.remainingActionsElevated -= 1;
        consumedElevatedActions += 1;
        return true;
      }
      if (entry.remainingActionsGround > 0) {
        entry.remainingActionsGround -= 1;
        consumedGroundActions += 1;
        return true;
      }
      if (canAccessElevatedPool && entry.remainingActionsElevated > 0) {
        entry.remainingActionsElevated -= 1;
        consumedElevatedActions += 1;
        return true;
      }
      return false;
    }

    if (entry.remainingActionsGround > 0) {
      entry.remainingActionsGround -= 1;
      consumedGroundActions += 1;
      return true;
    }
    return false;
  }

  while (appliedActions < requestedActions && plant.alive) {
    const remainingTotal = Math.max(0, Math.floor(Number(entry.remainingActionsGround) || 0))
      + Math.max(0, Math.floor(Number(entry.remainingActionsElevated) || 0))
      + Math.max(0, Math.floor(Number(entry.remainingActionsCanopy) || 0));
    entry.remainingActions = remainingTotal;
    if (remainingTotal <= 0) {
      break;
    }

    if (!consumeOneHarvestAction()) {
      break;
    }

    entry.remainingActions = Math.max(
      0,
      entry.remainingActionsGround + entry.remainingActionsElevated + entry.remainingActionsCanopy,
    );
    appliedActions += 1;

    const actionDamage = perActionVitalityDamage(subStage, entry);
    if (actionDamage > 0) {
      plant.vitality = clamp01(plant.vitality - actionDamage);
      entry.vitalityDamageAppliedThisSeason += actionDamage;
      vitalityLoss += actionDamage;
      if (plant.vitality <= 0) {
        plant.alive = false;
      }
    }

    if (entry.remainingActions <= 0) {
      depleted = true;
      entry.harvestsThisSeason += 1;

      const regrowthDays = Number.isInteger(subStage.regrowth_days) ? subStage.regrowth_days : null;
      const regrowthMax = Number.isInteger(subStage.regrowth_max_harvests) ? subStage.regrowth_max_harvests : null;
      const canRegrow = Number.isInteger(regrowthDays)
        && regrowthDays > 0
        && Number.isInteger(regrowthMax)
        && regrowthMax > 0
        && entry.harvestsThisSeason < regrowthMax;

      if (canRegrow) {
        entry.regrowthCountdown = regrowthDays;
        break;
      }

      plant.activeSubStages = (plant.activeSubStages || []).filter(
        (candidate) => !(candidate.partName === partName && candidate.subStageId === subStageId),
      );
      break;
    }
  }

  return {
    appliedActions,
    consumedGroundActions,
    consumedElevatedActions,
    consumedCanopyActions,
    remainingActionsGround: Math.max(0, Math.floor(Number(entry.remainingActionsGround) || 0)),
    remainingActionsElevated: Math.max(0, Math.floor(Number(entry.remainingActionsElevated) || 0)),
    remainingActionsCanopy: Math.max(0, Math.floor(Number(entry.remainingActionsCanopy) || 0)),
    vitalityLoss,
    depleted,
    blocked: appliedActions > 0 ? null : 'no_actions_remaining',
  };
}
