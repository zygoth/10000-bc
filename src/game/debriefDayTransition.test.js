import { advanceStateToNextMorning } from './debriefDayTransition.mjs';
import { advanceTick, createInitialGameState, validateAction } from './simCore.mjs';
import { TICKS_PER_DAY } from './simCore.constants.mjs';

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
