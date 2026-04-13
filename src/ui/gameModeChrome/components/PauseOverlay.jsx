export default function PauseOverlay({
  isOpen,
  onClosePauseMenu,
  onSwitchToDebug,
  onReturnToTitleScreen,
  onSaveGame,
  onLoadGame,
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
          <button type="button" onClick={onSaveGame}>Save Game</button>
          <button type="button" onClick={onLoadGame}>Load Game</button>
          <button type="button" onClick={onSwitchToDebug}>Debug View</button>
          <button type="button" onClick={onReturnToTitleScreen}>Return to Title Screen</button>
          <button type="button" onClick={onToggleAnchorDebug}>
            Anchor Debug: {showAnchorDebug ? 'on' : 'off'}
          </button>
        </div>
      </div>
    </div>
  );
}

