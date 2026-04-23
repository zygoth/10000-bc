import { MAX_DAILY_TICK_OVERDRAFT } from '../../../game/simActions.mjs';

export default function EndDayButton({
  isDebriefActive,
  playerAtCamp,
  playerOverdraftTicks = 0,
  onEndDayEnterDebrief,
}) {
  if (isDebriefActive) {
    return null;
  }
  const passOutMax = playerOverdraftTicks >= MAX_DAILY_TICK_OVERDRAFT;
  if (!playerAtCamp && !passOutMax) {
    return null;
  }
  return (
    <button type="button" className="hud-end-day-btn" onClick={onEndDayEnterDebrief}>
      {passOutMax && !playerAtCamp ? 'End day (exhausted)' : 'End Day'}
    </button>
  );
}

