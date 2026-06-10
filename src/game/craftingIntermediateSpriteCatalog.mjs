import CRAFTING_INTERMEDIATE_SPRITE_CATALOG_SOURCE from './craftingIntermediateSpriteCatalog.source.mjs';

export const CRAFTING_INTERMEDIATE_SPRITE_CATALOG = CRAFTING_INTERMEDIATE_SPRITE_CATALOG_SOURCE;

/**
 * @param {string} itemId — e.g. `cordage`, `dried_hide`, `tree_sugar` (plain ids; same as atlas `spriteId`)
 * @returns {null | { imagePath: string, atlasWidth: number, atlasHeight: number, frame: object, textureFilter: string }}
 */
export function getCraftingIntermediateSpriteFrame(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }
  let entry = CRAFTING_INTERMEDIATE_SPRITE_CATALOG[itemId];
  if (!entry?.frame && itemId.startsWith('forage:')) {
    const alt = itemId.replace(/:/g, '_');
    entry = CRAFTING_INTERMEDIATE_SPRITE_CATALOG[alt];
  }
  if (!entry?.frame) {
    return null;
  }
  return {
    imagePath: entry.imagePath,
    atlasWidth: entry.atlasWidth,
    atlasHeight: entry.atlasHeight,
    frame: entry.frame,
    textureFilter: entry.textureFilter || 'linear',
  };
}
