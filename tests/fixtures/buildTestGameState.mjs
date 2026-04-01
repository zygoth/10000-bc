import { createInitialGameState } from '../../src/game/simCore.mjs';

export function buildBaseGameState(seed = 42, options = {}) {
  return createInitialGameState(seed, options);
}

export function withPlayerAt(state, x, y) {
  state.actors.player.x = x;
  state.actors.player.y = y;
  return state;
}

export function withPlayerInventory(state, stacks) {
  state.actors.player.inventory.stacks = stacks;
  return state;
}

export function withCampStation(state, stationId, placement) {
  const { stationsUnlocked = [], stationPlacements = {} } = state.camp;
  if (!stationsUnlocked.includes(stationId)) {
    state.camp.stationsUnlocked = [...stationsUnlocked, stationId];
  }
  state.camp.stationPlacements = { ...stationPlacements, [stationId]: placement };
  return state;
}

export function withRockTile(state, x, y, rockType, extra = {}) {
  const idx = Number(y) * Number(state.width) + Number(x);
  const tile = state.tiles[idx];
  tile.rockType = rockType;
  if (rockType === 'flint_cobble_scatter' && Number.isInteger(extra.flintCobbleRemaining)) {
    tile.flintCobbleRemaining = extra.flintCobbleRemaining;
  }
  return state;
}
