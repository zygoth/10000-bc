import { AMBIENT_CATALOG, getAmbientEntriesByRole } from './ambientCatalog.mjs';
import { syncAmbientLayerCache } from './ambientLayerCache.mjs';
import { AmbientWebAudio } from './ambientWebAudio.mjs';
import {
  AMBIENT_MOBILE_LISTEN_CHEBYSHEV,
  computeAmbientLoopCommands,
  computeMobileAmbientOneShots,
  floorListenerTile,
} from './ambientPlayHeadless.mjs';
import { mulberry32 } from './ambientMath.mjs';

/**
 * Bridges sim state + camera to ambient weights, emitters, and Web Audio.
 * Year weight maps are the **habitat** layer from `buildYearWeightMaps`; they do not yet apply
 * `getAnimalDensityAtTile` for `shared_trapping_species_id` (see `buildAmbientLayer.mjs`).
 */
export class AmbientAudioBridge {
  /**
   * @param {HTMLElement} gestureHost element used for AudioContext resume on first pointer
   */
  constructor(gestureHost) {
    this.gestureHost = gestureHost;
    this.audio = new AmbientWebAudio();
    this.catalog = AMBIENT_CATALOG;
    this.mobileEntries = getAmbientEntriesByRole('ambient_mobile');
    /** @type {Map<string, Float32Array>|null} */
    this.weightMaps = null;
    /** @type {import('./buildAmbientLayer.mjs').AmbientEmitter[]|null} */
    this.emitters = null;
    this.cacheYearBucket = null;
    this.cacheGameYear = null;
    this.cacheDayOfYear = null;
    this.cacheDay = null;
    this.lastNowMs = null;
    this.resumeAttached = false;
    this.cooldownUntil = new Map();
    this.mobileRng = mulberry32(0x9e3779b9);
  }

  attachResumeOnce() {
    if (this.resumeAttached || !this.gestureHost) {
      return;
    }
    this.resumeAttached = true;
    const once = () => {
      this.audio.resumeFromUserGesture();
    };
    this.gestureHost.addEventListener('pointerdown', once, { once: true });
  }

  /**
   * @param {number} linear 0..1; world/ambient (Web Audio) layer.
   */
  setSfxVolume(linear) {
    this.audio.setSfxVolume(linear);
  }

  syncDay(state) {
    const next = syncAmbientLayerCache(state, this.mobileEntries, {
      cacheYearBucket: this.cacheYearBucket,
      cacheGameYear: this.cacheGameYear,
      cacheDayOfYear: this.cacheDayOfYear,
      cacheDay: this.cacheDay,
      weightMaps: this.weightMaps,
      emitters: this.emitters,
    });
    this.cacheYearBucket = next.cacheYearBucket;
    this.cacheGameYear = next.cacheGameYear;
    this.cacheDayOfYear = next.cacheDayOfYear;
    this.cacheDay = next.cacheDay;
    this.weightMaps = next.weightMaps;
    this.emitters = next.emitters;
  }

  /**
   * @param {object} state
   * @param {number} camX **listener** X in float tile space (use player tile + 0.5; not the drifting camera)
   * @param {number} camY **listener** Y
   */
  tick(state, camX, camY) {
    if (!state?.tiles || !Number.isInteger(state.width)) {
      return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.lastNowMs == null) {
      this.lastNowMs = now;
    }
    const dt = Math.min(0.25, Math.max(0, (now - this.lastNowMs) / 1000));
    this.lastNowMs = now;

    this.syncDay(state);
    this.attachResumeOnce();

    const lx = floorListenerTile(camX);
    const ly = floorListenerTile(camY);
    const dayTick = Number(state?.dayTick) || 0;

    const loopCmds = computeAmbientLoopCommands({
      state,
      lx,
      ly,
      camX,
      camY,
      catalog: this.catalog,
      dayTick,
    });
    for (const cmd of loopCmds) {
      if (cmd.op === 'ensure') {
        this.audio.ensureLoop(cmd.loopId, cmd.url, cmd.gain, cmd.pan);
      } else if (cmd.loopId === 'beehive_closest') {
        this.audio.fadeOutAndStopLoop(cmd.loopId, 0.5);
      } else {
        this.audio.stopLoop(cmd.loopId);
      }
    }

    const oneShots = computeMobileAmbientOneShots({
      nowMs: now,
      dtSec: dt,
      dayTick,
      lx,
      ly,
      camX,
      camY,
      mobileEntries: this.mobileEntries,
      emitters: this.emitters || [],
      listenR: AMBIENT_MOBILE_LISTEN_CHEBYSHEV,
      cooldownUntil: this.cooldownUntil,
      rng: () => this.mobileRng(),
    });
    for (const shot of oneShots) {
      this.audio.playOneShot({
        url: shot.url,
        gain: shot.gain,
        pan: shot.pan,
        flightSweep: shot.flightSweep,
        sweepMs: shot.sweepMs,
        emitterX: shot.emitterX,
        emitterY: shot.emitterY,
        staticGainScale: shot.staticGainScale,
      });
    }
    this.audio.updateListenerForMobileOneShots(camX, camY);
  }

  dispose() {
    this.audio.dispose();
    this.cacheYearBucket = null;
    this.cacheGameYear = null;
    this.cacheDayOfYear = null;
    this.cacheDay = null;
    this.weightMaps = null;
    this.emitters = null;
  }
}
