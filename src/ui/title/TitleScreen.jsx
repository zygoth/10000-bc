export default function TitleScreen({
  onStartNewGame,
  onLoadGame,
  onOpenDebug,
  generationStatus,
  generationProgress,
  generationDetail,
  titleStatus,
  loadInputRef,
  onLoadFileChange,
}) {
  const loading = generationStatus === 'generating';
  const progressPct = Math.max(0, Math.min(100, Math.round((Number(generationProgress) || 0) * 100)));

  return (
    <main className="title-screen" role="main">
      <section className="title-card">
        <h1>10,000 BC</h1>
        <p className="title-tagline">Build a family camp and survive the long seasons.</p>

        {loading ? (
          <div className="worldgen-progress-wrap" aria-live="polite">
            <p className="worldgen-stage">{generationStatus === 'generating' ? 'Generating world...' : 'Preparing...'}</p>
            <div className="worldgen-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
              <span className="worldgen-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="worldgen-detail">{generationDetail || `${progressPct}%`}</p>
          </div>
        ) : (
          <div className="title-actions">
            <button type="button" onClick={onStartNewGame}>Start New Game</button>
            <button type="button" onClick={onLoadGame}>Load Game From File</button>
            <button type="button" className="title-debug-btn" onClick={onOpenDebug}>Debug (Observer)</button>
            <input
              ref={loadInputRef}
              type="file"
              accept="application/json"
              onChange={onLoadFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {titleStatus ? <p className="title-status">{titleStatus}</p> : null}
      </section>
    </main>
  );
}
