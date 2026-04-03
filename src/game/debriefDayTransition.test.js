import { advanceStateToNextMorning } from './debriefDayTransition.mjs';
import { advanceTick, createInitialGameState, validateAction } from './simCore.mjs';
import { TICKS_PER_DAY, THIRST_ACTIVITY_DRAIN_PER_TICK } from './simCore.constants.mjs';

function minimalPlayState() {
  return createInitialGameState(4242, { width: 40, height: 40 });
}

describe('advanceStateToNextMorning', () => {
  it('rolls calendar forward and clears debrief after idle skip from night tick', () => {
    let state = minimalPlayState();
    state.dayTick = Math.floor(TICKS_PER_DAY / 2) + 1;
    state.camp.debrief.active = true;
    const beforeDay = Number(state.totalDaysSimulated) || 0;

    state = advanceStateToNextMorning(state);

    expect(state.dayTick).toBe(0);
    expect(state.camp.debrief.active).toBe(false);
    expect(Number(state.totalDaysSimulated)).toBeGreaterThan(beforeDay);
  });

  it('matches explicit advanceTick idleTicks remainder', () => {
    const base = minimalPlayState();
    base.dayTick = 201;
    const dt = Math.max(0, Math.floor(Number(base.dayTick) || 0));
    const remain = TICKS_PER_DAY - dt;
    const viaHelper = advanceStateToNextMorning(base);
    const viaRaw = advanceTick(base, { idleTicks: remain });
    expect(viaHelper.dayTick).toBe(viaRaw.dayTick);
    expect(viaHelper.totalDaysSimulated).toBe(viaRaw.totalDaysSimulated);
  });

  it('refills player thirst on debrief_enter and holds it through the night until dawn', () => {
    let state = minimalPlayState();
    state.dayTick = 220;
    state.dailyTemperatureBand = 'hot';
    const ax = Number(state.camp.anchorX);
    const ay = Number(state.camp.anchorY);
    state.actors.player.x = ax + 1;
    state.actors.player.y = ay;
    state.actors.player.thirst = 0.2;

    state = advanceTick(state, {
      actions: [{ actionId: 't-enter', actorId: 'player', kind: 'debrief_enter', payload: {} }],
    });
    expect(state.actors.player.thirst).toBe(1);
    expect(state.camp.nightlyPlayerSafeThirstUntilDawn).toBe(true);

    state = advanceStateToNextMorning(state);
    expect(state.dayTick).toBe(0);
    expect(state.actors.player.thirst).toBe(1);
    expect(state.camp.nightlyPlayerSafeThirstUntilDawn).toBe(false);
  });

  it('still refills partner thirst at calendar dawn but not the player without debrief safe water', () => {
    let state = minimalPlayState();
    state.dayTick = TICKS_PER_DAY - 1;
    state.dailyTemperatureBand = 'hot';
    state.actors.player.thirst = 0.12;
    state.actors.partner.thirst = 0.18;
    state.actors.player.x = 0;
    state.actors.player.y = 0;

    state = advanceTick(state, { idleTicks: 1 });

    expect(state.dayTick).toBe(0);
    const hotDrain = THIRST_ACTIVITY_DRAIN_PER_TICK * (1 + 0.5);
    expect(state.actors.player.thirst).toBeCloseTo(0.12 - hotDrain, 10);
    expect(state.actors.partner.thirst).toBe(1);
  });

  it('does not drain thirst overnight only after ending the day in camp (safe water flag)', () => {
    let state = minimalPlayState();
    state.dayTick = 201;
    const ax = Number(state.camp.anchorX);
    const ay = Number(state.camp.anchorY);
    state.actors.player.x = ax + 2;
    state.actors.player.y = ay + 2;
    state.dailyTemperatureBand = 'hot';
    state.actors.player.thirst = 1;
    state.camp.nightlyPlayerSafeThirstUntilDawn = true;

    state = advanceStateToNextMorning(state);

    expect(state.actors.player.thirst).toBe(1);
  });

  it('drains player thirst at camp during night if the day was not ended in camp', () => {
    let state = minimalPlayState();
    state.dayTick = 201;
    const ax = Number(state.camp.anchorX);
    const ay = Number(state.camp.anchorY);
    state.actors.player.x = ax + 1;
    state.actors.player.y = ay;
    state.dailyTemperatureBand = 'hot';
    state.actors.player.thirst = 1;
    state.camp.nightlyPlayerSafeThirstUntilDawn = false;

    state = advanceTick(state, { idleTicks: 5 });

    expect(state.actors.player.thirst).toBeLessThan(1);
  });

  it('allows debrief_enter from non-anchor tile inside camp footprint', () => {
    let state = minimalPlayState();
    state.dayTick = 220;
    const ax = Number(state.camp.anchorX);
    const ay = Number(state.camp.anchorY);
    state.actors.player.x = ax + 1;
    state.actors.player.y = ay;

    const v = validateAction(state, { actorId: 'player', kind: 'debrief_enter', payload: {} });
    expect(v.ok).toBe(true);
    state = advanceTick(state, {
      actions: [{ actionId: 't-enter', actorId: 'player', kind: 'debrief_enter', payload: {} }],
    });
    expect(state.camp.debrief.active).toBe(true);
  });
});
