import { advanceTick } from '../../game/simCore.mjs';
import {
  buildBaseGameState,
  withPlayerAt,
} from '../../../tests/fixtures/buildTestGameState.mjs';
import {
  buildDebriefVisionPanelModel,
  formatChosenVisionRewardLine,
  getDebriefVisionTabNeedsAttention,
  getDebriefVisionTabShowsAlert,
  probeDebriefVisionRequest,
} from './DebriefVisionDisplayLogic.js';

const VISION_SPECIES = 'psilocybe_caerulipes';
const VISION_ITEM_ID = `${VISION_SPECIES}:fruiting_body:whole`;

function fmtToken(id) {
  return String(id || '').replace(/_/g, ' ');
}

function attachVisionGroundFungusZone(state) {
  const fungusTile = state.tiles.find((tile) => !tile.waterType && !tile.rockType);
  if (!fungusTile) {
    throw new Error('vision surfacing test needs a dry land tile');
  }
  fungusTile.groundFungusZone = {
    type: 'ground_fungus_zone',
    speciesId: VISION_SPECIES,
    annualFruitChance: 1,
    fruitingWindows: [],
    perTileYieldRange: [20, 20],
    yieldCurrentGrams: 20,
  };
  return state;
}

function enterDebrief(state) {
  return advanceTick(state, {
    actions: [
      {
        actionId: 'debrief-enter-vision-ui-test',
        actorId: 'player',
        kind: 'debrief_enter',
        payload: {},
      },
    ],
  });
}

function panel(state, isDebriefActive = true) {
  return buildDebriefVisionPanelModel({
    isDebriefActive,
    gameState: state,
    formatTokenLabel: fmtToken,
  });
}

describe('Debrief Vision surfacing (headless)', () => {
  test('no vision-eligible map sources: probe fails and panel disables request with catalog message', () => {
    let state = buildBaseGameState(88101, { width: 24, height: 24 });
    withPlayerAt(state, state.camp.anchorX, state.camp.anchorY);
    state.dayTick = 220;
    state = enterDebrief(state);

    const probe = probeDebriefVisionRequest(state);
    expect(probe.ok).toBe(false);
    expect(probe.code).toBe('vision_no_eligible_sources');

    const m = panel(state);
    expect(m.visible).toBe(true);
    expect(m.requestVision.disabled).toBe(true);
    expect(m.requestVision.blockedMessage).toMatch(/No vision-eligible/i);
    expect(m.confirmItem.show).toBe(false);
    expect(m.rewardChoice.show).toBe(false);
    expect(m.partnerRequestCard).toBeNull();
  });

  test('inactive debrief yields invisible vision panel model', () => {
    const state = buildBaseGameState(88102, { width: 12, height: 12 });
    const m = panel(state, false);
    expect(m.visible).toBe(false);
  });

  test('tab alert shows when vision needs attention and another tab is selected', () => {
    const debrief = {
      visionRequest: { speciesId: VISION_SPECIES, message: 'Need mushroom' },
    };
    expect(getDebriefVisionTabNeedsAttention(debrief)).toBe(true);
    expect(getDebriefVisionTabShowsAlert({ debrief, selectedDebriefTab: 'meal' })).toBe(true);
    expect(getDebriefVisionTabShowsAlert({ debrief, selectedDebriefTab: 'vision' })).toBe(false);
  });

  test('sim path: missing stockpile shows partner request card; stockpile path shows confirm row', () => {
    let state = buildBaseGameState(88103, { width: 30, height: 30 });
    withPlayerAt(state, state.camp.anchorX, state.camp.anchorY);
    state.dayTick = 220;
    attachVisionGroundFungusZone(state);
    state = enterDebrief(state);

    state = advanceTick(state, {
      actions: [
        {
          actionId: 'vision-req-missing',
          actorId: 'player',
          kind: 'partner_vision_request',
          payload: {},
        },
      ],
    });

    let m = panel(state);
    expect(m.partnerRequestCard).not.toBeNull();
    expect(m.partnerRequestCard.plantName).toBeTruthy();
    expect(m.confirmItem.show).toBe(false);
    expect(m.requestVision.disabled).toBe(false);

    state.camp.stockpile.stacks = [{ itemId: VISION_ITEM_ID, quantity: 2 }];
    state = advanceTick(state, {
      actions: [
        {
          actionId: 'vision-req-with-stock',
          actorId: 'player',
          kind: 'partner_vision_request',
          payload: {},
        },
      ],
    });

    m = panel(state);
    expect(m.partnerRequestCard).toBeNull();
    expect(m.confirmItem.show).toBe(true);
    expect(m.confirmItem.options.length).toBeGreaterThan(0);
    expect(m.confirmItem.options[0].value).toBe(VISION_ITEM_ID);
    expect(m.confirmItem.options[0].label).toContain('×');

    const probePending = probeDebriefVisionRequest(state);
    expect(probePending.ok).toBe(false);
    expect(probePending.code).toBe('vision_confirmation_pending');
    expect(m.requestVision.disabled).toBe(true);
    expect(m.requestVision.blockedMessage).toMatch(/confirmation/i);
  });

  test('sim path: after confirm, reward choice options surface; after choose, rows clear', () => {
    let state = buildBaseGameState(88104, { width: 30, height: 30 });
    withPlayerAt(state, state.camp.anchorX, state.camp.anchorY);
    state.dayTick = 220;
    attachVisionGroundFungusZone(state);
    state = enterDebrief(state);
    state.camp.stockpile.stacks = [{ itemId: VISION_ITEM_ID, quantity: 2 }];
    state = advanceTick(state, {
      actions: [
        { actionId: 'vr1', actorId: 'player', kind: 'partner_vision_request', payload: {} },
      ],
    });
    state = advanceTick(state, {
      actions: [
        { actionId: 'vc1', actorId: 'player', kind: 'partner_vision_confirm', payload: { itemId: VISION_ITEM_ID } },
      ],
    });

    let m = panel(state);
    expect(m.rewardChoice.show).toBe(true);
    expect(m.rewardChoice.options.length).toBeGreaterThan(0);
    const sightOpt = m.rewardChoice.options.find((o) => o.value === 'sight');
    expect(sightOpt).toBeDefined();
    expect(sightOpt.label).toMatch(/sight/i);

    state = advanceTick(state, {
      actions: [
        { actionId: 'vch1', actorId: 'player', kind: 'partner_vision_choose', payload: { category: 'sight' } },
      ],
    });
    m = panel(state);
    expect(m.rewardChoice.show).toBe(false);
    expect(m.confirmItem.show).toBe(false);
  });

  test('seasonal cap: panel mirrors cooldown validation message (batched debrief actions, 0 tick each)', () => {
    let state = buildBaseGameState(88105, { width: 30, height: 30 });
    withPlayerAt(state, state.camp.anchorX, state.camp.anchorY);
    state.dayTick = 220;
    attachVisionGroundFungusZone(state);
    state = enterDebrief(state);
    state.camp.stockpile.stacks = [{ itemId: VISION_ITEM_ID, quantity: 4 }];
    // sortActionsDeterministically orders ties by actionId; use issuedAtTick so order is request→confirm→choose twice.
    state = advanceTick(state, {
      actions: [
        { actionId: 'cap-a-vr', actorId: 'player', issuedAtTick: 0, kind: 'partner_vision_request', payload: {} },
        { actionId: 'cap-a-vc', actorId: 'player', issuedAtTick: 1, kind: 'partner_vision_confirm', payload: { itemId: VISION_ITEM_ID } },
        { actionId: 'cap-a-vch', actorId: 'player', issuedAtTick: 2, kind: 'partner_vision_choose', payload: { category: 'sight' } },
        { actionId: 'cap-b-vr', actorId: 'player', issuedAtTick: 3, kind: 'partner_vision_request', payload: {} },
        { actionId: 'cap-b-vc', actorId: 'player', issuedAtTick: 4, kind: 'partner_vision_confirm', payload: { itemId: VISION_ITEM_ID } },
        { actionId: 'cap-b-vch', actorId: 'player', issuedAtTick: 5, kind: 'partner_vision_choose', payload: { category: 'sight' } },
      ],
    });
    const m = panel(state);
    expect(m.requestVision.disabled).toBe(true);
    expect(m.requestVision.blockedMessage).toMatch(/cooldown|season/i);
    expect(probeDebriefVisionRequest(state).code).toBe('vision_cooldown_active');
  });

  test('formatChosenVisionRewardLine covers plant, tech, and empty tech unlock', () => {
    expect(
      formatChosenVisionRewardLine(
        { category: 'plant', rewardLabel: 'Plant Knowledge', plantNames: ['Nettle', 'Oak'] },
        fmtToken,
      ),
    ).toBe('Plant Knowledge: Nettle, Oak');
    expect(
      formatChosenVisionRewardLine(
        { category: 'tech', rewardLabel: 'Tech Knowledge', techUnlockKey: 'fire', techUnlockLabel: 'Fire' },
        fmtToken,
      ),
    ).toBe('Tech Knowledge: Fire');
    const emptyTech = formatChosenVisionRewardLine(
      { category: 'tech', rewardLabel: 'Tech Knowledge', techUnlockKey: null },
      fmtToken,
    );
    expect(emptyTech).toContain('everything in the tech forest was already known');
  });

  test('chosenVisionRewards in debrief map to heading and lines', () => {
    let state = buildBaseGameState(88106, { width: 14, height: 14 });
    withPlayerAt(state, state.camp.anchorX, state.camp.anchorY);
    state.camp.debrief = {
      active: true,
      visionUsesThisSeason: 1,
      chosenVisionRewards: [
        { category: 'plant', rewardLabel: 'Plant Knowledge', plantNames: ['Species A'] },
      ],
    };
    state.dayTick = 220;

    const m = panel(state);
    expect(m.chosenRewardsHeading).toBe(true);
    expect(m.chosenRewardLines).toHaveLength(1);
    expect(m.chosenRewardLines[0].text).toContain('Species A');
  });
});
