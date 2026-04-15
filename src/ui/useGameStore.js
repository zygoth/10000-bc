import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import {
  advanceDayAndEmit,
  advanceTickAndEmit,
  getGameState,
  getGameStateVersion,
  setGameState,
  subscribeToGameState,
} from '../game/gameStore.mjs';

/**
 * React 17 does not provide `useSyncExternalStore`, so we implement the minimal
 * subscription pattern ourselves: subscribe -> bump local counter -> re-render.
 */
export function useGameStore() {
  const [version, setVersion] = useState(() => getGameStateVersion());

  useLayoutEffect(() => (
    subscribeToGameState(() => {
      setVersion(getGameStateVersion());
    })
  ), []);

  const gameState = getGameState();
  return { gameState, version };
}

export function useGameDispatch() {
  return useMemo(() => ({
    setGameState,
    advanceTick: advanceTickAndEmit,
    advanceDay: advanceDayAndEmit,
  }), []);
}

export function useGameState() {
  return useGameStore().gameState;
}

export function useGameVersion() {
  return useGameStore().version;
}

