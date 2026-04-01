import { resolveEffectiveReachTier } from './harvestReachTier.mjs';
import { scaledHarvestActionsCap } from './harvestYieldResolve.mjs';

export function findPartAndSubStage(species, partName, subStageId) {
  const part = (species.parts || []).find((candidate) => candidate.name === partName);
  if (!part) {
    return { part: null, subStage: null };
  }

  const subStage = (part.subStages || []).find((candidate) => candidate.id === subStageId) || null;
  return { part, subStage };
}

function normalizeHarvestActionPoolValue(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  return Math.max(0, Math.floor(Number(value)));
}

function resolveHarvestCyclePoolDefaults(subStage, fallbackActions, effectiveReachTier, harvestYield) {
  const fallback = Math.max(1, Math.floor(Number(fallbackActions) || 1));
  const reachTier = typeof effectiveReachTier === 'string' && effectiveReachTier
    ? effectiveReachTier
    : resolveEffectiveReachTier(subStage, null);
  const hy = harvestYield || subStage?.harvest_yield;
  const groundAuthored = normalizeHarvestActionPoolValue(
    subStage?.remaining_actions_ground ?? hy?.remaining_actions_ground,
  );
  const elevatedAuthored = normalizeHarvestActionPoolValue(
    subStage?.remaining_actions_elevated ?? hy?.remaining_actions_elevated,
  );
  const canopyAuthored = normalizeHarvestActionPoolValue(
    subStage?.remaining_actions_canopy ?? hy?.remaining_actions_canopy,
  );

  const hasAuthoredPools = groundAuthored !== null || elevatedAuthored !== null || canopyAuthored !== null;
  if (!hasAuthoredPools) {
    if (reachTier === 'ground') {
      return { ground: fallback, elevated: 0, canopy: 0 };
    }
    if (reachTier === 'canopy') {
      const gafRaw = Number(hy?.ground_action_fraction);
      const eafRaw = Number(hy?.elevated_action_fraction);
      const gaf = Number.isFinite(gafRaw) ? Math.max(0, Math.min(1, gafRaw)) : 0;
      const eaf = Number.isFinite(eafRaw) ? Math.max(0, Math.min(1, eafRaw)) : 0;
      if (gaf > 0 || eaf > 0) {
        let ground = Math.max(0, Math.floor(fallback * gaf));
        let elevated = Math.max(0, Math.floor(fallback * eaf));
        const sumFracPools = ground + elevated;
        if (sumFracPools > fallback) {
          const scale = fallback / Math.max(1, sumFracPools);
          ground = Math.max(0, Math.floor(ground * scale));
          elevated = Math.max(0, Math.floor(elevated * scale));
        }
        const canopy = Math.max(0, fallback - ground - elevated);
        return { ground, elevated, canopy };
      }
      return { ground: 0, elevated: 0, canopy: fallback };
    }
    return { ground: 0, elevated: fallback, canopy: 0 };
  }

  return {
    ground: groundAuthored ?? (reachTier === 'ground' ? fallback : 0),
    elevated: elevatedAuthored ?? (reachTier === 'ground' ? 0 : fallback),
    canopy: canopyAuthored ?? (reachTier === 'canopy' ? fallback : 0),
  };
}

function migrateLegacyRemainingActionsByReachTier(remainingActions, reachTier) {
  const remaining = Math.max(0, Math.floor(Number(remainingActions) || 0));
  if (reachTier === 'ground') {
    return { ground: remaining, elevated: 0, canopy: 0 };
  }
  if (reachTier === 'canopy') {
    return { ground: 0, elevated: 0, canopy: remaining };
  }
  return { ground: 0, elevated: remaining, canopy: 0 };
}

export function ensureHarvestEntryState(entry, subStage, plant, species) {
  if (!entry || !subStage || !plant || !species) {
    return;
  }

  const lifeStageName = typeof plant.stageName === 'string' ? plant.stageName : '';
  const effectiveReach = resolveEffectiveReachTier(subStage, lifeStageName);
  const canonicalReach = typeof subStage?.reach_tier === 'string' ? subStage.reach_tier : 'ground';
  const harvestYield = subStage?.harvest_yield;

  const scaledActionsCap = scaledHarvestActionsCap(subStage, species, plant);
  const cyclePoolDefaults = resolveHarvestCyclePoolDefaults(subStage, scaledActionsCap, effectiveReach, harvestYield);
  const hasLegacyInitialRoll = Number.isInteger(entry.initialActionsRoll) && entry.initialActionsRoll > 0;
  const hasInitialGround = Number.isInteger(entry.initialActionsGround) && entry.initialActionsGround >= 0;
  const hasInitialElevated = Number.isInteger(entry.initialActionsElevated) && entry.initialActionsElevated >= 0;
  const hasInitialCanopy = Number.isInteger(entry.initialActionsCanopy) && entry.initialActionsCanopy >= 0;
  if (!hasInitialGround && !hasInitialElevated && !hasInitialCanopy && hasLegacyInitialRoll) {
    const migratedInitial = migrateLegacyRemainingActionsByReachTier(entry.initialActionsRoll, effectiveReach);
    entry.initialActionsGround = migratedInitial.ground;
    entry.initialActionsElevated = migratedInitial.elevated;
    entry.initialActionsCanopy = migratedInitial.canopy;
  } else {
    if (!hasInitialGround) {
      entry.initialActionsGround = cyclePoolDefaults.ground;
    }
    if (!hasInitialElevated) {
      entry.initialActionsElevated = cyclePoolDefaults.elevated;
    }
    if (!hasInitialCanopy) {
      entry.initialActionsCanopy = cyclePoolDefaults.canopy;
    }
  }

  let initialTotal = entry.initialActionsGround + entry.initialActionsElevated + entry.initialActionsCanopy;
  if (initialTotal <= 0) {
    if (Number.isInteger(entry.initialActionsRoll) && entry.initialActionsRoll > 0) {
      const migrated = migrateLegacyRemainingActionsByReachTier(entry.initialActionsRoll, effectiveReach);
      entry.initialActionsGround = migrated.ground;
      entry.initialActionsElevated = migrated.elevated;
      entry.initialActionsCanopy = migrated.canopy;
      initialTotal = entry.initialActionsRoll;
    } else {
      entry.initialActionsGround = cyclePoolDefaults.ground;
      entry.initialActionsElevated = cyclePoolDefaults.elevated;
      entry.initialActionsCanopy = cyclePoolDefaults.canopy;
      initialTotal = entry.initialActionsGround + entry.initialActionsElevated + entry.initialActionsCanopy;
      if (initialTotal <= 0) {
        entry.initialActionsGround = Math.max(1, scaledActionsCap);
        entry.initialActionsElevated = 0;
        entry.initialActionsCanopy = 0;
        initialTotal = entry.initialActionsGround;
      }
    }
  }
  entry.initialActionsRoll = initialTotal;

  const regrowthMax = Number.isInteger(subStage.regrowth_max_harvests) && subStage.regrowth_max_harvests > 0
    ? subStage.regrowth_max_harvests
    : 1;
  entry.seasonalHarvestBudgetActions = Math.max(1, entry.initialActionsRoll * regrowthMax);

  const hasGroundRemaining = Number.isInteger(entry.remainingActionsGround) && entry.remainingActionsGround >= 0;
  const hasElevatedRemaining = Number.isInteger(entry.remainingActionsElevated) && entry.remainingActionsElevated >= 0;
  const hasCanopyRemaining = Number.isInteger(entry.remainingActionsCanopy) && entry.remainingActionsCanopy >= 0;
  const legacyRemaining = Number.isInteger(entry.remainingActions) && entry.remainingActions >= 0
    ? entry.remainingActions
    : null;
  const migratedRemaining = legacyRemaining !== null
    ? migrateLegacyRemainingActionsByReachTier(legacyRemaining, effectiveReach)
    : null;

  if (!hasGroundRemaining) {
    if (migratedRemaining) {
      entry.remainingActionsGround = migratedRemaining.ground;
    } else {
      entry.remainingActionsGround = entry.initialActionsGround;
    }
  }
  if (!hasElevatedRemaining) {
    if (migratedRemaining) {
      entry.remainingActionsElevated = migratedRemaining.elevated;
    } else {
      entry.remainingActionsElevated = entry.initialActionsElevated;
    }
  }
  if (!hasCanopyRemaining) {
    if (migratedRemaining) {
      entry.remainingActionsCanopy = migratedRemaining.canopy;
    } else {
      entry.remainingActionsCanopy = entry.initialActionsCanopy;
    }
  }

  entry.remainingActionsGround = Math.max(0, Math.floor(Number(entry.remainingActionsGround) || 0));
  entry.remainingActionsElevated = Math.max(0, Math.floor(Number(entry.remainingActionsElevated) || 0));
  entry.remainingActionsCanopy = Math.max(0, Math.floor(Number(entry.remainingActionsCanopy) || 0));
  entry.remainingActions = entry.remainingActionsGround + entry.remainingActionsElevated + entry.remainingActionsCanopy;

  if (!Number.isInteger(entry.remainingActions) || entry.remainingActions < 0) {
    entry.remainingActions = entry.initialActionsRoll;
  }

  function rematchPoolsToEffectiveReach() {
    const totalRem = entry.remainingActionsGround + entry.remainingActionsElevated + entry.remainingActionsCanopy;
    const migratedRem = migrateLegacyRemainingActionsByReachTier(totalRem, effectiveReach);
    entry.remainingActionsGround = migratedRem.ground;
    entry.remainingActionsElevated = migratedRem.elevated;
    entry.remainingActionsCanopy = migratedRem.canopy;
    const totalInit = entry.initialActionsGround + entry.initialActionsElevated + entry.initialActionsCanopy;
    const migratedInit = migrateLegacyRemainingActionsByReachTier(totalInit, effectiveReach);
    entry.initialActionsGround = migratedInit.ground;
    entry.initialActionsElevated = migratedInit.elevated;
    entry.initialActionsCanopy = migratedInit.canopy;
    entry.initialActionsRoll = Math.max(0, totalInit);
    entry.seasonalHarvestBudgetActions = Math.max(1, entry.initialActionsRoll * regrowthMax);
    entry.remainingActions = entry.remainingActionsGround + entry.remainingActionsElevated + entry.remainingActionsCanopy;
  }

  if (entry.harvestPoolLayoutTier != null && entry.harvestPoolLayoutTier !== effectiveReach) {
    rematchPoolsToEffectiveReach();
  } else if (entry.harvestPoolLayoutTier == null && effectiveReach !== canonicalReach) {
    rematchPoolsToEffectiveReach();
  }
  entry.harvestPoolLayoutTier = effectiveReach;

  const targetTotal = scaledHarvestActionsCap(subStage, species, plant);
  const initSum = entry.initialActionsGround + entry.initialActionsElevated + entry.initialActionsCanopy;
  const remSum = entry.remainingActionsGround + entry.remainingActionsElevated + entry.remainingActionsCanopy;
  if (initSum > 0 && initSum !== targetTotal) {
    const newR = Math.max(0, Math.min(targetTotal, Math.round(remSum * targetTotal / Math.max(1, initSum))));
    const newInitPools = resolveHarvestCyclePoolDefaults(subStage, targetTotal, effectiveReach, harvestYield);
    entry.initialActionsGround = newInitPools.ground;
    entry.initialActionsElevated = newInitPools.elevated;
    entry.initialActionsCanopy = newInitPools.canopy;
    entry.initialActionsRoll = targetTotal;
    entry.seasonalHarvestBudgetActions = Math.max(1, entry.initialActionsRoll * regrowthMax);

    if (remSum <= 0) {
      entry.remainingActionsGround = entry.initialActionsGround;
      entry.remainingActionsElevated = entry.initialActionsElevated;
      entry.remainingActionsCanopy = entry.initialActionsCanopy;
    } else {
      let rg = Math.round(newR * entry.remainingActionsGround / remSum);
      let re = Math.round(newR * entry.remainingActionsElevated / remSum);
      let rc = Math.round(newR * entry.remainingActionsCanopy / remSum);
      let drift = newR - rg - re - rc;
      if (drift !== 0) {
        const pick = rg >= re && rg >= rc ? 'g' : (re >= rc ? 'e' : 'c');
        if (pick === 'g') {
          rg += drift;
        } else if (pick === 'e') {
          re += drift;
        } else {
          rc += drift;
        }
      }
      entry.remainingActionsGround = Math.max(0, rg);
      entry.remainingActionsElevated = Math.max(0, re);
      entry.remainingActionsCanopy = Math.max(0, rc);
    }
    entry.remainingActions = entry.remainingActionsGround + entry.remainingActionsElevated + entry.remainingActionsCanopy;
  }

  if (!Number.isInteger(entry.harvestsThisSeason) || entry.harvestsThisSeason < 0) {
    entry.harvestsThisSeason = 0;
  }
  if (!Number.isFinite(entry.vitalityDamageAppliedThisSeason) || entry.vitalityDamageAppliedThisSeason < 0) {
    entry.vitalityDamageAppliedThisSeason = 0;
  }
  if (entry.regrowthCountdown === undefined) {
    entry.regrowthCountdown = null;
  }
}
