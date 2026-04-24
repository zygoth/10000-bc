import { useEffect, useRef } from 'react';
import { GameMusicController } from './GameMusicController.mjs';

/**
 * Drives BGM: seasonal gameplay, debrief crossfade, title silence.
 * @param {object} p
 * @param {string} p.appMode
 * @param {boolean} p.isDebriefActive
 * @param {number|undefined} p.dayOfYear
 * @param {string|number} [p.gameStateVersion]
 */
export function useGameMusic(p) {
  const { appMode, isDebriefActive, dayOfYear, gameStateVersion = 0 } = p;
  const ctrl = useRef(null);
  useEffect(() => {
    if (!ctrl.current) {
      ctrl.current = new GameMusicController();
    }
    const c = ctrl.current;
    c.apply({
      appMode,
      isDebriefActive: Boolean(isDebriefActive),
      dayOfYear: Number(dayOfYear) || 1,
    }).catch(() => {});
  }, [appMode, isDebriefActive, dayOfYear, gameStateVersion]);
  useEffect(() => {
    return () => {
      if (ctrl.current) {
        ctrl.current.dispose();
        ctrl.current = null;
      }
    };
  }, []);
}
