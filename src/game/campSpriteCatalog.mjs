import CAMP_SPRITE_CATALOG_SOURCE from './campSpriteCatalog.source.mjs';

export const CAMP_SPRITE_CATALOG = CAMP_SPRITE_CATALOG_SOURCE;

/**
 * @param {string} spriteId — atlas `spriteId` e.g. `camp_wigwam`, `station_drying_rack`
 * @returns {null | { imagePath: string, atlasWidth: number, atlasHeight: number, frame: object, textureFilter: string }}
 */
export function getCampSpriteFrameBySpriteId(spriteId) {
  if (typeof spriteId !== 'string' || !spriteId) {
    return null;
  }
  const entry = CAMP_SPRITE_CATALOG[spriteId];
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
 * @param {string} stationId — e.g. `drying_rack` (from `stationPlacements` / sim)
 * @returns {null | { imagePath: string, atlasWidth: number, atlasHeight: number, frame: object, textureFilter: string }}
 */
export function getCampStationWorldSpriteFrame(stationId) {
  if (typeof stationId !== 'string' || !stationId) {
    return null;
  }
  return getCampSpriteFrameBySpriteId(`station_${stationId}`);
}

/** Wigwam / camp anchor tile art (`camp_wigwam` in atlas). */
export function getCampWigwamSpriteFrame() {
  return getCampSpriteFrameBySpriteId('camp_wigwam');
}
