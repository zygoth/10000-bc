import { getSeason } from '../game/plantCatalog.mjs';
import {
  clampResumeTimeSec,
  crossfadeVolumes,
  nextFromOrder,
  normalizePathForMatch,
} from './playlist.mjs';

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

function publicBase() {
  if (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }
  return '';
}

/**
 * @param {string} src
 * @returns {string} pathname e.g. /sounds/...
 */
export function normalizeAudioPath(src) {
  if (!src) {
    return '';
  }
  if (typeof window === 'undefined') {
    return src;
  }
  try {
    const u = new URL(src, window.location.href);
    return u.pathname;
  } catch {
    return src;
  }
}

/**
 * BGM: seasonal shuffle + debrief handoff with crossfade and resume snapshot.
 */
export class GameMusicController {
  /**
   * @param {object} [options]
   * @param {number} [options.crossfadeMs=1500]
   * @param {number} [options.gain=0.2] Master volume 0..1 (both gameplay and debrief; HTMLAudio is linear).
   */
  constructor(options = {}) {
    this.crossfadeMs = Number(options.crossfadeMs) || 1500;
    const g = Number(options.gain);
    this._gain = Number.isFinite(g) && g >= 0 ? Math.min(1, g) : 0.2;
    /** @type {{ order: string[], i: number }|null} */
    this._debriefState = null;
    /** @type {Record<string, { order: string[], i: number }|null>} */
    this._gameplayState = Object.fromEntries(SEASONS.map((s) => [s, null]));
    this._lastSurface = 'title';
    /** @type {{ season: string, url: string, timeSec: number }|null} */
    this._snapshot = null;
    /** @type {string|null} */
    this._playingSeason = null;
    this._rampRaf = null;
    this._rampStartMs = 0;
    this._gestureHost = null;
    this._gestureAttached = false;
    this._manifest = null;
    this._loadPromise = null;
    /** Suppress spurious `ended` when swapping `src` for debrief resume. */
    this._suppressGameplayEnded = false;
    this._gameplayEndedHandler = () => {
      this._onGameplayEnded();
    };
    this._debriefEndedHandler = () => {
      this._onDebriefEnded();
    };

    if (typeof document !== 'undefined') {
      this._gestureHost = document.body;
      this.gameplayEl = new Audio();
      this.debriefEl = new Audio();
      this.gameplayEl.preload = 'auto';
      this.debriefEl.preload = 'auto';
      this.gameplayEl.addEventListener('ended', this._gameplayEndedHandler);
      this.debriefEl.addEventListener('ended', this._debriefEndedHandler);
    } else {
      this.gameplayEl = null;
      this.debriefEl = null;
    }
  }

  _fullUrl(path) {
    if (!path) {
      return '';
    }
    return `${publicBase()}${path}`;
  }

  /** Target volume when a layer is fully audible (BGM master gain). */
  _fullV() {
    return this._gain;
  }

  attachResumeFromUserGesture() {
    const host = this._gestureHost;
    if (!host || this._gestureAttached) {
      return;
    }
    this._gestureAttached = true;
    const once = () => {
      if (this.gameplayEl) {
        this.gameplayEl.play().catch(() => {});
      }
      if (this.debriefEl) {
        this.debriefEl.play().catch(() => {});
      }
    };
    host.addEventListener('pointerdown', once, { once: true });
  }

  _cancelRamp() {
    if (this._rampRaf != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rampRaf);
    }
    this._rampRaf = null;
  }

  _parallelRamp(ga, da, durationMs, onComplete) {
    this._cancelRamp();
    if (!this.gameplayEl || !this.debriefEl) {
      if (onComplete) onComplete();
      return;
    }
    const gFrom = Math.max(0, Math.min(1, ga.fromV));
    const gTo = Math.max(0, Math.min(1, ga.toV));
    const dFrom = Math.max(0, Math.min(1, da.fromV));
    const dTo = Math.max(0, Math.min(1, da.toV));
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._rampStartMs = start;
    const tick = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      const { a: gv, b: dv } = crossfadeVolumes(t, gFrom, gTo, dFrom, dTo);
      this.gameplayEl.volume = gv;
      this.debriefEl.volume = dv;
      if (t < 1) {
        this._rampRaf = requestAnimationFrame(tick);
        return;
      }
      this._rampRaf = null;
      if (onComplete) {
        onComplete();
      }
    };
    this._rampRaf = requestAnimationFrame(tick);
  }

  async _ensureManifest() {
    if (this._manifest) {
      return this._manifest;
    }
    if (this._loadPromise) {
      return this._loadPromise;
    }
    this._loadPromise = (async () => {
      try {
        const base = publicBase();
        const res = await fetch(`${base}/sounds/music/manifest.json`, { cache: 'no-cache' });
        if (res.ok) {
          this._manifest = await res.json();
        } else {
          this._manifest = { version: 1, gameplay: {}, debrief: [] };
        }
      } catch {
        this._manifest = { version: 1, gameplay: {}, debrief: [] };
      }
      if (!this._manifest.gameplay) {
        this._manifest.gameplay = {};
      }
      if (!Array.isArray(this._manifest.debrief)) {
        this._manifest.debrief = [];
      }
      for (const s of SEASONS) {
        if (!Array.isArray(this._manifest.gameplay[s])) {
          this._manifest.gameplay[s] = [];
        }
      }
      return this._manifest;
    })();
    return this._loadPromise;
  }

  /**
   * @param {object} p
   * @param {string} p.appMode
   * @param {boolean} p.isDebriefActive
   * @param {number} p.dayOfYear
   */
  async apply(p) {
    if (typeof window === 'undefined' || !this.gameplayEl || !this.debriefEl) {
      return;
    }
    await this._ensureManifest();
    this.attachResumeFromUserGesture();
    const doy = Number(p.dayOfYear) || 1;
    const season = getSeason(doy);
    const surface = p.appMode === 'title' ? 'title' : (p.isDebriefActive ? 'debrief' : 'gameplay');

    if (surface === 'title') {
      this._cancelRamp();
      this._fadeToSilentTitle();
      this._lastSurface = 'title';
      this._snapshot = null;
      return;
    }

    if (surface === 'debrief') {
      if (this._lastSurface === 'gameplay') {
        this._snapshot = {
          season: this._playingSeason || season,
          url: normalizeAudioPath(this.gameplayEl.currentSrc || this.gameplayEl.src),
          timeSec: Number(this.gameplayEl.currentTime) || 0,
        };
        await this._crossfadeToDebrief();
      } else if (this._lastSurface !== 'debrief') {
        await this._crossfadeToDebrief();
      }
      this._lastSurface = 'debrief';
      return;
    }

    if (this._lastSurface === 'debrief') {
      this._cancelRamp();
      const sn = this._snapshot;
      if (sn && sn.season === season) {
        await this._crossfadeToGameplayResume(sn, season);
      } else {
        this._snapshot = null;
        await this._crossfadeToGameplayNew(season);
      }
      this._lastSurface = 'gameplay';
      return;
    }

    if (this._lastSurface === 'title' || this._lastSurface === null) {
      this._startGameplayFromTitle(season);
      this._lastSurface = 'gameplay';
      return;
    }

    if (this._playingSeason !== season) {
      this._startGameplayNewSeason(season);
    }
    this._lastSurface = 'gameplay';
  }

  _fadeToSilentTitle() {
    if (!this.gameplayEl || !this.debriefEl) {
      return;
    }
    this.gameplayEl.volume = 0;
    this.debriefEl.volume = 0;
    this.gameplayEl.pause();
    this.debriefEl.pause();
    this._playingSeason = null;
  }

  async _crossfadeToDebrief() {
    const g = this.gameplayEl;
    const d = this.debriefEl;
    const debriefUrls = (this._manifest && this._manifest.debrief) || [];
    g.volume = Math.max(0, Math.min(1, g.volume || this._fullV()));
    d.volume = 0;
    if (debriefUrls.length === 0) {
      this._parallelRamp(
        { fromV: g.volume, toV: 0 },
        { fromV: 0, toV: 0 },
        Math.min(800, this.crossfadeMs),
        () => {
          g.pause();
        },
      );
      return;
    }
    const { nextUrl, state } = nextFromOrder(debriefUrls, this._debriefState);
    this._debriefState = state;
    if (!nextUrl) {
      g.pause();
      return;
    }
    d.src = this._fullUrl(nextUrl);
    d.loop = false;
    try {
      await d.play();
    } catch {
      /* autoplay; gesture path may need another tick */
    }
    this._parallelRamp(
      { fromV: g.volume, toV: 0 },
      { fromV: 0, toV: this._fullV() },
      this.crossfadeMs,
      () => {
        g.pause();
        g.volume = this._fullV();
      },
    );
  }

  /**
   * @param {{ season: string, url: string, timeSec: number }} sn
   * @param {string} season
   */
  async _crossfadeToGameplayResume(sn, season) {
    const g = this.gameplayEl;
    const d = this.debriefEl;
    const rawPath = (sn.url && sn.url.replace(/^\/+/, '/')) || '';
    const list = (this._manifest && this._manifest.gameplay && this._manifest.gameplay[season]) || [];
    const key = normalizePathForMatch(rawPath);
    const manifestPath = list.find((u) => normalizePathForMatch(u) === key);
    if (!rawPath || !manifestPath) {
      this._snapshot = null;
      await this._crossfadeToGameplayNew(season);
      return;
    }
    this._suppressGameplayEnded = true;
    let suppressTimer = 0;
    const unSuppress = () => {
      this._suppressGameplayEnded = false;
      if (suppressTimer) {
        window.clearTimeout(suppressTimer);
        suppressTimer = 0;
      }
    };

    g.src = this._fullUrl(manifestPath);
    g.volume = 0;
    d.volume = Math.max(0, Math.min(1, d.volume || this._fullV()));
    g.addEventListener('seeked', unSuppress, { once: true });
    suppressTimer = window.setTimeout(unSuppress, 2000);
    const applySeek = () => {
      const dur = Number(g.duration) || 0;
      g.currentTime = clampResumeTimeSec(sn.timeSec, dur, 0.05);
    };
    if (g.readyState >= 1) {
      applySeek();
    } else {
      g.addEventListener('loadedmetadata', applySeek, { once: true });
    }
    try {
      await g.play();
    } catch {
      /* ignore */
    }
    this._parallelRamp(
      { fromV: 0, toV: this._fullV() },
      { fromV: d.volume, toV: 0 },
      this.crossfadeMs,
      () => {
        d.pause();
        d.volume = 0;
        g.volume = this._fullV();
        this._snapshot = null;
      },
    );
    this._playingSeason = season;
  }

  async _crossfadeToGameplayNew(season) {
    const g = this.gameplayEl;
    const d = this.debriefEl;
    const list = (this._manifest && this._manifest.gameplay && this._manifest.gameplay[season]) || [];
    d.volume = Math.max(0, Math.min(1, d.volume || this._fullV()));
    g.volume = 0;
    const { nextUrl, state } = nextFromOrder(list, this._gameplayState[season]);
    this._gameplayState[season] = state;
    if (!nextUrl) {
      d.pause();
      d.volume = 0;
      g.pause();
      this._playingSeason = season;
      return;
    }
    g.src = this._fullUrl(nextUrl);
    g.loop = list.length === 1;
    try {
      await g.play();
    } catch {
      /* ignore */
    }
    this._parallelRamp(
      { fromV: 0, toV: this._fullV() },
      { fromV: d.volume, toV: 0 },
      this.crossfadeMs,
      () => {
        d.pause();
        d.volume = 0;
        g.volume = this._fullV();
      },
    );
    this._playingSeason = season;
  }

  _startGameplayFromTitle(season) {
    this.debriefEl.pause();
    this.debriefEl.volume = 0;
    this._startGameplayNewSeason(season);
  }

  _startGameplayNewSeason(season) {
    const g = this.gameplayEl;
    const d = this.debriefEl;
    d.pause();
    d.volume = 0;
    g.volume = this._fullV();
    const list = (this._manifest && this._manifest.gameplay && this._manifest.gameplay[season]) || [];
    const { nextUrl, state } = nextFromOrder(list, this._gameplayState[season]);
    this._gameplayState[season] = state;
    if (!nextUrl) {
      g.pause();
      this._playingSeason = season;
      return;
    }
    g.src = this._fullUrl(nextUrl);
    g.loop = list.length === 1;
    g.play().catch(() => {});
    this._playingSeason = season;
  }

  _onGameplayEnded() {
    if (this._suppressGameplayEnded) {
      return;
    }
    if (this._lastSurface !== 'gameplay' || !this._playingSeason) {
      return;
    }
    const se = this._playingSeason;
    const list = (this._manifest && this._manifest.gameplay && this._manifest.gameplay[se]) || [];
    if (list.length <= 1) {
      return;
    }
    const { nextUrl, state } = nextFromOrder(list, this._gameplayState[se]);
    this._gameplayState[se] = state;
    if (!this.gameplayEl || !nextUrl) {
      return;
    }
    this.gameplayEl.src = this._fullUrl(nextUrl);
    this.gameplayEl.play().catch(() => {});
  }

  _onDebriefEnded() {
    if (this._lastSurface !== 'debrief') {
      return;
    }
    const list = (this._manifest && this._manifest.debrief) || [];
    if (list.length <= 1) {
      if (this.debriefEl) {
        this.debriefEl.currentTime = 0;
        this.debriefEl.play().catch(() => {});
      }
      return;
    }
    const { nextUrl, state } = nextFromOrder(list, this._debriefState);
    this._debriefState = state;
    if (this.debriefEl && nextUrl) {
      this.debriefEl.src = this._fullUrl(nextUrl);
      this.debriefEl.play().catch(() => {});
    }
  }

  dispose() {
    this._cancelRamp();
    if (this.gameplayEl) {
      this.gameplayEl.removeEventListener('ended', this._gameplayEndedHandler);
      this.gameplayEl.pause();
    }
    if (this.debriefEl) {
      this.debriefEl.removeEventListener('ended', this._debriefEndedHandler);
      this.debriefEl.pause();
    }
  }
}
