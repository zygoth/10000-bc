import { buildDefaultPayload, inferTileContextActions } from './actionContextWiring.mjs';
import { getTileContextMenuEntries } from './TileContextMenuDisplayLogic.js';

export function defaultTileContextTestDecorators() {
  return {
    formatTokenLabel: (v) => String(v || ''),
    getStationIdAtTile: () => null,
    stationActionLabel: (id) => `Use ${String(id || '')}...`,
  };
}

/**
 * Tile context rows using production infer + buildDefaultPayload (no React / no DOM).
 */
export function getTileContextMenuEntriesForTest(state, {
  player,
  selectedTileX,
  selectedTileY,
  selectedTileEntity,
  selectedTileWorldItems = [],
  selectedTileWorldItemEntries = [],
  selectedContext = {},
  decorators = defaultTileContextTestDecorators(),
}) {
  return getTileContextMenuEntries({
    gameState: state,
    playerActor: player,
    selectedTileX,
    selectedTileY,
    selectedTileEntity,
    selectedTileWorldItems,
    selectedTileWorldItemEntries,
    selectedContext,
    inferTileContextActions,
    buildDefaultPayload,
    ...decorators,
  });
}
