export default function WarningsStrip({
  isDebriefActive,
  warningEntries,
  onAcknowledgeWarning,
  actionComposerStatus,
}) {
  if (isDebriefActive) {
    return null;
  }
  return (
    <>
      {Array.isArray(warningEntries) && warningEntries.length > 0 ? (
        <div className="hud-warnings" aria-label="Warnings">
          {warningEntries.map((entry) => (
            <div key={entry.id} className={`hud-warning hud-warning-${entry.severity}`}>
              <span>{entry.title}: {entry.message}</span>
              <button type="button" onClick={() => onAcknowledgeWarning(entry.id)}>✕</button>
            </div>
          ))}
        </div>
      ) : null}
      {typeof actionComposerStatus === 'string' && actionComposerStatus.startsWith('dig discovery after ') ? (
        <div className="hud-warnings" aria-label="Action updates">
          <div className="hud-warning hud-warning-good">
            <span>{actionComposerStatus}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

