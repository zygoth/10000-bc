export default function PauseOverlay({
  isOpen,
  onClosePauseMenu,
  onSwitchToDebug,
  onNewGameFromSettings,
  showAnchorDebug,
  onToggleAnchorDebug,
}) {
  if (!isOpen) {
    return null;
  }
  return (
    <div className="pause-overlay" role="dialog" aria-label="Pause menu">
      <div className="pause-card">
        <h2>Paused</h2>
        <div className="pause-actions">
          <button type="button" onClick={onClosePauseMenu}>Resume</button>
          <button type="button" onClick={onSwitchToDebug}>Debug View</button>
          <button type="button" onClick={onNewGameFromSettings}>New Game</button>
          <button type="button" onClick={onToggleAnchorDebug}>
            Anchor Debug: {showAnchorDebug ? 'on' : 'off'}
          </button>
        </div>
      </div>
    </div>
  );
}

