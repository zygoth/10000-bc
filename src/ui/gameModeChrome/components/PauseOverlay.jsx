import { useEffect, useState } from 'react';

function formatPct01(v) {
  return `${Math.round((Number(v) || 0) * 100)}%`;
}

export default function PauseOverlay({
  isOpen,
  onClosePauseMenu,
  onSwitchToDebug,
  onReturnToTitleScreen,
  onSaveGame,
  onLoadGame,
  showAnchorDebug,
  onToggleAnchorDebug,
  musicVolume = 1,
  sfxVolume = 1,
  onChangeMusicVolume,
  onChangeSfxVolume,
}) {
  const [subPanel, setSubPanel] = useState('main');

  useEffect(() => {
    if (!isOpen) {
      setSubPanel('main');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pause-overlay" role="dialog" aria-label="Pause menu">
      <div className="pause-card">
        {subPanel === 'settings' ? (
          <>
            <h2>Settings</h2>
            <div className="pause-settings">
              <label className="pause-settings-row" htmlFor="pause-music-vol">
                <span className="pause-settings-label">Music</span>
                <input
                  id="pause-music-vol"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(musicVolume * 100)}
                  onChange={(e) => onChangeMusicVolume?.(Number(e.target.value) / 100)}
                />
                <span className="pause-settings-pct" aria-hidden="true">{formatPct01(musicVolume)}</span>
              </label>
              <label className="pause-settings-row" htmlFor="pause-sfx-vol">
                <span className="pause-settings-label">Sound effects</span>
                <input
                  id="pause-sfx-vol"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(sfxVolume * 100)}
                  onChange={(e) => onChangeSfxVolume?.(Number(e.target.value) / 100)}
                />
                <span className="pause-settings-pct" aria-hidden="true">{formatPct01(sfxVolume)}</span>
              </label>
            </div>
            <p className="pause-settings-hint">Ambient and world sounds; separate from the music above.</p>
            <div className="pause-actions">
              <button type="button" onClick={() => setSubPanel('main')}>Back</button>
            </div>
          </>
        ) : (
          <>
            <h2>Paused</h2>
            <div className="pause-actions">
              <button type="button" onClick={onClosePauseMenu}>Resume</button>
              <button type="button" onClick={onSaveGame}>Save Game</button>
              <button type="button" onClick={onLoadGame}>Load Game</button>
              <button type="button" onClick={onSwitchToDebug}>Debug View</button>
              <button type="button" onClick={onReturnToTitleScreen}>Return to Title Screen</button>
              <button type="button" onClick={() => setSubPanel('settings')}>Settings</button>
              <button type="button" onClick={onToggleAnchorDebug}>
                Anchor Debug: {showAnchorDebug ? 'on' : 'off'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
