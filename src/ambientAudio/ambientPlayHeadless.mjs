import { resolveDayActivityFactor } from './dayActivity.mjs';
import {
  isBeehiveTileEligible,
  isCampfireEligible,
  isPartnerWorkEligible,
} from './ambientEligibility.mjs';
import { chebyshev } from './ambientMath.mjs';

/** Chebyshev distance (tiles) from **listener** to emitter for mobile one-shots. ~viewport-scale, not world-wide. */
export const AMBIENT_MOBILE_LISTEN_CHEBYSHEV = 8;

export function floorListenerTile(v) {
  return Math.floor(Number(v) || 0);
}

function speciesGlobalCooldownKey(speciesId) {
  return `species:${speciesId}`;
}

export function pickWeightedCall(entry, rng) {
  const calls = Array.isArray(entry?.calls) ? entry.calls : [];
  if (calls.length === 0) {
    return null;
  }
  let sum = 0;
  for (const c of calls) {
    sum += Math.max(0, Number(c.pick_weight) || 0);
  }
  if (sum <= 0) {
    return calls[0];
  }
  let r = rng() * sum;
  for (const c of calls) {
    r -= Math.max(0, Number(c.pick_weight) || 0);
    if (r <= 0) {
      return c;
    }
  }
  return calls[calls.length - 1];
}

export function panFromDelta(camX, camY, ex, ey) {
  const dx = (ex + 0.5) - camX;
  const scale = 6;
  return Math.max(-1, Math.min(1, dx / scale));
}

export function gainFromDistance(camX, camY, ex, ey) {
  const d = Math.hypot((ex + 0.5) - camX, (ey + 0.5) - camY);
  return 0.55 / (1 + d * 0.28);
}

/**
 * Headless mobile one-shot pass (same rules as AmbientAudioBridge tick).
 * Mutates `cooldownUntil` Map in place (same as runtime bridge).
 *
 * @param {object} p
 * @param {number} p.nowMs
 * @param {number} p.dtSec
 * @param {number} p.dayTick
 * @param {number} p.lx
 * @param {number} p.ly
 * @param {number} p.camX listener X (float tile space; use **player** + 0.5, not camera — camera lags in play)
 * @param {number} p.camY listener Y
 * @param {object[]} p.mobileEntries
 * @param {object[]} p.emitters
 * @param {number} [p.listenR]
 * @param {Map<string, number>} p.cooldownUntil
 * @param {() => number} p.rng 0..1
 * @returns {{ url: string, gain: number, staticGainScale: number, pan: number, flightSweep: boolean, sweepMs: number, speciesId: string, emitterKey: string, emitterX: number, emitterY: number }[]}
 */
export function computeMobileAmbientOneShots(p) {
  const {
    nowMs,
    dtSec,
    dayTick,
    lx,
    ly,
    camX,
    camY,
    mobileEntries,
    emitters,
    listenR = AMBIENT_MOBILE_LISTEN_CHEBYSHEV,
    cooldownUntil,
    rng,
  } = p;

  const out = [];
  for (const entry of mobileEntries) {
    const sid = entry.species_id;
    if (nowMs < (cooldownUntil.get(speciesGlobalCooldownKey(sid)) || 0)) {
      continue;
    }
    const near = emitters.filter(
      (e) => e.speciesId === sid && chebyshev(e.x, e.y, lx, ly) <= listenR,
    );
    if (near.length === 0) {
      continue;
    }
    const act = resolveDayActivityFactor(entry, dayTick);
    if (act <= 0) {
      continue;
    }
    const minGap = Math.max(0.5, Number(entry?.scheduling?.min_seconds_between_calls_same_emitter) || 4);
    const minSpeciesS = Number(entry?.scheduling?.min_seconds_between_calls_same_species);
    const minBetweenAny = (Number.isFinite(minSpeciesS) && minSpeciesS > 0)
      ? minSpeciesS
      : 2.5;
    const rollScale = Math.max(0, Math.min(1, Number(entry?.scheduling?.mobile_roll_scale) || 1));
    const baseChance = 0.03 * act * Math.min(1, dtSec / 0.016) * rollScale;
    if (rng() > baseChance) {
      continue;
    }
    const em = near[Math.floor(rng() * near.length)];
    const key = `${sid}@${em.x},${em.y}`;
    if (nowMs < (cooldownUntil.get(key) || 0)) {
      continue;
    }
    const call = pickWeightedCall(entry, rng);
    if (!call?.url) {
      continue;
    }
    cooldownUntil.set(key, nowMs + minGap * 1000);
    cooldownUntil.set(speciesGlobalCooldownKey(sid), nowMs + minBetweenAny * 1000);
    const oneShot = Number(entry?.one_shot_gain);
    const oneShotScale = (Number.isFinite(oneShot) && oneShot >= 0) ? oneShot : 1;
    const staticGainScale = act * 0.9 * oneShotScale;
    const g = gainFromDistance(camX, camY, em.x, em.y) * staticGainScale;
    const pan = panFromDelta(camX, camY, em.x, em.y);
    out.push({
      url: call.url,
      gain: g,
      staticGainScale,
      pan,
      flightSweep: call.flight_call === true,
      sweepMs: Number(call.flight_pan_sweep_ms) || 800,
      speciesId: sid,
      emitterKey: key,
      emitterX: em.x,
      emitterY: em.y,
    });
  }
  return out;
}

/**
 * Loop ensure/stop commands mirroring AmbientAudioBridge (for headless assertions).
 *
 * @param {number} lx **Listener** floor tile X (player, not camera).
 * @param {number} ly **Listener** floor tile Y
 * @param {number} camX **Listener** float X (pan / distance; center of ear tile = tile + 0.5)
 * @param {number} camY **Listener** float Y
 * @returns {Array<{ op: 'ensure', loopId: string, url: string, gain: number, pan: number } | { op: 'stop', loopId: string }>}
 */
export function computeAmbientLoopCommands({
  state,
  lx,
  ly,
  camX,
  camY,
  catalog,
  dayTick,
}) {
  const cmds = [];
  let closestHive = null;
  let closestHiveDist = 999;
  const w = state.width;
  const beehiveEntry = catalog.find((e) => e.audio_role === 'sim_beehive');
  if (beehiveEntry) {
    for (let i = 0; i < state.tiles.length; i += 1) {
      const tile = state.tiles[i];
      if (!tile?.beehive?.active) {
        continue;
      }
      const x = i % w;
      const y = Math.floor(i / w);
      if (!isBeehiveTileEligible(beehiveEntry, state, { ...tile, x, y }, lx, ly)) {
        continue;
      }
      const d = chebyshev(lx, ly, x, y);
      if (d < closestHiveDist) {
        closestHiveDist = d;
        closestHive = { x, y, tile };
      }
    }
  }

  const campfireEntry = catalog.find((e) => e.audio_role === 'camp_campfire');
  if (campfireEntry && isCampfireEligible(campfireEntry, state, lx, ly)) {
    const ax = Number(state.camp?.anchorX);
    const ay = Number(state.camp?.anchorY);
    const act = resolveDayActivityFactor(campfireEntry, dayTick);
    const g = gainFromDistance(camX, camY, ax, ay) * act;
    const pan = panFromDelta(camX, camY, ax, ay);
    const call = campfireEntry.calls?.[0];
    if (call?.url) {
      cmds.push({ op: 'ensure', loopId: 'campfire', url: call.url, gain: g * 0.7, pan });
    }
  } else {
    cmds.push({ op: 'stop', loopId: 'campfire' });
  }

  const partnerEntry = catalog.find(
    (e) => e.audio_role === 'partner_station_work' && isPartnerWorkEligible(e, state, lx, ly),
  );
  if (partnerEntry) {
    const ax = Number(state.camp?.anchorX);
    const ay = Number(state.camp?.anchorY);
    const act = resolveDayActivityFactor(partnerEntry, dayTick);
    const g = gainFromDistance(camX, camY, ax, ay) * act;
    const pan = panFromDelta(camX, camY, ax, ay);
    const call = partnerEntry.calls?.[0];
    if (call?.url) {
      cmds.push({
        op: 'ensure',
        loopId: `partner_${partnerEntry.species_id}`,
        url: call.url,
        gain: g * 0.55,
        pan,
      });
    }
  } else {
    for (const e of catalog) {
      if (e.audio_role === 'partner_station_work') {
        cmds.push({ op: 'stop', loopId: `partner_${e.species_id}` });
      }
    }
  }

  if (beehiveEntry && closestHive) {
    const act = resolveDayActivityFactor(beehiveEntry, dayTick);
    const g = gainFromDistance(camX, camY, closestHive.x, closestHive.y) * act;
    const pan = panFromDelta(camX, camY, closestHive.x, closestHive.y);
    const call = beehiveEntry.calls?.[0];
    if (call?.url) {
      // Quiet vs campfire: distance curve already ~0.55; keep peak loop gain modest.
      cmds.push({ op: 'ensure', loopId: 'beehive_closest', url: call.url, gain: g * 0.18, pan });
    }
  } else {
    cmds.push({ op: 'stop', loopId: 'beehive_closest' });
  }

  return cmds;
}

/**
 * Run many headless “frames” for mobile one-shots (fixed dt, injectable RNG).
 * @param {object} opts
 * @param {number} opts.frameCount
 * @param {number} opts.dtSec
 * @param {number} opts.startNowMs
 * @param {() => number} opts.rng
 * @param {object} opts.state
 * @param {number} opts.camX
 * @param {number} opts.camY
 * @param {object[]} opts.mobileEntries
 * @param {object[]} opts.emitters
 */
export function simulateMobileOneShotFrames(opts) {
  const {
    frameCount,
    dtSec,
    startNowMs,
    rng,
    state,
    camX,
    camY,
    mobileEntries,
    emitters,
  } = opts;
  const cooldownUntil = new Map();
  const lx = floorListenerTile(camX);
  const ly = floorListenerTile(camY);
  const dayTick = Number(state?.dayTick) || 0;
  const batches = [];
  let nowMs = startNowMs;
  for (let i = 0; i < frameCount; i += 1) {
    const one = computeMobileAmbientOneShots({
      nowMs,
      dtSec,
      dayTick,
      lx,
      ly,
      camX,
      camY,
      mobileEntries,
      emitters,
      listenR: AMBIENT_MOBILE_LISTEN_CHEBYSHEV,
      cooldownUntil,
      rng,
    });
    batches.push(one);
    nowMs += dtSec * 1000;
  }
  return { batches, cooldownUntil };
}
