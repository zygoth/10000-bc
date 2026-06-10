import TOOL_SPRITE_CATALOG_SOURCE from './toolSpriteCatalog.source.mjs';

export const TOOL_SPRITE_CATALOG = TOOL_SPRITE_CATALOG_SOURCE;

/** Atlas uses `tool:waterskin_empty` / `tool:waterskin_full`; sim item ids are `tool:waterskin` and `tool:waterskin_*_*` drink states. */
function toolSpriteCatalogKeyForItemId(itemId) {
  if (itemId === 'tool:waterskin') {
    return 'tool:waterskin_empty';
  }
  if (/^tool:waterskin_(?:safe|river|pond)_[1-3]$/.test(itemId)) {
    return 'tool:waterskin_full';
  }
  return itemId;
}

/**
 * @param {string} itemId e.g. tool:axe
 * @returns {null | { imagePath: string, atlasWidth: number, atlasHeight: number, frame: object, textureFilter: string }}
 */
export function getToolSpriteFrame(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }
  const key = toolSpriteCatalogKeyForItemId(itemId);
  const entry = TOOL_SPRITE_CATALOG[key];
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
