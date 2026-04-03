export default function InspectPanel({
  isDebriefActive,
  tilePanelMode,
  selectedInspectData,
  isInventoryPanelOpen,
}) {
  if (isDebriefActive) {
    return null;
  }
  if (tilePanelMode !== 'inspect' || !selectedInspectData?.canInspect) {
    return null;
  }
  const trapSummary = selectedInspectData.trapSummary;
  const hasPlant = Boolean(selectedInspectData.plantName);
  return (
    <aside className={`hud-inspect-panel ${isInventoryPanelOpen ? 'hud-inspect-panel-shift' : ''}`} aria-label="Tile inspection">
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
      {hasPlant ? (
        <>
          <h3>{selectedInspectData.identified ? `${selectedInspectData.plantName} (${selectedInspectData.speciesId})` : 'Unknown Plant'}</h3>
          {selectedInspectData.inspectPlantSpriteStyle ? (
            <div className="hud-inspect-sprite-wrap">
              <span
                className="hud-inspect-sprite"
                style={selectedInspectData.inspectPlantSpriteStyle}
                aria-hidden="true"
              />
            </div>
          ) : null}
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
    </aside>
  );
}

