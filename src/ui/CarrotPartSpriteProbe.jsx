import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPlantPartSpriteFrame, PLANT_SPRITE_CATALOG } from '../game/plantSpriteCatalog.mjs';
import InventorySlotSpriteFill from './inventorySlotSpriteFill/InventorySlotSpriteFill.jsx';

const SPECIES_ID = 'daucus_carota';
const POLL_MS = 400;

/**
 * Dev: every `part · substage` frame for wild carrot from `plantSpriteCatalog`, same CSS path as inventory.
 * Console: `window.__SHOW_CARROT_PART_SPRITE_PROBE__ = true` (false to hide).
 */
function readProbeFlag() {
  return Boolean(typeof window !== 'undefined' && window.__SHOW_CARROT_PART_SPRITE_PROBE__);
}

export default function CarrotPartSpriteProbe() {
  const [visible, setVisible] = useState(() => (
    process.env.NODE_ENV !== 'production' && readProbeFlag()
  ));

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return undefined;
    }
    const id = setInterval(() => setVisible(readProbeFlag()), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const cells = useMemo(() => {
    const species = PLANT_SPRITE_CATALOG[SPECIES_ID];
    const parts = species?.partSubStageFrames;
    if (!parts) {
      return [];
    }
    const out = [];
    for (const partName of Object.keys(parts).sort()) {
      const subMap = parts[partName];
      for (const subStageId of Object.keys(subMap).sort()) {
        const sprite = getPlantPartSpriteFrame(SPECIES_ID, partName, subStageId);
        out.push({
          key: `${partName}:${subStageId}`,
          partName,
          subStageId,
          sprite,
        });
      }
    }
    return out;
  }, []);

  if (process.env.NODE_ENV === 'production' || !visible) {
    return null;
  }

  return createPortal(
    <div className="carrot-part-sprite-probe" aria-hidden="true">
      <div className="carrot-part-sprite-probe-panel">
        <div className="carrot-part-sprite-probe-title">
          Carrot part atlas ({SPECIES_ID}) — <code>__SHOW_CARROT_PART_SPRITE_PROBE__</code>
        </div>
        <div className="carrot-part-sprite-probe-grid">
          {cells.map(({ key, partName, subStageId, sprite }) => (
            <div key={key} className="carrot-part-sprite-probe-cell">
              <div className="carrot-part-sprite-probe-slot">
                <InventorySlotSpriteFill sprite={sprite} fixedSlotWidthPx={56} />
              </div>
              <div className="carrot-part-sprite-probe-label">
                <strong>{partName}</strong>
                <span className="carrot-part-sprite-probe-sub">{subStageId}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
