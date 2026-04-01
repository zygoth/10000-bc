export default function EndDayButton({ isDebriefActive, playerAtCamp, onEndDayEnterDebrief }) {
  if (isDebriefActive) {
    return null;
  }
  // Keep the existing behavior: the button exists only at camp.
  if (!playerAtCamp) {
    return null;
  }
  return (
    <button type="button" className="hud-end-day-btn" onClick={onEndDayEnterDebrief}>
      End Day
    </button>
  );
}

