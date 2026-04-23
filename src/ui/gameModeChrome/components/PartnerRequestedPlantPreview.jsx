import { useMemo } from 'react';
import { getPlantSpriteFrame } from '../../../game/plantSpriteCatalog.mjs';
import { representativeFieldPlantLifeStageId } from '../../../game/plantFieldVisualReference.mjs';
import { resolvePlantPartSpriteFrame } from '../../../game/plantPartSpriteResolve.mjs';
import InventorySlotSpriteStack from '../../inventorySlotSpriteFill/InventorySlotSpriteStack.jsx';

const SLOT_PX = 56;

/**
 * Whole-plant (field) + harvested-part reference for partner medicine/vision requests.
 */
export default function PartnerRequestedPlantPreview({ itemId, speciesId }) {
  const { plantSprite, partSprite } = useMemo(() => {
    const part = typeof itemId === 'string' && itemId ? resolvePlantPartSpriteFrame(itemId) : null;
    const stage = typeof speciesId === 'string' && speciesId
      ? representativeFieldPlantLifeStageId(speciesId)
      : null;
    const whole = stage ? getPlantSpriteFrame(speciesId, stage) : null;
    return { plantSprite: whole, partSprite: part };
  }, [itemId, speciesId]);

  if (!plantSprite && !partSprite) {
    return null;
  }

  return (
    <div className="debrief-partner-plant-preview" aria-label="Reference: plant in the world and part to gather">
      {plantSprite ? (
        <div className="debrief-partner-plant-preview-cell">
          <span className="debrief-partner-plant-preview-caption">Plant in the world</span>
          <InventorySlotSpriteStack sprite={plantSprite} fixedSlotWidthPx={SLOT_PX} fallbackLabel="" />
        </div>
      ) : null}
      {partSprite ? (
        <div className="debrief-partner-plant-preview-cell">
          <span className="debrief-partner-plant-preview-caption">Part to gather</span>
          <InventorySlotSpriteStack sprite={partSprite} fixedSlotWidthPx={SLOT_PX} fallbackLabel="" />
        </div>
      ) : null}
    </div>
  );
}
