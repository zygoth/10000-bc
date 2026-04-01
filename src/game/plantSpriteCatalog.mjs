import PLANT_SPRITE_CATALOG_SOURCE from './plantSpriteCatalog.source.mjs';

export const PLANT_SPRITE_CATALOG = PLANT_SPRITE_CATALOG_SOURCE;

function logPlantPartSpriteCatalogMiss(payload) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[plantPartSprite]', payload);
}

const DEAD_LOG_SPRITE = {
  imagePath: '/plant_sprites/dead_tree.png',
  atlasWidth: 64,
  atlasHeight: 64,
  frame: {
    x: 0,
    y: 0,
    w: 64,
    h: 64,
  },
};

const TERRAIN_SPRITES = {
  grass: {
    imagePath: '/isometric_sprites/grass_half_cube.png',
    atlasWidth: 64,
    atlasHeight: 64,
    frame: {
      x: 0,
      y: 12,
      w: 64,
      h: 52,
    },
  },
  dirt: {
    imagePath: '/isometric_sprites/dirt_half_cube.png',
    atlasWidth: 64,
    atlasHeight: 64,
    frame: {
      x: 0,
      y: 12,
      w: 64,
      h: 52,
    },
  },
  water: {
    imagePath: '/isometric_sprites/water_cube.png',
    atlasWidth: 64,
    atlasHeight: 64,
    frame: {
      x: 0,
      y: 0,
      w: 64,
      h: 64,
    },
  },
  ice: {
    imagePath: '/isometric_sprites/ice_cube.png',
    atlasWidth: 64,
    atlasHeight: 64,
    frame: {
      x: 0,
      y: 0,
      w: 64,
      h: 64,
    },
  },
};

const ROCK_SPRITES = {
  glacial_erratic: {
    imagePath: '/isometric_sprites/stone_half_cube_light.png',
    atlasWidth: 64,
    atlasHeight: 64,
    frame: {
      x: 0,
      y: 12,
      w: 64,
      h: 52,
    },
  },
  flint_cobble_scatter: {
    imagePath: '/isometric_sprites/stone_half_cube.png',
    atlasWidth: 64,
    atlasHeight: 64,
    frame: {
      x: 0,
      y: 12,
      w: 64,
      h: 52,
    },
  },
};

export function getPlantSpriteFrame(speciesId, stageName) {
  const species = PLANT_SPRITE_CATALOG[speciesId];
  if (!species) {
    return null;
  }

  const frame = species.lifeStageFrames?.[stageName];
  if (!frame) {
    return null;
  }

  return {
    imagePath: species.imagePath,
    atlasWidth: species.atlasWidth,
    atlasHeight: species.atlasHeight,
    frame,
  };
}

export function getPlantPartSpriteFrame(speciesId, partName, subStageId) {
  const species = PLANT_SPRITE_CATALOG[speciesId];
  if (!species || typeof partName !== 'string' || typeof subStageId !== 'string') {
    return null;
  }

  const partMap = species.partSubStageFrames?.[partName];
  const frame = partMap?.[subStageId];
  if (!frame) {
    const partNames = species.partSubStageFrames
      ? Object.keys(species.partSubStageFrames)
      : [];
    const subIdsForPart = partMap && typeof partMap === 'object' ? Object.keys(partMap) : [];
    logPlantPartSpriteCatalogMiss({
      event: 'catalogPartLookupMiss',
      speciesId,
      partName,
      subStageId,
      catalogPartNames: partNames,
      subStageIdsForThisPart: subIdsForPart,
    });
    return null;
  }

  return {
    imagePath: species.imagePath,
    atlasWidth: species.atlasWidth,
    atlasHeight: species.atlasHeight,
    frame,
  };
}

export function getDeadLogSpriteFrame() {
  return DEAD_LOG_SPRITE;
}

export function getRockSpriteFrame(rockType) {
  return ROCK_SPRITES[rockType] || null;
}

export function getTerrainSpriteFrame(kind) {
  return TERRAIN_SPRITES[kind] || null;
}
