import InspectPlantViewport from './InspectPlantViewport.jsx';

export default function InspectPanel({
  isDebriefActive,
  tilePanelMode,
  selectedInspectData,
  onRequestClose = () => {},
}) {
  if (isDebriefActive) {
    return null;
  }
  if (tilePanelMode !== 'inspect' || !selectedInspectData?.canInspect) {
    return null;
  }
  const trapSummary = selectedInspectData.trapSummary;
  const beehiveSummary = selectedInspectData.beehiveSummary;
  const hasPlant = Boolean(selectedInspectData.plantName);
  return (
    <div
      className="hud-inspect-modal-backdrop"
      onClick={() => onRequestClose()}
      role="presentation"
    >
      <div
        className="hud-inspect-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Tile inspection"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-inspect-modal-header">
          <h2 className="hud-inspect-modal-title">Inspect</h2>
          <button
            type="button"
            className="hud-inspect-modal-close"
            onClick={() => onRequestClose()}
            aria-label="Close inspection"
          >
            ✕
          </button>
        </div>
        <div className="hud-inspect-modal-body">
          {trapSummary ? (
            <div className="hud-inspect-trap-block">
              <h3>{trapSummary.heading}</h3>
              {trapSummary.rows.map((row) => (
                <p key={row.label} className="hud-inspect-row">
                  <strong>{row.label}:</strong> {row.value}
                </p>
              ))}
            </div>
          ) : null}
          {beehiveSummary ? (
            <div className="hud-inspect-trap-block">
              <h3>{beehiveSummary.heading}</h3>
              {beehiveSummary.rows.map((row) => (
                <p key={row.label} className="hud-inspect-row">
                  <strong>{row.label}:</strong> {row.value}
                </p>
              ))}
            </div>
          ) : null}
          {hasPlant ? (
            <>
              <h3>{selectedInspectData.identified ? `${selectedInspectData.plantName} (${selectedInspectData.speciesId})` : 'Unknown Plant'}</h3>
              <InspectPlantViewport
                svg={selectedInspectData.inspectPlantSvg}
                spriteStyle={selectedInspectData.inspectPlantSpriteStyle}
                resetKey={`${selectedInspectData.speciesId}-${selectedInspectData.lifeStageLabel}`}
              />
              <p className="hud-inspect-row">{selectedInspectData.fieldDescription}</p>
              {selectedInspectData.identified && selectedInspectData.gameDescription ? (
                <p className="hud-inspect-row">{selectedInspectData.gameDescription}</p>
              ) : null}
              {selectedInspectData.identified && selectedInspectData.physicalDescription ? (
                <p className="hud-inspect-row"><strong>Botanical:</strong> {selectedInspectData.physicalDescription}</p>
              ) : null}
              <p className="hud-inspect-row"><strong>Stage:</strong> {selectedInspectData.lifeStageLabel}</p>
              {(selectedInspectData.activeParts || []).map((part) => (
                <div key={`${part.partName}:${part.subStageId}`} className="hud-inspect-part">
                  <p className="hud-inspect-row"><strong>{part.partLabel}</strong> ({part.subStageLabel})</p>
                  {part.fieldDescription ? <p className="hud-inspect-row">{part.fieldDescription}</p> : null}
                  {selectedInspectData.identified && part.gameDescription ? (
                    <p className="hud-inspect-row">{part.gameDescription}</p>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
