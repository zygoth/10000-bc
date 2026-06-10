import {
  GROUND_FUNGUS_INVENTORY_SPRITE_CATALOG_SOURCE,
  GROUND_FUNGUS_ZONE_TILE_SPRITE_CATALOG_SOURCE,
} from './groundFungusSpriteCatalog.source.mjs';

/**
 * @param {string} itemId — e.g. `ground_fungus:agaricus_campestris:fruiting_body`
 * @returns {null | { imagePath: string, atlasWidth: number, atlasHeight: number, frame: object, textureFilter: string }}
 */
export function getGroundFungusInventorySpriteFrame(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }
  const entry = GROUND_FUNGUS_INVENTORY_SPRITE_CATALOG_SOURCE[itemId];
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

/**
 * Zone / iso overlay: `<speciesId>_zone_tile` in the merged atlas.
 * @param {string} speciesId
 * @returns {null | { imagePath: string, atlasWidth: number, atlasHeight: number, frame: object, textureFilter: string }}
 */
export function getGroundFungusZoneTileSpriteFrame(speciesId) {
  if (typeof speciesId !== 'string' || !speciesId) {
    return null;
  }
  const entry = GROUND_FUNGUS_ZONE_TILE_SPRITE_CATALOG_SOURCE[speciesId];
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
