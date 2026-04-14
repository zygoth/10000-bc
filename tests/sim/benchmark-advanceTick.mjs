// Simple benchmark for advanceTick performance
// Run with: node tests/sim/benchmark-advanceTick.mjs

import { createInitialGameState, advanceTick } from '../../src/game/simCore.mjs';

function benchmarkAdvanceTick(iterations = 100) {
  let state = createInitialGameState(10000, { width: 80, height: 80 });

  console.time('advanceTick benchmark');
  for (let i = 0; i < iterations; i++) {
    const nextState = advanceTick(state, {
      actions: [{
        actionId: `bench-${i}`,
        actorId: 'player',
        kind: 'move',
        issuedAtTick: 0,
        payload: { dx: 1, dy: 0 },
      }],
    });
    // Chain to simulate React updates
    state = nextState;
  }
  console.timeEnd('advanceTick benchmark');

  console.log(`Completed ${iterations} advanceTick calls`);
}

benchmarkAdvanceTick();