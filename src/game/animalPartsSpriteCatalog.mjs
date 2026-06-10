import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import ANIMAL_PARTS_SPRITE_CATALOG_SOURCE from './animalPartsSpriteCatalog.source.mjs';

export const ANIMAL_PARTS_SPRITE_CATALOG = ANIMAL_PARTS_SPRITE_CATALOG_SOURCE;

/**
 * @param {string} itemId e.g. `catostomus_commersonii:meat` (from animal sheet `spriteId` `catostomus_commersonii_meat`)
 * @returns {null | { imagePath: string, atlasWidth: number, atlasHeight: number, frame: object, textureFilter: string }}
 */
export function getAnimalPartSpriteFrame(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }
  const entry = ANIMAL_PARTS_SPRITE_CATALOG[itemId];
  if (entry?.frame) {
    return {
      imagePath: entry.imagePath,
      atlasWidth: entry.atlasWidth,
      atlasHeight: entry.atlasHeight,
      frame: entry.frame,
      textureFilter: entry.textureFilter || 'linear',
    };
  }
  // Gameplay uses `species:fish_carcass` for whole fish; land animals use `species:carcass`.
  // Some call sites (e.g. older debug seeding) use `fishSpecies:carcass` — map to the same frame.
  const colon = itemId.indexOf(':');
  if (colon > 0 && itemId.slice(colon + 1) === 'carcass') {
    const speciesId = itemId.slice(0, colon);
    if (ANIMAL_BY_ID[speciesId]?.animalClass === 'fish') {
      return getAnimalPartSpriteFrame(`${speciesId}:fish_carcass`);
    }
  }
  return null;
}
