/**
 * Camera diagnostics: record events in memory, download as JSONL from the dev panel (or
 * `window.__10000BC_DOWNLOAD_CAMERA_LOG__()`).
 *
 * Legacy: `window.__10000BC_DEBUG_CAMERA__ = true` before load → recording + verbose console.
 */

import { tileAnchorFromFloat } from './pixi/isoCameraRoll.js';

const STORAGE_RECORD = '10000bc_debug_camera';
const STORAGE_VERBOSE = '10000bc_debug_camera_verbose';
const RING_MAX = 48;
const FULL_MAX = 25000;

const ring = [];
/** @type {object[]} */
let fullLog = [];

function pushRing(type, data) {
  ring.push({ type, ts: typeof performance !== 'undefined' ? performance.now() : 0, ...data });
  if (ring.length > RING_MAX) {
    ring.splice(0, ring.length - RING_MAX);
  }
  if (typeof window !== 'undefined') {
    window.__10000BC_CAMERA_LOG__ = ring.slice();
  }
}

function recordFullLine(line) {
  fullLog.push(line);
  if (fullLog.length > FULL_MAX) {
    fullLog = fullLog.slice(-FULL_MAX);
  }
  if (typeof window !== 'undefined') {
    window.__10000BC_CAMERA_LOG_FULL__ = fullLog.slice();
  }
}

/** Recording is on (buffer fills). */
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

/** Also mirror every event to the browser console (noisy). */
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

export function isCameraDebugEnabled() {
  return isCameraRecording();
}

export function getCameraDebugLineCount() {
  return fullLog.length;
}

export function clearCameraDebugBuffer() {
  fullLog = [];
  ring.length = 0;
  if (typeof window !== 'undefined') {
    window.__10000BC_CAMERA_LOG__ = [];
    window.__10000BC_CAMERA_LOG_FULL__ = [];
  }
}

/** Download everything recorded so far as one `.jsonl` file (browser save dialog). */
export function downloadCameraDebugLog() {
  if (typeof document === 'undefined') {
    return;
  }
  const lines = fullLog.length > 0 ? fullLog : (typeof window !== 'undefined' && window.__10000BC_CAMERA_LOG_FULL__) || [];
  const text = lines.map((o) => JSON.stringify(o)).join('\n');
  const blob = new Blob([text], { type: 'application/x-ndjson;charset=utf-8' });
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = URL.createObjectURL(blob);
  a.download = `10000bc-camera-${stamp}.jsonl`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

if (typeof window !== 'undefined') {
  window.__10000BC_DOWNLOAD_CAMERA_LOG__ = downloadCameraDebugLog;
}

/** @param {string} tag */
export function cameraDebugLog(tag, payload = {}) {
  if (!isCameraRecording()) {
    return;
  }
  const line = {
    kind: tag,
    tPerf: typeof performance !== 'undefined' ? performance.now() : 0,
    tWall: Date.now(),
    ...payload,
  };
  pushRing(tag, line);
  recordFullLine(line);
  if (isCameraVerbose()) {
    // eslint-disable-next-line no-console
    console.log('[10000bc camera]', tag, line);
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
  recordFullLine({
    kind: 'commit',
    tPerf: typeof performance !== 'undefined' ? performance.now() : 0,
    tWall: Date.now(),
    ...payload,
  });
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
  recordFullLine({
    kind: 'pixiSync',
    tPerf: typeof performance !== 'undefined' ? performance.now() : 0,
    tWall: Date.now(),
    ...payload,
  });
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
  recordFullLine({
    kind: 'follow',
    tPerf: typeof performance !== 'undefined' ? performance.now() : 0,
    tWall: Date.now(),
    ...payload,
  });
  if (isCameraVerbose()) {
    // eslint-disable-next-line no-console
    console.log('[10000bc camera] follow', payload);
  }
  if (badStep) {
    // eslint-disable-next-line no-console
    console.warn('[10000bc camera] followBadStep', payload);
  }
}
