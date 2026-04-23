/**
 * Camera diagnostics: when recording is enabled, mirror recent events to
 * `window.__10000BC_CAMERA_LOG__` (ring buffer) and optionally the console.
 *
 * Enable recording: `window.__10000BC_DEBUG_CAMERA__ = true` before load,
 * `window.__10000BC_CAMERA_RECORDING__ = true`, or localStorage key
 * `10000bc_debug_camera` = `1`.
 *
 * Verbose console: `window.__10000BC_DEBUG_CAMERA_VERBOSE__ = true` or
 * localStorage `10000bc_debug_camera_verbose` = `1`.
 */

import { tileAnchorFromFloat } from './pixi/isoCameraRoll.js';

const STORAGE_RECORD = '10000bc_debug_camera';
const STORAGE_VERBOSE = '10000bc_debug_camera_verbose';
const RING_MAX = 48;

const ring = [];

function pushRing(type, data) {
  ring.push({ type, ts: typeof performance !== 'undefined' ? performance.now() : 0, ...data });
  if (ring.length > RING_MAX) {
    ring.splice(0, ring.length - RING_MAX);
  }
  if (typeof window !== 'undefined') {
    window.__10000BC_CAMERA_LOG__ = ring.slice();
  }
}

function isCameraRecording() {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.__10000BC_CAMERA_RECORDING__ === true) {
    return true;
  }
  if (window.__10000BC_DEBUG_CAMERA__ === true) {
    return true;
  }
  try {
    return window.localStorage?.getItem(STORAGE_RECORD) === '1';
  } catch {
    return false;
  }
}

function isCameraVerbose() {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.__10000BC_DEBUG_CAMERA__ === true) {
    return true;
  }
  if (window.__10000BC_DEBUG_CAMERA_VERBOSE__ === true) {
    return true;
  }
  try {
    return window.localStorage?.getItem(STORAGE_VERBOSE) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {number} prevX
 * @param {number} prevY
 * @param {number} nextX
 * @param {number} nextY
 * @param {{ src?: string, floor?: [number, number], emittedReactFloor?: boolean }} detail
 */
export function cameraDebugOnGameCameraCommit(prevX, prevY, nextX, nextY, detail = {}) {
  if (!isCameraRecording()) {
    return;
  }
  const d = Math.hypot(nextX - prevX, nextY - prevY);
  const prevA = tileAnchorFromFloat(prevX, prevY);
  const nextA = tileAnchorFromFloat(nextX, nextY);
  const anchorCrossed = prevA.x !== nextA.x || prevA.y !== nextA.y;
  const teleport = d > 1.25;
  const payload = {
    src: detail.src || 'commitGameCamera',
    prev: { x: prevX, y: prevY },
    next: { x: nextX, y: nextY },
    d,
    prevAnchor: prevA,
    nextAnchor: nextA,
    anchorCrossed,
    floor: detail.floor,
    emittedReactFloor: detail.emittedReactFloor,
    teleport,
  };
  pushRing('commit', payload);
  if (isCameraVerbose()) {
    // eslint-disable-next-line no-console
    console.log('[10000bc camera] commit', payload);
  }
  if (teleport) {
    // eslint-disable-next-line no-console
    console.warn('[10000bc camera] teleport', payload);
  }
}

/**
 * @param {{ anchorX: number, anchorY: number, propCameraX: number, propCameraY: number, floatX: number, floatY: number, gameStateVersion: number }} p
 */
export function cameraDebugOnPixiSyncAnchors(p) {
  if (!isCameraRecording()) {
    return;
  }
  const mismatch =
    p.anchorX !== p.propCameraX
    || p.anchorY !== p.propCameraY;
  const severeMismatch =
    Math.abs(p.anchorX - p.propCameraX) > 1
    || Math.abs(p.anchorY - p.propCameraY) > 1;
  const payload = { ...p, mismatch, severeMismatch };
  pushRing('pixiSync', payload);
  if (isCameraVerbose()) {
    // eslint-disable-next-line no-console
    console.log('[10000bc camera] pixi sync anchors', payload);
  }
  if (severeMismatch) {
    // eslint-disable-next-line no-console
    console.warn('[10000bc camera] pixiSyncSevereMismatch', payload);
  }
}

/**
 * @param {{ cx: number, cy: number, tx: number, ty: number, nx: number, ny: number }} p
 */
export function cameraDebugOnFollowStep(p) {
  if (!isCameraRecording()) {
    return;
  }
  const step = Math.hypot(p.nx - p.cx, p.ny - p.cy);
  const toTarget = Math.hypot(p.tx - p.cx, p.ty - p.cy);
  const expectedMax = toTarget * 0.125;
  const badStep = step > expectedMax + 0.05 && toTarget > 0.01;
  const payload = { ...p, step, toTarget, expectedMax, badStep };
  pushRing('follow', payload);
  if (isCameraVerbose()) {
    // eslint-disable-next-line no-console
    console.log('[10000bc camera] follow', payload);
  }
  if (badStep) {
    // eslint-disable-next-line no-console
    console.warn('[10000bc camera] followBadStep', payload);
  }
}
