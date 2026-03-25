import { PLANT_BY_ID, getSeason } from './plantCatalog.mjs';
import { GROUND_FUNGUS_CATALOG } from './groundFungusCatalog.mjs';
import { formatPlantPartLabel, parsePlantPartItemId } from './plantPartDescriptors.mjs';

const TREATMENT_RECIPES_BY_TAG = Object.freeze({
  tannin_tea: {
    treatmentTag: 'tannin_tea',
    itemId: 'juglans_nigra:bark:rough',
    quantity: 1,
  },
});

export const MAX_VISIONS_PER_SEASON = 2;
export const VISION_NEXT_DAY_TICK_COST = 50;

export function runDebriefMedicinePass(state, options = {}) {
  const removeCampStockpileItem = typeof options?.removeCampStockpileItem === 'function'
    ? options.removeCampStockpileItem
    : null;
  const targetConditionInstanceId = typeof options?.targetConditionInstanceId === 'string'
    ? options.targetConditionInstanceId
    : null;
  const includeOnlyInstance = Boolean(targetConditionInstanceId);
  const camp = state?.camp;
  if (!camp || typeof camp !== 'object') {
    return {
      medicineRequests: [],
      medicineNotifications: [],
    };
  }

  const medicineRequests = [];
  const medicineNotifications = [];

  for (const [actorId, actor] of Object.entries(state?.actors || {})) {
    if ((Number(actor?.health) || 0) <= 0) {
      continue;
    }
    const conditions = Array.isArray(actor?.conditions) ? actor.conditions : [];
    for (const condition of conditions) {
      if (!condition || condition.treated === true) {
        continue;
      }
      if (includeOnlyInstance && condition.instance_id !== targetConditionInstanceId) {
        continue;
      }
      const tags = Array.isArray(condition?.treatable_by)
        ? condition.treatable_by.filter((entry) => typeof entry === 'string' && entry)
        : [];
      if (tags.length <= 0) {
        continue;
      }

      const recipe = resolveTreatmentRecipe(tags);
      if (!recipe) {
        continue;
      }

      const descriptor = parsePlantPartItemId(recipe.itemId);
      if (!descriptor) {
        continue;
      }
      if (!isPlantPartObtainableOnMap(state, recipe.itemId, recipe.quantity)) {
        continue;
      }

      const stockpileQty = getCampStockpileQuantity(camp, recipe.itemId);
      const actorLabel = actorIdToLabel(actorId);
      const conditionLabel = conditionIdToLabel(condition.condition_id);
      if (stockpileQty >= recipe.quantity) {
        const removed = removeCampStockpileItem
          ? removeCampStockpileItem(camp, recipe.itemId, recipe.quantity)
          : { consumed: recipe.quantity };
        const consumed = Math.floor(Number(removed?.consumed) || 0);
        if (consumed >= recipe.quantity) {
          condition.treated = true;
          medicineNotifications.push({
            actorId,
            actorLabel,
            conditionId: condition.condition_id || '',
            conditionInstanceId: condition.instance_id || '',
            treatmentTag: recipe.treatmentTag,
            itemId: recipe.itemId,
            quantity: recipe.quantity,
            speciesId: descriptor.speciesId,
            plantName: descriptor.speciesName,
            partName: descriptor.partName,
            subStageId: descriptor.subStageId,
            label: formatPlantPartLabel(descriptor, { includeSubStage: true }),
            message: `Partner treated ${actorLabel}'s ${conditionLabel} with ${descriptor.speciesName}.`,
          });
          continue;
        }
      }

      medicineRequests.push({
        requestType: 'medicine',
        actorId,
        actorLabel,
        conditionId: condition.condition_id || '',
        conditionLabel,
        conditionInstanceId: condition.instance_id || '',
        treatmentTag: recipe.treatmentTag,
        itemId: recipe.itemId,
        quantity: recipe.quantity,
        speciesId: descriptor.speciesId,
        plantName: descriptor.speciesName,
        partName: descriptor.partName,
        subStageId: descriptor.subStageId,
        partLabel: descriptor.partLabel,
        subStageLabel: descriptor.subStageLabel,
        displayName: formatPlantPartLabel(descriptor, { includeSubStage: true }),
        spriteRef: resolveMedicinePlantSpriteRef(recipe.itemId),
      });
    }
  }

  return {
    medicineRequests,
    medicineNotifications,
  };
}

function resolveTreatmentRecipe(tags) {
  for (const tag of tags) {
    const recipe = TREATMENT_RECIPES_BY_TAG[tag];
    if (recipe?.itemId && Number.isInteger(recipe.quantity) && recipe.quantity > 0) {
      return recipe;
    }
  }
  return null;
}

function getCampStockpileQuantity(camp, itemId) {
  const stacks = Array.isArray(camp?.stockpile?.stacks) ? camp.stockpile.stacks : [];
  let total = 0;
  for (const stack of stacks) {
    if (stack?.itemId !== itemId) {
      continue;
    }
    total += Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  }
  return total;
}

function isPlantPartObtainableOnMap(state, itemId, requiredQuantity) {
  const descriptor = parsePlantPartItemId(itemId);
  if (!descriptor) {
    return false;
  }
  let matchingPlants = 0;
  for (const plant of Object.values(state?.plants || {})) {
    if (!plant || plant.alive === false || plant.speciesId !== descriptor.speciesId) {
      continue;
    }
    const matchesSubStage = Array.isArray(plant?.activeSubStages)
      && plant.activeSubStages.some(
        (entry) => entry?.partName === descriptor.partName && entry?.subStageId === descriptor.subStageId,
      );
    if (matchesSubStage) {
      matchingPlants += 1;
    }
  }
  return matchingPlants >= Math.max(1, Number(requiredQuantity) || 1);
}

function actorIdToLabel(actorId) {
  if (typeof actorId !== 'string' || !actorId) {
    return 'Family member';
  }
  if (actorId === 'player') {
    return 'Player';
  }
  if (actorId === 'partner') {
    return 'Partner';
  }
  return actorId
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function conditionIdToLabel(conditionId) {
  if (typeof conditionId !== 'string' || !conditionId) {
    return 'condition';
  }
  return conditionId
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function resolveMedicinePlantSpriteRef(itemId) {
  const descriptor = parsePlantPartItemId(itemId);
  if (!descriptor) {
    return null;
  }
  const species = PLANT_BY_ID[descriptor.speciesId] || null;
  const firstLifeStage = Array.isArray(species?.lifeStages) && species.lifeStages.length > 0
    ? species.lifeStages[0].stage
    : null;
  return firstLifeStage ? `${descriptor.speciesId}:${firstLifeStage}` : descriptor.speciesId;
}

export function resolveCurrentSeasonKey(state) {
  const day = Number(state?.dayOfYear) || 1;
  return getSeason(day);
}

export function runDebriefVisionRequest(state, options = {}) {
  const camp = state?.camp;
  if (!camp || typeof camp !== 'object') {
    return {
      visionRequest: null,
      visionSelectionOptions: [],
      requiresVisionConfirmation: false,
      visionNotifications: [],
      visionConsumed: false,
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
      seasonKey: resolveCurrentSeasonKey(state),
      blockedByCooldown: false,
    };
  }

  const seasonKey = resolveCurrentSeasonKey(state);
  const uses = Number.isInteger(camp?.debrief?.visionUsesThisSeason)
    ? camp.debrief.visionUsesThisSeason
    : 0;
  if (uses >= MAX_VISIONS_PER_SEASON) {
    return {
      visionRequest: null,
      visionSelectionOptions: [],
      requiresVisionConfirmation: false,
      visionNotifications: [],
      visionConsumed: false,
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
      seasonKey,
      blockedByCooldown: true,
    };
  }

  const recipes = resolveVisionRecipes(state);
  if (recipes.length <= 0) {
    return {
      visionRequest: null,
      visionSelectionOptions: [],
      requiresVisionConfirmation: false,
      visionNotifications: [],
      visionConsumed: false,
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
      seasonKey,
      blockedByCooldown: false,
    };
  }
  const recipe = recipes[0];

  const availableRecipes = resolveAvailableVisionRecipesFromStockpile(camp, recipes);
  if (availableRecipes.length > 0) {
    return {
      visionRequest: null,
      visionSelectionOptions: availableRecipes.map((entry) => ({
        itemId: entry.itemId,
        quantity: entry.quantity,
        speciesId: entry.descriptor.speciesId,
        plantName: entry.descriptor.speciesName,
        partName: entry.descriptor.partName,
        subStageId: entry.descriptor.subStageId,
        partLabel: entry.descriptor.partLabel,
        subStageLabel: entry.descriptor.subStageLabel,
        displayName: formatPlantPartLabel(entry.descriptor, { includeSubStage: true }),
        sourceType: entry.sourceType,
        visionCategories: entry.visionCategories,
      })),
      requiresVisionConfirmation: true,
      visionNotifications: [],
      visionConsumed: false,
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
      seasonKey,
      blockedByCooldown: false,
    };
  }

  return {
    visionRequest: {
      requestType: 'vision',
      itemId: recipe.itemId,
      quantity: recipe.quantity,
      speciesId: recipe.descriptor.speciesId,
      plantName: recipe.descriptor.speciesName,
      partName: recipe.descriptor.partName,
      subStageId: recipe.descriptor.subStageId,
      partLabel: recipe.descriptor.partLabel,
      subStageLabel: recipe.descriptor.subStageLabel,
      displayName: formatPlantPartLabel(recipe.descriptor, { includeSubStage: true }),
      spriteRef: recipe.sourceType === 'ground_fungus'
        ? recipe.descriptor.speciesId
        : resolveMedicinePlantSpriteRef(recipe.itemId),
      visionCategories: recipe.visionCategories,
      message: 'Partner needs this plant and part to induce a vision.',
    },
    visionSelectionOptions: [],
    requiresVisionConfirmation: false,
    visionNotifications: [],
    visionConsumed: false,
    pendingVisionRevelation: null,
    nextDayTickPenalty: 0,
    seasonKey,
    blockedByCooldown: false,
  };
}

export function runDebriefVisionConfirm(state, options = {}) {
  const selectedItemId = typeof options?.selectedItemId === 'string' ? options.selectedItemId : '';
  const removeCampStockpileItem = typeof options?.removeCampStockpileItem === 'function'
    ? options.removeCampStockpileItem
    : null;
  const camp = state?.camp;
  if (!camp || typeof camp !== 'object') {
    return {
      visionConsumed: false,
      visionNotifications: [],
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
    };
  }
  const recipes = resolveVisionRecipes(state);
  if (recipes.length <= 0) {
    return {
      visionConsumed: false,
      visionNotifications: [],
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
    };
  }
  const optionsInStockpile = resolveAvailableVisionRecipesFromStockpile(camp, recipes);
  const selected = optionsInStockpile.find((entry) => entry.itemId === selectedItemId) || null;
  if (!selected || !removeCampStockpileItem) {
    return {
      visionConsumed: false,
      visionNotifications: [],
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
    };
  }
  const removed = removeCampStockpileItem(camp, selected.itemId, selected.quantity);
  const consumed = Math.floor(Number(removed?.consumed) || 0);
  if (consumed < selected.quantity) {
    return {
      visionConsumed: false,
      visionNotifications: [],
      pendingVisionRevelation: null,
      nextDayTickPenalty: 0,
    };
  }
  return {
    visionConsumed: true,
    visionNotifications: [
      {
        itemId: selected.itemId,
        speciesId: selected.descriptor.speciesId,
        plantName: selected.descriptor.speciesName,
        partName: selected.descriptor.partName,
        subStageId: selected.descriptor.subStageId,
        quantity: selected.quantity,
        message: `Partner prepared ${selected.descriptor.speciesName} for a vision.`,
      },
    ],
    pendingVisionRevelation: {
      sourceItemId: selected.itemId,
      sourceSpeciesId: selected.descriptor.speciesId,
      sourceType: selected.sourceType,
      visionCategories: selected.visionCategories,
      sightDurationDays: selected.sightDurationDays,
    },
    nextDayTickPenalty: VISION_NEXT_DAY_TICK_COST,
  };
}

function resolveVisionRecipes(state) {
  const recipes = [];
  for (const species of GROUND_FUNGUS_CATALOG) {
    const effect = findHallucinogenVisionEffect(species?.ingestion);
    if (!effect) {
      continue;
    }
    const quantity = Math.max(1, Math.floor(Number(species?.ingestion?.vision_item?.quantity_per_dose || 1)));
    const itemId = `${species.id}:fruiting_body:whole`;
    const descriptor = {
      speciesId: species.id,
      speciesName: species.commonName || species.id,
      partName: 'fruiting_body',
      subStageId: 'whole',
      partLabel: 'Fruiting Body',
      subStageLabel: 'Whole',
    };
    if (!isGroundFungusObtainableOnMap(state, species.id, quantity)) {
      continue;
    }
    recipes.push({
      sourceType: 'ground_fungus',
      itemId,
      quantity,
      descriptor,
      visionCategories: effect.visionCategories,
      sightDurationDays: effect.sightDurationDays,
    });
  }

  for (const species of Object.values(PLANT_BY_ID)) {
    const parts = Array.isArray(species?.parts) ? species.parts : [];
    for (const part of parts) {
      const subStages = Array.isArray(part?.subStages) ? part.subStages : [];
      for (const subStage of subStages) {
        const effect = findHallucinogenVisionEffect(subStage?.ingestion);
        if (!effect) {
          continue;
        }
        const itemId = `${species.id}:${part.name}:${subStage.id}`;
        const descriptor = parsePlantPartItemId(itemId);
        if (!descriptor) {
          continue;
        }
        const quantity = 1;
        if (!isPlantPartObtainableOnMap(state, itemId, quantity)) {
          continue;
        }
        recipes.push({
          sourceType: 'plant',
          itemId,
          quantity,
          descriptor,
          visionCategories: effect.visionCategories,
          sightDurationDays: effect.sightDurationDays,
        });
      }
    }
  }

  return recipes;
}

function resolveAvailableVisionRecipesFromStockpile(camp, recipes) {
  const available = [];
  for (const recipe of Array.isArray(recipes) ? recipes : []) {
    const stockpileQty = getCampStockpileQuantity(camp, recipe.itemId);
    if (stockpileQty >= recipe.quantity) {
      available.push(recipe);
    }
  }
  return available;
}

function findHallucinogenVisionEffect(ingestion) {
  const bands = Array.isArray(ingestion?.dose_response) ? ingestion.dose_response : [];
  for (const band of bands) {
    const effects = Array.isArray(band?.effects) ? band.effects : [];
    for (const effect of effects) {
      if (effect?.type !== 'hallucinogen') {
        continue;
      }
      if (effect?.partner_prep_required !== true) {
        continue;
      }
      const visionCategoriesRaw = Array.isArray(effect?.vision_categories)
        ? effect.vision_categories
        : [];
      const visionCategories = visionCategoriesRaw
        .filter((entry) => typeof entry === 'string' && entry)
        .map((entry) => entry.toLowerCase());
      if (visionCategories.length <= 0) {
        continue;
      }
      const uniqueCategories = [...new Set(visionCategories)];
      const sightDurationDays = Number.isInteger(effect?.sight_duration_days)
        ? Math.max(1, effect.sight_duration_days)
        : Math.max(1, Math.floor(Number(effect?.sight_duration_days || 5)));
      return {
        visionCategories: uniqueCategories,
        sightDurationDays,
      };
    }
  }
  return null;
}

function isGroundFungusObtainableOnMap(state, speciesId, requiredQuantity) {
  let matchingTiles = 0;
  for (const tile of state?.tiles || []) {
    if (tile?.groundFungusZone?.speciesId === speciesId) {
      matchingTiles += 1;
    }
  }
  return matchingTiles >= Math.max(1, Number(requiredQuantity) || 1);
}

export function resolveVisionRevelationChoices(pendingRevelation) {
  const categories = Array.isArray(pendingRevelation?.visionCategories)
    ? pendingRevelation.visionCategories
    : [];
  const normalized = [...new Set(categories.filter((entry) => typeof entry === 'string' && entry))];
  return normalized.map((category) => {
    if (category === 'sight') {
      return {
        category,
        rewardId: 'nature_sight',
        rewardLabel: 'The Nature Sight',
      };
    }
    if (category === 'plant') {
      return {
        category,
        rewardId: 'plant_knowledge',
        rewardLabel: 'Plant Knowledge',
      };
    }
    return {
      category,
      rewardId: 'tech_knowledge',
      rewardLabel: 'Tech Knowledge',
    };
  });
}
