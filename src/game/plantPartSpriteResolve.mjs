import { getPlantPartSpriteFrame, getPlantSpriteFrame } from './plantSpriteCatalog.mjs';
import { parsePlantPartItemId } from './plantPartDescriptors.mjs';

function logPlantPartSprite(payload) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[plantPartSprite]', payload);
}

/**
 * Resolves inventory / UI sprite ref for `species:part:substage` plant-part item IDs.
 * Prefers dedicated part frames in the species atlas; falls back to a whole-plant life stage.
 */
export function resolvePlantPartSpriteFrame(itemId) {
  const descriptor = parsePlantPartItemId(itemId);
  if (!descriptor) {
    const segments = typeof itemId === 'string' ? itemId.split(':') : [];
    if (segments.length === 3) {
      logPlantPartSprite({ event: 'parseFailed', itemId, segments });
    }
    return null;
  }
  const direct = getPlantPartSpriteFrame(descriptor.speciesId, descriptor.partName, descriptor.subStageId);
  if (direct) {
    logPlantPartSprite({
      event: 'directHit',
      itemId,
      speciesId: descriptor.speciesId,
      partName: descriptor.partName,
      subStageId: descriptor.subStageId,
      frame: { x: direct.frame?.x, y: direct.frame?.y, w: direct.frame?.w, h: direct.frame?.h },
      imagePath: direct.imagePath,
    });
    return direct;
  }
  logPlantPartSprite({
    event: 'noDirectFrame',
    itemId,
    speciesId: descriptor.speciesId,
    partName: descriptor.partName,
    subStageId: descriptor.subStageId,
  });
  const species = descriptor.species;
  const lifeStageKeys = Object.keys(
    species?.lifeStages?.reduce((acc, entry) => ({ ...acc, [entry.stage]: true }), {}) || {},
  );
  const subStageId = descriptor.subStageId || '';
  let preferredStage = null;
  if (subStageId.startsWith('first_year')) {
    preferredStage = 'first_year_vegetative';
  } else if (subStageId.startsWith('second_year')) {
    preferredStage = 'second_year_vegetative';
  } else if (subStageId === 'green') {
    preferredStage = 'first_year_vegetative';
  } else if (subStageId === 'fresh') {
    preferredStage = 'second_year_flowering';
  } else if (subStageId === 'dry') {
    preferredStage = 'second_year_seed_set';
  }
  if (!preferredStage || !lifeStageKeys.includes(preferredStage)) {
    preferredStage = lifeStageKeys[0] || null;
  }
  const fallback = preferredStage ? getPlantSpriteFrame(descriptor.speciesId, preferredStage) : null;
  logPlantPartSprite({
    event: 'fallback',
    itemId,
    lifeStageKeys,
    preferredStage,
    fallbackFrame: fallback
      ? { x: fallback.frame?.x, y: fallback.frame?.y, w: fallback.frame?.w, h: fallback.frame?.h }
      : null,
    fallbackImagePath: fallback?.imagePath ?? null,
  });
  return fallback;
}
