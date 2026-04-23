function formatDeceasedList(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  const head = labels.slice(0, -1).join(', ');
  return `${head}, and ${labels[labels.length - 1]}`;
}

export default function GameOverOverlay({
  deceasedLabels,
  survivedDays,
  calendarLabel,
  onReturnToTitleScreen,
}) {
  const listText = formatDeceasedList(deceasedLabels);
  return (
    <div className="game-over-overlay" role="dialog" aria-label="Game over">
      <div className="pause-card game-over-card">
        <h2>Your tribe could not survive</h2>
        <p className="game-over-lede">
          {listText ? (
            <>
              <strong>{listText}</strong>
              {' '}
              {deceasedLabels.length === 1 ? 'has died' : 'have died'}
              .
            </>
          ) : (
            'A family member has died.'
          )}
        </p>
        <ul className="game-over-stats">
          <li>
            Survived <strong>{survivedDays}</strong>
            {' '}
            {survivedDays === 1 ? 'day' : 'days'}
          </li>
          {calendarLabel ? (
            <li>
              Last day: <strong>{calendarLabel}</strong>
            </li>
          ) : null}
        </ul>
        <div className="pause-actions">
          <button type="button" className="game-over-title-btn" onClick={onReturnToTitleScreen}>
            Return to title screen
          </button>
        </div>
      </div>
    </div>
  );
}
