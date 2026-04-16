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

const FOLLOW_PER_FRAME = 0.12;

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

export function setCameraFollowActive(v) {
  followActive = !!v;
}

export function getCameraFollowActive() {
  return followActive;
}

/** While following, the camera eases toward the player — not a one-off move destination. */
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
  const c = clamp(px, py);
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
