import {
  useCallback, useEffect, useState,
} from 'react';
import {
  clearCameraDebugBuffer,
  downloadCameraDebugLog,
  getCameraDebugLineCount,
} from './cameraDebug.js';

/**
 * Dev-only: record camera diagnostics and save to a file with one click (no servers, no localStorage recipes).
 */
export default function CameraDebugPanel() {
  const isDev = process.env.NODE_ENV === 'development';

  const [recording, setRecording] = useState(() => {
    try {
      return window.localStorage?.getItem('10000bc_debug_camera') === '1';
    } catch {
      return false;
    }
  });
  const [verbose, setVerbose] = useState(() => {
    try {
      return window.localStorage?.getItem('10000bc_debug_camera_verbose') === '1';
    } catch {
      return false;
    }
  });
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    if (!isDev) {
      return undefined;
    }
    window.__10000BC_CAMERA_RECORDING__ = recording;
    try {
      if (recording) {
        window.localStorage.setItem('10000bc_debug_camera', '1');
      } else {
        window.localStorage.removeItem('10000bc_debug_camera');
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }, [isDev, recording]);

  useEffect(() => {
    if (!isDev) {
      return undefined;
    }
    window.__10000BC_DEBUG_CAMERA_VERBOSE__ = verbose;
    try {
      if (verbose) {
        window.localStorage.setItem('10000bc_debug_camera_verbose', '1');
      } else {
        window.localStorage.removeItem('10000bc_debug_camera_verbose');
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }, [isDev, verbose]);

  useEffect(() => {
    if (!isDev || !recording) {
      return undefined;
    }
    const tick = () => setLineCount(getCameraDebugLineCount());
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [isDev, recording]);

  const onSave = useCallback(() => {
    downloadCameraDebugLog();
  }, []);

  const onClear = useCallback(() => {
    clearCameraDebugBuffer();
    setLineCount(0);
  }, []);

  if (!isDev) {
    return null;
  }

  return (
    <div
      className="camera-debug-panel"
      role="region"
      aria-label="Camera debug (development only)"
    >
      <div className="camera-debug-panel__row">
        <label className="camera-debug-panel__label">
          <input
            type="checkbox"
            checked={recording}
            onChange={(e) => setRecording(e.target.checked)}
          />
          Record camera
        </label>
        <span className="camera-debug-panel__meta">{lineCount} lines</span>
      </div>
      <div className="camera-debug-panel__row">
        <label className="camera-debug-panel__label" title="Logs every sample to the browser console (very noisy)">
          <input
            type="checkbox"
            checked={verbose}
            onChange={(e) => setVerbose(e.target.checked)}
            disabled={!recording}
          />
          Verbose console
        </label>
      </div>
      <div className="camera-debug-panel__actions">
        <button type="button" className="camera-debug-panel__btn" onClick={onSave}>
          Save log file…
        </button>
        <button type="button" className="camera-debug-panel__btn camera-debug-panel__btn--ghost" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
