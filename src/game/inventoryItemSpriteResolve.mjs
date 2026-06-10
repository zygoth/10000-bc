import { getAnimalPartSpriteFrame } from './animalPartsSpriteCatalog.mjs';
import { getCraftingIntermediateSpriteFrame } from './craftingIntermediateSpriteCatalog.mjs';
import { getGroundFungusInventorySpriteFrame } from './groundFungusSpriteCatalog.mjs';
import { resolvePlantPartSpriteFrame } from './plantPartSpriteResolve.mjs';
import { getToolSpriteFrame } from './toolSpriteCatalog.mjs';

/**
 * Inventory / HUD: plant parts, ground fungus, tools, `species:part` animal items (raster sheet),
 * then crafting intermediate / food sheet (`data/sprite_sheets/crafting_intermediates` build).
 */
export function resolveInventoryItemSpriteFrame(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }
  const plant = resolvePlantPartSpriteFrame(itemId);
  if (plant) {
    return plant;
  }
  if (itemId.startsWith('ground_fungus:')) {
    return getGroundFungusInventorySpriteFrame(itemId);
  }
  if (itemId.startsWith('tool:')) {
    return getToolSpriteFrame(itemId);
  }
  const animalPart = getAnimalPartSpriteFrame(itemId);
  if (animalPart) {
    return animalPart;
  }
  return getCraftingIntermediateSpriteFrame(itemId);
}
