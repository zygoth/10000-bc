import { getWorstSeverity } from '../GameModeChromeDisplayLogic.js';

export default function VitalsStrip({ isDebriefActive, familyVitalGroups }) {
  if (isDebriefActive) {
    return null;
  }
  return (
    <div className="hud-vitals-strip" aria-label="Family status">
      {(familyVitalGroups || []).map((group) => {
        if (group.actorId === 'player') {
          return (
            <div key={`vitals-${group.actorId}`} className="hud-vitals-player">
              <span className="hud-vitals-label">You</span>
              {(group.rows || []).map((row) => (
                <div key={`vr-${row.key}`} className="hud-vital-row">
                  <span className="hud-vital-key">{row.label[0]}</span>
                  <div className="hud-vital-track" role="meter" aria-label={row.label} aria-valuenow={row.percent}>
                    <span className={`hud-vital-fill hud-vital-fill-${row.severity}`} style={{ width: `${row.percent}%` }} />
                  </div>
                  {row.key === 'hunger' ? (
                    <span className={`hud-vital-pct hud-vital-pct-${row.severity}`} title={`${row.label}: ${row.percent}%`}>
                      {row.percent}%
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          );
        }
        const dotSeverity = getWorstSeverity(group?.rows);
        return (
          <div key={`vitals-${group.actorId}`} className="hud-vitals-companion">
            <span className={`hud-companion-dot hud-companion-dot-${dotSeverity}`} title={`${group.label}: worst bar ${dotSeverity}`} />
            <span className="hud-vitals-label">{group.label}</span>
          </div>
        );
      })}
    </div>
  );
}

