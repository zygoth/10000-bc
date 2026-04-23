const TRIBE_ACTOR_ORDER = ['player', 'partner', 'child'];

const LABEL_BY_ID = {
  player: 'Player',
  partner: 'Partner',
  child: 'Child',
};

/**
 * Tribe loss: any present family actor at health <= 0 (matches GDD / sim actor gating).
 */
export function getTribeGameOverSummary(state) {
  const actors = state?.actors || {};
  const deceasedLabels = [];
  for (const id of TRIBE_ACTOR_ORDER) {
    const actor = actors[id];
    if (!actor || typeof actor !== 'object') {
      continue;
    }
    if ((Number(actor.health) || 0) <= 0) {
      deceasedLabels.push(LABEL_BY_ID[id] || id);
    }
  }
  const survivedDays = Math.max(0, Math.floor(Number(state?.totalDaysSimulated) || 0));
  return {
    isGameOver: deceasedLabels.length > 0,
    deceasedLabels,
    survivedDays,
  };
}
