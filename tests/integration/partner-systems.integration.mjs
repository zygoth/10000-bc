import assert from 'node:assert/strict';
import { validateAction } from '../../src/game/simCore.mjs';
import { HUNGER_DRAIN_PER_TICK, HUNGER_BAR_CALORIES } from '../../src/game/simCore.constants.mjs';
import {
  applyAction,
  createScenarioState,
  idleTicks,
} from './helpers/scenarioHarness.mjs';
import { assertDeathEndsRun } from './helpers/assertions.mjs';

function runDebriefEnterExitFlowTest() {
  let state = createScenarioState();
  state.dayTick = 220;

  state = applyAction(state, {
    actorId: 'player',
    kind: 'debrief_enter',
    payload: {},
  });
  assert.equal(state.camp.debrief.active, true, 'debrief_enter should activate debrief state');

  state = applyAction(state, {
    actorId: 'player',
    kind: 'debrief_exit',
    payload: {},
  });
  assert.equal(state.camp.debrief.active, false, 'debrief_exit should close debrief state');
}

function runMealPlanSetCommitFlowTest() {
  let state = createScenarioState();
  state.camp.stockpile.stacks = [
    { itemId: 'fat', quantity: 4, freshness: 1, decayDaysRemaining: 20 },
  ];

  const setValidation = validateAction(state, {
    actorId: 'player',
    kind: 'meal_plan_set',
    payload: { ingredients: [{ itemId: 'fat', quantity: 2 }] },
  });
  assert.equal(setValidation.ok, true, 'meal_plan_set should validate at camp with stockpile ingredients');
  assert.ok(setValidation.mealPlanPreview, 'meal_plan_set should return a preview payload');

  state = applyAction(state, {
    actorId: 'player',
    kind: 'meal_plan_set',
    payload: { ingredients: [{ itemId: 'fat', quantity: 2 }] },
  });
  assert.equal(state.camp.mealPlan.ingredients.length, 1, 'meal plan should persist selected ingredient');

  state = applyAction(state, {
    actorId: 'player',
    kind: 'meal_plan_commit',
    payload: {},
  });
  assert.ok(state.camp.lastMealResult, 'meal_plan_commit should produce camp lastMealResult');
}

function runBeginDayStewThenNightDrainTest() {
  // Validate the intended ordering: stew commit happens at night start tick,
  // then remaining ticks drain hunger into morning.
  let state = createScenarioState();
  state.dayTick = 200;
  state.actors.player.hunger = 0.75;
  state.actors.partner.hunger = 0.75;
  state.camp.stockpile.stacks = [
    { itemId: 'fat', quantity: 20, freshness: 1, decayDaysRemaining: 20 },
  ];

  const setValidation = validateAction(state, {
    actorId: 'player',
    kind: 'meal_plan_set',
    payload: { ingredients: [{ itemId: 'fat', quantity: 8 }] },
  });
  assert.equal(setValidation.ok, true, 'meal_plan_set should validate for fat ingredients');
  const previewCalories = Number(setValidation.mealPlanPreview?.totalNutrition?.calories) || 0;
  assert.ok(previewCalories > 0, 'test requires non-zero stew preview calories');

  state = applyAction(state, {
    actorId: 'player',
    kind: 'meal_plan_set',
    payload: { ingredients: [{ itemId: 'fat', quantity: 8 }] },
  });

  const hungerBeforeCommit = Number(state.actors.player.hunger) || 0;
  state = applyAction(state, {
    actorId: 'player',
    kind: 'meal_plan_commit',
    payload: {},
  });
  const hungerAfterCommit = Number(state.actors.player.hunger) || 0;
  assert.ok(hungerAfterCommit > hungerBeforeCommit, 'stew commit should raise hunger immediately at night start');

  const nightTicksRemaining = 400 - 200;
  const expectedDrain = nightTicksRemaining * (Number(HUNGER_DRAIN_PER_TICK) || 0);
  state = idleTicks(state, nightTicksRemaining);
  const hungerAtMorning = Number(state.actors.player.hunger) || 0;

  // Hunger should have drained by roughly the remaining-ticks drain amount.
  // (Allow minor floating error and clamp effects.)
  assert.ok(
    hungerAtMorning <= hungerAfterCommit - (expectedDrain * 0.9),
    `hunger should drain after stew; expected ~${expectedDrain.toFixed(4)} bar drain`,
  );

  // Sanity: the drain corresponds to 1000 calories over half a day.
  const expectedCaloriesDrain = expectedDrain * (Number(HUNGER_BAR_CALORIES) || 0);
  assert.ok(
    Math.abs(expectedCaloriesDrain - 1000) < 1e-6,
    'half-day night drain should represent ~1000 calories',
  );
}

function runStewCanRefillMultiDayDeficitTest() {
  // With a large hunger deficit, stew should be able to refill more than dailyCalories.
  let state = createScenarioState();
  state.dayTick = 200;
  state.actors.player.hunger = 0.5; // 4000 cal deficit on an 8000-cal bar
  state.actors.partner.hunger = 0.5;
  state.camp.stockpile.stacks = [
    // fat is 70 cal each; 120 units = 8400 cal total pot => 4200 share each
    { itemId: 'fat', quantity: 120, freshness: 1, decayDaysRemaining: 20 },
  ];

  const setValidation = validateAction(state, {
    actorId: 'player',
    kind: 'meal_plan_set',
    payload: { ingredients: [{ itemId: 'fat', quantity: 120 }] },
  });
  assert.equal(setValidation.ok, true, 'meal_plan_set should validate for high-calorie stew plan');
  const perActor = Array.isArray(setValidation.mealPlanPreview?.perActor) ? setValidation.mealPlanPreview.perActor : [];
  const playerRow = perActor.find((row) => row.actorId === 'player') || null;
  assert.ok(playerRow, 'preview should include player allocation');
  assert.ok(
    Number(playerRow.effectiveCalories) > 2000,
    'stew should be able to allocate more than daily calories when hunger deficit is larger',
  );
}

function runMealPlanCarcassNutritionPreviewTest() {
  let state = createScenarioState();
  state.dayTick = 220;
  state.camp.stockpile.stacks = [
    { itemId: 'sylvilagus_floridanus:carcass', quantity: 1, freshness: 1, decayDaysRemaining: 3, unitWeightKg: 1.2 },
  ];

  const setValidation = validateAction(state, {
    actorId: 'player',
    kind: 'meal_plan_set',
    payload: { ingredients: [{ itemId: 'sylvilagus_floridanus:carcass', quantity: 1 }] },
  });
  assert.equal(setValidation.ok, true, 'meal_plan_set should validate for carcass ingredients');
  assert.ok(setValidation.mealPlanPreview, 'carcass meal plan should return preview payload');
  assert.ok(
    Number(setValidation.mealPlanPreview.totalNutrition?.calories) > 0,
    'carcass meal plan preview should have non-zero calories',
  );
}

function runPartnerTaskQueueProgressionTest() {
  let state = createScenarioState();
  const fiberItemId = 'urtica_dioica:stalk:green';
  state.camp.stockpile.stacks = [{ itemId: fiberItemId, quantity: 2, freshness: 1, decayDaysRemaining: 10 }];
  state.camp.lastPartnerMaintenanceDayCompleted = Number(state.totalDaysSimulated) || 0;

  state = applyAction(state, {
    actorId: 'player',
    kind: 'partner_task_set',
    payload: {
      task: {
        taskId: 'int-spin-cordage',
        kind: 'spin_cordage',
        ticksRequired: 4,
        inputs: [{ source: 'camp_stockpile', itemId: fiberItemId, quantity: 1 }],
        outputs: [{ itemId: 'cordage', quantity: 1 }],
      },
    },
  });

  state = idleTicks(state, 4);
  const cordageStack = state.camp.stockpile.stacks.find((entry) => entry.itemId === 'cordage');
  assert.ok(cordageStack, 'partner task completion should deposit outputs into camp stockpile');
  assert.ok(cordageStack.quantity >= 1, 'partner task output quantity should be present');
}

function runPartnerDeathTerminalConditionTest() {
  const state = createScenarioState();
  state.actors.partner.health = 0;

  const partnerAction = validateAction(state, {
    actorId: 'partner',
    kind: 'move',
    payload: { dx: 1, dy: 0 },
  });
  assert.equal(partnerAction.ok, false, 'dead partner should be unable to act');
  assert.equal(partnerAction.code, 'actor_unavailable', 'dead partner should resolve actor_unavailable');
  assertDeathEndsRun(state, 'partner');
}

function runVisionChooseRewardFlowTest() {
  let state = createScenarioState();
  state.dayTick = 220;
  state.camp.debrief.active = true;
  state.camp.debrief.requiresVisionConfirmation = true;
  state.camp.debrief.visionSelectionOptions = [
    { itemId: 'debug_vision_item', quantity: 1 },
  ];
  state.camp.debrief.pendingVisionRevelation = {
    sourceItemId: 'debug_vision_item',
    visionCategories: ['sight', 'plant'],
    sightDurationDays: 3,
  };
  state.camp.debrief.pendingVisionChoices = [
    { category: 'sight', rewardId: 'nature_sight', rewardLabel: 'The Nature Sight' },
    { category: 'plant', rewardId: 'plant_knowledge', rewardLabel: 'Plant Knowledge' },
  ];

  const confirmValidation = validateAction(state, {
    actorId: 'player',
    kind: 'partner_vision_confirm',
    payload: { itemId: 'debug_vision_item' },
  });
  assert.equal(confirmValidation.ok, true, 'partner_vision_confirm should validate when debrief options are present');

  state = applyAction(state, {
    actorId: 'player',
    kind: 'partner_vision_choose',
    payload: { category: 'sight' },
  });
  assert.equal(state.camp.debrief.pendingVisionRevelation, null, 'vision choose should clear pending revelation');
  assert.equal(state.camp.debrief.pendingVisionChoices.length, 0, 'vision choose should clear pending choices');
  assert.ok(
    Number(state.actors.player.natureSightPendingDays) >= 3,
    'vision sight choice should add pending Nature Sight duration',
  );
}

function runNatureSightOverlaySelectionGateTest() {
  let state = createScenarioState();
  state.actors.player.natureSightDaysRemaining = 2;
  state.actors.player.natureSightOverlayChoice = null;
  state.actors.player.natureSightOverlayChosenDay = null;

  const firstValidation = validateAction(state, {
    actorId: 'player',
    kind: 'nature_sight_overlay_set',
    payload: { overlay: 'calorie_heatmap' },
  });
  assert.equal(firstValidation.ok, true, 'first nature sight overlay selection should validate while active');

  state = applyAction(state, {
    actorId: 'player',
    kind: 'nature_sight_overlay_set',
    payload: { overlay: 'calorie_heatmap' },
  });
  assert.equal(
    state.actors.player.natureSightOverlayChoice,
    'calorie_heatmap',
    'nature_sight_overlay_set should persist selected overlay',
  );

  const secondValidation = validateAction(state, {
    actorId: 'player',
    kind: 'nature_sight_overlay_set',
    payload: { overlay: 'animal_density' },
  });
  assert.equal(secondValidation.ok, false, 'overlay change should be blocked after selection on same day');
  assert.equal(
    secondValidation.code,
    'nature_sight_overlay_locked_for_day',
    'second overlay selection should enforce once-per-day gate',
  );
}

export const INTEGRATION_TESTS = [
  ['debrief enter and exit flow', runDebriefEnterExitFlowTest],
  ['meal plan set and commit flow', runMealPlanSetCommitFlowTest],
  ['begin day stew then night drain', runBeginDayStewThenNightDrainTest],
  ['stew can refill multi-day deficit', runStewCanRefillMultiDayDeficitTest],
  ['meal plan carcass nutrition preview', runMealPlanCarcassNutritionPreviewTest],
  ['partner task queue progression', runPartnerTaskQueueProgressionTest],
  ['partner death terminal condition', runPartnerDeathTerminalConditionTest],
  ['vision choose reward flow', runVisionChooseRewardFlowTest],
  ['nature sight overlay daily gate', runNatureSightOverlaySelectionGateTest],
];

