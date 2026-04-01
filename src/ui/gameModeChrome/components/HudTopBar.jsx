import { getTechForestEntrySurface } from '../TechForestDisplayLogic.js';

export default function HudTopBar({
  isDebriefActive,
  calendarLabel,
  dayProgressPercent,
  nightThresholdPercent,
  dayTick,
  ticksPerDay,
  hasTickOverdraft,
  playerTickBudgetBase,
  playerTickBudgetCurrent,
  playerOverdraftTicks,
  playerNatureSightDays,
  onOpenTechForest,
}) {
  if (isDebriefActive) {
    return null;
  }
  const techForest = getTechForestEntrySurface({ isDebriefActive });
  return (
    <div className="hud-top-bar" aria-label="Day status">
      <span className="hud-calendar">{calendarLabel}</span>
      <div className="hud-bars-row">
        <div className="hud-bar-group">
          <span className="hud-bar-label">Day</span>
          <div
            className="hud-progress-bar"
            role="meter"
            aria-label="Day progress"
            aria-valuemin={0}
            aria-valuemax={ticksPerDay}
            aria-valuenow={dayTick}
          >
            <span className="hud-progress-fill" style={{ width: `${dayProgressPercent}%` }} />
            <span className="hud-progress-threshold" style={{ left: `${nightThresholdPercent}%` }} />
          </div>
          <span className="hud-bar-value">{dayTick}/{ticksPerDay}</span>
        </div>
        <div className="hud-bar-group">
          <span className="hud-bar-label">Budget</span>
          <div
            className={`hud-progress-bar ${hasTickOverdraft ? 'hud-progress-bar-overdraft' : ''}`}
            role="meter"
            aria-label="Tick budget"
            aria-valuemin={0}
            aria-valuemax={playerTickBudgetBase}
            aria-valuenow={playerTickBudgetCurrent}
          >
            <span
              className="hud-progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, (playerTickBudgetCurrent / Math.max(1, playerTickBudgetBase)) * 100))}%` }}
            />
          </div>
          <span className={`hud-bar-value ${hasTickOverdraft ? 'hud-overdraft-text' : ''}`}>
            {hasTickOverdraft
              ? `-${playerOverdraftTicks} overdraft`
              : `${playerTickBudgetCurrent}/${playerTickBudgetBase}`}
          </span>
        </div>
      </div>
      {playerNatureSightDays > 0 ? (
        <span className="hud-nature-sight">
          Nature Sight: {playerNatureSightDays} day{playerNatureSightDays !== 1 ? 's' : ''} remaining
        </span>
      ) : null}
      {techForest.showInPlayHud && typeof onOpenTechForest === 'function' ? (
        <button type="button" className="hud-tech-forest-btn" onClick={onOpenTechForest}>
          Tech Forest
        </button>
      ) : null}
    </div>
  );
}

