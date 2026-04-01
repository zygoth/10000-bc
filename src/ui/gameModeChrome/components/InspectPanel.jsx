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
  return (
    <aside className={`hud-inspect-panel ${isInventoryPanelOpen ? 'hud-inspect-panel-shift' : ''}`} aria-label="Plant inspection">
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
      <p className="hud-inspect-row"><strong>Stage:</strong> {selectedInspectData.lifeStageLabel}</p>
      {selectedInspectData.activeParts.map((part) => (
        <div key={`${part.partName}:${part.subStageId}`} className="hud-inspect-part">
          <p className="hud-inspect-row"><strong>{part.partLabel}</strong> ({part.subStageLabel})</p>
          {part.fieldDescription ? <p className="hud-inspect-row">{part.fieldDescription}</p> : null}
          {selectedInspectData.identified && part.gameDescription ? (
            <p className="hud-inspect-row">{part.gameDescription}</p>
          ) : null}
        </div>
      ))}
    </aside>
  );
}

