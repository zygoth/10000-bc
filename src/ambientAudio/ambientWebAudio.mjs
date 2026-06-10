import { pickAmbientVariantUrl } from './ambientSoundVariants.mjs';
import { gainFromDistance, panFromDelta } from './ambientPlayHeadless.mjs';

/**
 * Thin Web Audio layer: buffers, one-shots, simple loops, stereo pan.
 * Missing files decode fail → silent skip (logged once per url in dev).
 * Variants: `public/sounds/ambient/variant-manifest.json` (from `npm run sounds:missing`) lists
 * `name.ogg` + `name_v1.ogg` … per catalog URL; one-shots pick at random, loops keep one file per `loopId`.
 */
export class AmbientWebAudio {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** Master out (SFX / ambient) before `destination`; user volume 0..1. */
    /** @type {GainNode|null} */
    this._masterOut = null;
    this.bufferCache = new Map();
    this.failedUrls = new Set();
    /** @type {Map<string, { source: AudioBufferSourceNode, gain: GainNode, panner: StereoPannerNode, logicalUrl: string, resolvedUrl: string }>} */
    this.loops = new Map();
    /** @type {Set<AudioBufferSourceNode>} */
    this.oneShots = new Set();
    /** One-shots that follow the listener: pan + (optional) gain from emitter vs listener each tick. */
    /** @type {Set<{ panner: StereoPannerNode, gain: GainNode, emitterX: number, emitterY: number, staticGainScale?: number, updatePan: boolean }>} */
    this._mobilePannerRows = new Set();
    /** beehive loop: pending `stopLoop` after fade; cleared on re-`ensure` or `stopLoop`. */
    this._loopFadeOutTimers = new Map();
    /** @type {Promise<void>|null} */
    this._variantLoadPromise = null;
    /** @type {Record<string, string[]>|null} */
    this._variantGroups = null;
    /** Bumped only in `stopLoop`; `ensureLoop` async snapshots this so a late `loadBuffer` does not `start()`. */
    /** @type {Map<string, number>} */
    this._loopStopGen = new Map();
  }

  getOrCreateContext() {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) {
      return null;
    }
    if (this.ctx) {
      this._ensureMasterOut();
      return this.ctx;
    }
    this.ctx = new AC();
    this._masterOut = this.ctx.createGain();
    this._masterOut.gain.value = 1;
    this._masterOut.connect(this.ctx.destination);
    return this.ctx;
  }

  _ensureMasterOut() {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    if (!this._masterOut) {
      this._masterOut = ctx.createGain();
      this._masterOut.gain.value = 1;
      this._masterOut.connect(this.ctx.destination);
    }
  }

  /**
   * @param {number} linear 0..1; scales all ambient and world one-shots / loops.
   */
  setSfxVolume(linear) {
    this.getOrCreateContext();
    this._ensureMasterOut();
    const g = this._masterOut;
    if (!g) {
      return;
    }
    const t = Number(linear);
    g.gain.value = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1;
  }

  async resumeFromUserGesture() {
    const ctx = this.getOrCreateContext();
    if (!ctx) {
      return false;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state === 'running') {
      this.ensureVariantManifest();
    }
    return ctx.state === 'running';
  }

  /**
   * Fetches `variant-manifest.json` once (cached). Safe if missing.
   */
  ensureVariantManifest() {
    if (this._variantLoadPromise) {
      return this._variantLoadPromise;
    }
    this._variantLoadPromise = (async () => {
      this._variantGroups = {};
      try {
        const base = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
        const res = await fetch(`${base}/sounds/ambient/variant-manifest.json`, { cache: 'no-cache' });
        if (res.ok) {
          const data = await res.json();
          if (data?.groups && typeof data.groups === 'object') {
            this._variantGroups = data.groups;
          }
        }
      } catch {
        this._variantGroups = {};
      }
    })();
    return this._variantLoadPromise;
  }

  /**
   * @param {string} url path under public e.g. /sounds/ambient/x.ogg
   */
  async loadBuffer(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url);
    }
    const ctx = this.getOrCreateContext();
    if (!ctx) {
      return null;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      this.bufferCache.set(url, buf);
      return buf;
    } catch (e) {
      if (!this.failedUrls.has(url)) {
        this.failedUrls.add(url);
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[ambient] missing or bad audio', url, e?.message || e);
        }
      }
      return null;
    }
  }

  /**
   * @param {object} opts
   * @param {string} opts.url
   * @param {number} opts.gain linear 0..1
   * @param {number} opts.pan -1..1 (initial; mobile follow updates via `updateListenerForMobileOneShots` each tick when tracking)
   * @param {boolean} opts.flightSweep
   * @param {number} [opts.sweepMs]
   * @param {number} [opts.emitterX] integer tile (mobile); with `emitterY` and `staticGainScale` for per-tick pan/gain (non–flight-sweep)
   * @param {number} [opts.emitterY] integer tile
   * @param {number} [opts.staticGainScale] `act * 0.9 * one_shot_gain` — distance factor applied via `gainFromDistance` each tick
   */
  playOneShot(opts) {
    const ctx = this.getOrCreateContext();
    if (!ctx || ctx.state !== 'running') {
      return;
    }
    const logicalUrl = opts?.url;
    const gain = Math.max(0, Math.min(1, Number(opts?.gain) || 0));
    if (gain <= 0 || !logicalUrl) {
      return;
    }
    this.ensureVariantManifest().then(() => {
      const url = pickAmbientVariantUrl(
        logicalUrl,
        this._variantGroups,
        () => Math.random(),
      );
      return this.bufferCache.has(url)
        ? Promise.resolve(this.bufferCache.get(url))
        : this.loadBuffer(url);
    }).then((buf) => {
      if (!buf || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, Number(opts?.pan) || 0));
      src.connect(g);
      g.connect(panner);
      this._ensureMasterOut();
      panner.connect(this._masterOut || this.ctx.destination);
      this.oneShots.add(src);
      const flight = opts?.flightSweep && Number.isFinite(Number(opts.sweepMs)) && Number(opts.sweepMs) > 50;
      const ex = Number(opts?.emitterX);
      const ey = Number(opts?.emitterY);
      const sgs = Number(opts?.staticGainScale);
      const hasFollowGain = Number.isFinite(sgs) && sgs >= 0;
      const intEmitter = Number.isFinite(ex) && Math.floor(ex) === ex
        && Number.isFinite(ey) && Math.floor(ey) === ey;
      const trackPan = !flight && intEmitter;
      let pannerRow = null;
      if (intEmitter && (hasFollowGain || trackPan)) {
        pannerRow = {
          panner, gain: g, emitterX: ex, emitterY: ey, updatePan: trackPan,
        };
        if (hasFollowGain) {
          pannerRow.staticGainScale = sgs;
        }
        this._mobilePannerRows.add(pannerRow);
      }
      src.onended = () => {
        this.oneShots.delete(src);
        if (pannerRow) {
          this._mobilePannerRows.delete(pannerRow);
        }
        try {
          src.disconnect();
          g.disconnect();
          panner.disconnect();
        } catch {
          /* ignore */
        }
      };
      if (flight) {
        const t0 = this.ctx.currentTime;
        const dur = Math.min(buf.duration * 0.95, Number(opts.sweepMs) / 1000);
        panner.pan.setValueAtTime(-0.85, t0);
        panner.pan.linearRampToValueAtTime(0.85, t0 + dur);
      }
      src.start();
    });
  }

  /**
   * Per tick: recompute pan (and, when `staticGainScale` was set on play, distance gain) for mobile
   * one-shots that track the emitter. Call with the same listener coords as `computeMobileAmbientOneShots` / `panFromDelta` / `gainFromDistance` use.
   *
   * @param {number} camX listener X in float tile space
   * @param {number} camY listener Y in float tile space
   */
  updateListenerForMobileOneShots(camX, camY) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this._mobilePannerRows.size === 0) {
      return;
    }
    const t0 = ctx.currentTime;
    for (const row of this._mobilePannerRows) {
      try {
        if (row.staticGainScale != null && Number.isFinite(row.staticGainScale) && row.gain) {
          const gLin = Math.max(0, Math.min(
            1,
            gainFromDistance(camX, camY, row.emitterX, row.emitterY) * row.staticGainScale,
          ));
          row.gain.gain.setTargetAtTime(gLin, t0, 0.04);
        }
        if (row.updatePan) {
          const p = panFromDelta(camX, camY, row.emitterX, row.emitterY);
          row.panner.pan.setTargetAtTime(p, t0, 0.04);
        }
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Stops the current graph for `loopId` if any, without bumping `_loopStopGen`.
   * Used when **replacing** a loop so in-flight async completions do not leave a second
   * `BufferSourceNode` running (map only holds one row; older sources would be untracked).
   */
  _clearLoopFadeOutTimer(loopId) {
    const t = this._loopFadeOutTimers.get(loopId);
    if (t) {
      clearTimeout(t);
      this._loopFadeOutTimers.delete(loopId);
    }
  }

  /**
   * Ramps `loopId` gain to 0, then `stopLoop` (used for beehive so it does not cut off when leaving range).
   * @param {string} loopId
   * @param {number} [durationSec=0.5]
   */
  fadeOutAndStopLoop(loopId, durationSec = 0.5) {
    // If a fade is already in progress, do not clear/reschedule: `AmbientAudioBridge` sends
    // `{ op: 'stop' }` every tick while out of range, which would otherwise reset the
    // setTimeout and never call `stopLoop` (buzzing forever at low gain or full level).
    if (this._loopFadeOutTimers.has(loopId)) {
      return;
    }
    const row = this.loops.get(loopId);
    if (!row || !this.ctx) {
      this.stopLoop(loopId);
      return;
    }
    const dur = Math.max(0.05, Math.min(3, Number(durationSec) || 0.5));
    const t0 = this.ctx.currentTime;
    const p = row.gain.gain;
    p.cancelScheduledValues(t0);
    p.setValueAtTime(p.value, t0);
    p.linearRampToValueAtTime(0, t0 + dur);
    const tid = setTimeout(() => {
      this._loopFadeOutTimers.delete(loopId);
      this.stopLoop(loopId);
    }, dur * 1000 + 100);
    this._loopFadeOutTimers.set(loopId, tid);
  }

  detachLoopPlayback(loopId) {
    this._clearLoopFadeOutTimer(loopId);
    const row = this.loops.get(loopId);
    if (!row) {
      return;
    }
    try {
      row.source.stop();
      row.source.disconnect();
      row.gain.disconnect();
      row.panner.disconnect();
    } catch {
      /* ignore */
    }
    this.loops.delete(loopId);
  }

  /**
   * Start or update a looping source (restarts if url changes).
   */
  ensureLoop(loopId, logicalUrl, gainLinear, pan) {
    const ctx = this.getOrCreateContext();
    if (!ctx || ctx.state !== 'running') {
      return;
    }
    const gLin = Math.max(0, Math.min(1, Number(gainLinear) || 0));
    if (gLin <= 0.001) {
      this.stopLoop(loopId);
      return;
    }
    this._clearLoopFadeOutTimer(loopId);
    const existing = this.loops.get(loopId);
    if (existing && existing.logicalUrl === logicalUrl) {
      const t0 = ctx.currentTime;
      const gParam = existing.gain.gain;
      gParam.cancelScheduledValues(t0);
      gParam.setValueAtTime(gParam.value, t0);
      gParam.setTargetAtTime(gLin, t0, 0.05);
      existing.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t0, 0.05);
      return;
    }
    if (existing) {
      this.stopLoop(loopId);
    }
    const stopGenAtStart = this._loopStopGen.get(loopId) || 0;
    this.ensureVariantManifest().then(() => {
      if ((this._loopStopGen.get(loopId) || 0) !== stopGenAtStart) {
        return { buf: null, resolvedUrl: '', cancelled: true };
      }
      const resolvedUrl = pickAmbientVariantUrl(
        logicalUrl,
        this._variantGroups,
        () => Math.random(),
      );
      return (this.bufferCache.has(resolvedUrl)
        ? Promise.resolve(this.bufferCache.get(resolvedUrl))
        : this.loadBuffer(resolvedUrl)
      ).then((buf) => ({ buf, resolvedUrl, cancelled: false }));
    }).then((row) => {
      if (!row || row.cancelled) {
        return;
      }
      if ((this._loopStopGen.get(loopId) || 0) !== stopGenAtStart) {
        return;
      }
      const buf = row.buf;
      const resolvedUrl = row.resolvedUrl;
      if (!buf || !this.ctx || this.ctx.state !== 'running' || !logicalUrl) {
        return;
      }
      this.detachLoopPlayback(loopId);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = gLin;
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(g);
      g.connect(panner);
      this._ensureMasterOut();
      panner.connect(this._masterOut || this.ctx.destination);
      src.start();
      this.loops.set(loopId, {
        source: src, gain: g, panner, logicalUrl, resolvedUrl,
      });
    });
  }

  stopLoop(loopId) {
    this._clearLoopFadeOutTimer(loopId);
    this._loopStopGen.set(
      loopId,
      (this._loopStopGen.get(loopId) || 0) + 1,
    );
    const row = this.loops.get(loopId);
    if (!row) {
      return;
    }
    try {
      row.source.stop();
      row.source.disconnect();
      row.gain.disconnect();
      row.panner.disconnect();
    } catch {
      /* ignore */
    }
    this.loops.delete(loopId);
  }

  stopAllLoops() {
    for (const id of [...this._loopFadeOutTimers.keys()]) {
      this._clearLoopFadeOutTimer(id);
    }
    for (const id of [...this.loops.keys()]) {
      this.stopLoop(id);
    }
  }

  dispose() {
    this.stopAllLoops();
    for (const s of [...this.oneShots]) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    this.oneShots.clear();
    this._mobilePannerRows.clear();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this._masterOut = null;
    this.ctx = null;
    this.bufferCache.clear();
    this._variantLoadPromise = null;
    this._variantGroups = null;
    this._loopStopGen.clear();
  }
}
