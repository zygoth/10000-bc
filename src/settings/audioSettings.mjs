const KEY = '10000bc.settings.audio';
const DEFAULT = Object.freeze({ music: 1, sfx: 1 });

function clamp01(n) {
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.max(0, Math.min(1, n));
}

/**
 * @returns {{ music: number, sfx: number }} 0..1
 */
export function createDefaultAudioSettings() {
  return { ...DEFAULT };
}

/**
 * @returns {{ music: number, sfx: number }}
 */
export function loadAudioSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { music: 1, sfx: 1 };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      return { music: 1, sfx: 1 };
    }
    const d = JSON.parse(raw);
    return {
      music: clamp01(Number(d?.music)),
      sfx: clamp01(Number(d?.sfx)),
    };
  } catch {
    return { music: 1, sfx: 1 };
  }
}

/**
 * @param {{ music: number, sfx: number }} s
 */
export function saveAudioSettings(s) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const next = {
      music: clamp01(Number(s?.music)),
      sfx: clamp01(Number(s?.sfx)),
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
