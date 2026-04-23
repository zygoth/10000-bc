/**
 * Imperative game camera: float position, follow target, and clamp bounds.
 * Updated by Pixi's per-frame loop (not React). Simulation ticks bump
 * `simulationTickCameraGeneration` via gameStore subscription.
 */

import { getGameState, subscribeToGameState } from '../game/gameStore.mjs';
import { cameraDebugOnFollowStep } from './cameraDebug.js';

/** @type {{ current: { x: number, y: number } }} */
export const gameCameraFloatRef = { current: { x: 32, y: 35 } };

let targetX = 32;
let targetY = 35;
let followActive = true;

let minX = 0;
let maxX = 1e9;
let minY = 0;
let maxY = 1e9;

const FOLLOW_PER_FRAME = 0.03;

/** Time constant for exponential decay of look-ahead offset (ms). */
export const LOOKAHEAD_DECAY_TAU_MS = 600;
/** Tiles added along each move axis per validated click. */
export const LOOKAHEAD_PER_CLICK = 0.28;
/** Max absolute look-ahead per axis (tiles). */
export const LOOKAHEAD_MAX_PER_AXIS = 2.5;

let lookAheadX = 0;
let lookAheadY = 0;

/** Last `performance.now()` inside `stepGameCameraFollow` when follow was active. */
let lastFollowStepMs = null;

/** Incremented on each `advanceTick` refresh (meta.kind === 'tick'). */
let simulationTickCameraGeneration = 0;

export function getSimulationTickCameraGeneration() {
  return simulationTickCameraGeneration;
}

subscribeToGameState((meta) => {
  if (meta?.kind === 'tick') {
    simulationTickCameraGeneration += 1;
  }
});

export function setGameCameraClampBounds(bounds) {
  minX = bounds.minX;
  maxX = bounds.maxX;
  minY = bounds.minY;
  maxY = bounds.maxY;
}

function clamp(x, y) {
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

export function setGameCameraTarget(x, y) {
  const c = clamp(Number(x), Number(y));
  targetX = c.x;
  targetY = c.y;
}

function resetGameCameraLookAhead() {
  lookAheadX = 0;
  lookAheadY = 0;
}

/**
 * Exponential decay of a 2D offset (used by follow step and tests).
 * @param {number} x
 * @param {number} y
 * @param {number} dtMs
 * @param {number} tauMs
 */
export function decayLookAhead2d(x, y, dtMs, tauMs) {
  if (!Number.isFinite(dtMs) || dtMs <= 0) {
    return { x, y };
  }
  if (!Number.isFinite(tauMs) || tauMs <= 0) {
    return { x: 0, y: 0 };
  }
  const k = Math.exp(-dtMs / tauMs);
  return { x: x * k, y: y * k };
}

export function setCameraFollowActive(v) {
  const next = !!v;
  if (followActive && !next) {
    resetGameCameraLookAhead();
  }
  if (followActive !== next) {
    lastFollowStepMs = null;
  }
  followActive = next;
}

export function getCameraFollowActive() {
  return followActive;
}

/**
 * After a validated tile `move`, bias the follow target ahead of the player.
 * No-op when not following or when both deltas are zero.
 */
export function bumpGameCameraLookAheadForMove(dx, dy) {
  if (!followActive) {
    return;
  }
  const ix = Number(dx) || 0;
  const iy = Number(dy) || 0;
  if (ix === 0 && iy === 0) {
    return;
  }

  const dot = ix * lookAheadX + iy * lookAheadY;
  if (dot < 0) {
    lookAheadX *= 0.5;
    lookAheadY *= 0.5;
  }

  lookAheadX += LOOKAHEAD_PER_CLICK * ix;
  lookAheadY += LOOKAHEAD_PER_CLICK * iy;

  lookAheadX = Math.max(-LOOKAHEAD_MAX_PER_AXIS, Math.min(LOOKAHEAD_MAX_PER_AXIS, lookAheadX));
  lookAheadY = Math.max(-LOOKAHEAD_MAX_PER_AXIS, Math.min(LOOKAHEAD_MAX_PER_AXIS, lookAheadY));
}

/** While following, the camera eases toward the player (+ look-ahead) — not a one-off move destination. */
function syncFollowTargetToPlayer() {
  const state = getGameState();
  const p = state?.actors?.player;
  if (!p) {
    return;
  }
  const px = Number(p.x);
  const py = Number(p.y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    return;
  }
  const c = clamp(px + lookAheadX, py + lookAheadY);
  targetX = c.x;
  targetY = c.y;
}

/**
 * Lerp float toward follow target. Call from the Pixi view's animation loop only.
 */
export function stepGameCameraFollow() {
  if (!followActive) {
    return;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (lastFollowStepMs != null) {
    const dtMs = Math.max(0, now - lastFollowStepMs);
    const d = decayLookAhead2d(lookAheadX, lookAheadY, dtMs, LOOKAHEAD_DECAY_TAU_MS);
    lookAheadX = d.x;
    lookAheadY = d.y;
    if (Math.abs(lookAheadX) < 1e-4 && Math.abs(lookAheadY) < 1e-4) {
      lookAheadX = 0;
      lookAheadY = 0;
    }
  }
  lastFollowStepMs = now;

  syncFollowTargetToPlayer();
  const tx = targetX;
  const ty = targetY;
  const cx = gameCameraFloatRef.current.x;
  const cy = gameCameraFloatRef.current.y;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx * dx + dy * dy < 1e-12) {
    return;
  }
  let nx = cx + dx * FOLLOW_PER_FRAME;
  let ny = cy + dy * FOLLOW_PER_FRAME;
  if (Math.abs(tx - nx) < 0.001) nx = tx;
  if (Math.abs(ty - ny) < 0.001) ny = ty;
  const c = clamp(nx, ny);
  cameraDebugOnFollowStep({ cx, cy, tx, ty, nx: c.x, ny: c.y });
  gameCameraFloatRef.current.x = c.x;
  gameCameraFloatRef.current.y = c.y;
}

/** Snap float + target together (new game, load, enter play). */
export function snapGameCameraFloatAndTarget(x, y) {
  resetGameCameraLookAhead();
  lastFollowStepMs = null;
  const c = clamp(Number(x), Number(y));
  gameCameraFloatRef.current.x = c.x;
  gameCameraFloatRef.current.y = c.y;
  targetX = c.x;
  targetY = c.y;
}

/**
 * Write clamped float (pan, observer drag, etc.). Returns values for React floor + debug.
 */
export function applyClampedGameCameraFloatWrite(nx, ny) {
  const prevX = gameCameraFloatRef.current.x;
  const prevY = gameCameraFloatRef.current.y;
  const c = clamp(Number(nx), Number(ny));
  gameCameraFloatRef.current.x = c.x;
  gameCameraFloatRef.current.y = c.y;
  return { prevX, prevY, cx: c.x, cy: c.y };
}
