import { PLANT_BY_ID } from '../../../game/plantCatalog.mjs';
import { isDayInWindow } from '../../../game/plantCatalog.mjs';
import { getPlantPartSpriteFrame, getPlantSpriteFrame } from '../../../game/plantSpriteCatalog.mjs';
import { resolvePatchLayout } from '../../../game/plantPatchLayout.mjs';
import { ISO_BASE_SCALE, ISO_TILE_HALF_WIDTH_PX } from '../isoConstants.js';
import { debrisSpawnRatePerMinute } from '../../../game/windDebrisConfig.mjs';
import { windDebrisSubStageInstanceFactor } from '../../../game/windDebrisInstanceFactor.mjs';
import { windDebrisDebugSpawnMultiplier } from './windDebrisDebug.mjs';
import { windUnitVector } from './windDustSpawn.mjs';

const DEBRIS_SPRITE_SCALE_MULT = 0.10;

/** Wind debris uses a fixed world size — not the host plant's current life-stage scale. */
export function debrisSpriteWorldScale() {
  return ISO_BASE_SCALE * DEBRIS_SPRITE_SCALE_MULT;
}
/** Screen-space drift speed (px/s) at wind strength 1 for float debris. */
const FLOAT_DRIFT_BASE_PX_PER_SEC = 52;
export const FLOAT_WOBBLE_AMP_MIN_RAD = 0.09;
export const FLOAT_WOBBLE_AMP_MAX_RAD = 0.2;
/** Screen-Y fraction up the occupant silhouette where float debris (pods, seed heads) releases. */
const FLOAT_SPAWN_CANOPY_FRAC = 0.72;

/**
 * @typedef {{
 *   plantId: string,
 *   screenX: number,
 *   occupantAnchorY: number,
 *   groundY: number,
 *   patchCapacity: number,
 *   patchScale: number,
 *   stageSize: number,
 *   plantOrLogScale: number,
 * }} TileOccupantLayout
 */

/**
 * @param {import('../../../game/simCore.mjs').GameState} gameState
 * @param {import('../../../game/plantCatalog.mjs').PlantDefinition} species
 * @param {object} plant
 * @param {number} dayOfYear
 */
export function listEligibleDebrisSourcesForPlant(gameState, species, plant, dayOfYear) {
  if (!plant?.alive || !species || !Array.isArray(plant.activeSubStages)) {
    return [];
  }
  const out = [];
  for (const active of plant.activeSubStages) {
    const part = (species.parts || []).find((p) => p?.name === active?.partName) || null;
    const subStage = (part?.subStages || []).find((s) => s?.id === active?.subStageId) || null;
    if (!part || !subStage) {
      continue;
    }
    const windDebris = subStage.windDebris;
    if (!windDebris) {
      continue;
    }
    if (!isDayInWindow(dayOfYear, subStage.seasonalWindow)) {
      continue;
    }
    const visualPart = windDebris.visualPart || part.name;
    const visualSubStageId = windDebris.visualSubStageId || subStage.id;
    const spriteRef = getPlantPartSpriteFrame(plant.speciesId, visualPart, visualSubStageId);
    if (!spriteRef?.frame) {
      continue;
    }
    const instanceFactor = windDebrisSubStageInstanceFactor(active, subStage, species, plant);
    if (instanceFactor <= 0) {
      continue;
    }
    out.push({
      partName: part.name,
      subStageId: subStage.id,
      windDebris,
      spriteRef,
      opaqueH: Number(spriteRef.frame.opaqueH) || Number(spriteRef.frame.sourceH) || 32,
      instanceFactor,
    });
  }
  return out;
}

/**
 * @param {Array<{ instanceFactor: number }>} sources
 * @param {() => number} rng
 */
export function pickWeightedDebrisSource(sources, rng) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }
  let total = 0;
  for (const source of sources) {
    total += Math.max(0, Number(source.instanceFactor) || 0);
  }
  if (total <= 0) {
    return null;
  }
  let roll = rng() * total;
  for (const source of sources) {
    roll -= Math.max(0, Number(source.instanceFactor) || 0);
    if (roll <= 0) {
      return source;
    }
  }
  return sources[sources.length - 1];
}

/**
 * @param {number} localX
 * @param {number} localY
 * @param {import('pixi.js').Container | null | undefined} tileC
 * @param {import('pixi.js').Container | null | undefined} worldPanLayer
 */
export function tileLocalToScreenPx(localX, localY, tileC, worldPanLayer) {
  const panX = Number(worldPanLayer?.position?.x) || 0;
  const panY = Number(worldPanLayer?.position?.y) || 0;
  const tcx = Number(tileC?.position?.x) || 0;
  const tcy = Number(tileC?.position?.y) || 0;
  return {
    x: panX + tcx + localX,
    y: panY + tcy + localY,
  };
}

/**
 * @param {number} screenX
 * @param {number} screenY
 * @param {import('pixi.js').Container | null | undefined} tileC
 * @param {import('pixi.js').Container | null | undefined} worldPanLayer
 */
export function screenToTileLocalPx(screenX, screenY, tileC, worldPanLayer) {
  const panX = Number(worldPanLayer?.position?.x) || 0;
  const panY = Number(worldPanLayer?.position?.y) || 0;
  const tcx = Number(tileC?.position?.x) || 0;
  const tcy = Number(tileC?.position?.y) || 0;
  return {
    x: screenX - panX - tcx,
    y: screenY - panY - tcy,
  };
}

/**
 * Float debris hovers above the tile footprint; iso tile pick must use a ground-level
 * screen point or diamond distance favors back tiles and front tiles paint on top.
 * @param {number} localX
 * @param {number} localY
 * @param {import('pixi.js').Container | null | undefined} tileC
 * @param {import('pixi.js').Container | null | undefined} worldPanLayer
 * @param {number} [pickBiasScreenPx] downward screen-Y offset for tile hit-test only
 */
export function floatDebrisTilePickScreenPx(localX, localY, tileC, worldPanLayer, pickBiasScreenPx = 0) {
  const screen = tileLocalToScreenPx(localX, localY, tileC, worldPanLayer);
  return {
    x: screen.x,
    y: screen.y + Math.max(0, Number(pickBiasScreenPx) || 0),
  };
}

/**
 * @param {number} spawnX tile-local spawn X
 * @param {number} spawnY tile-local spawn Y (canopy)
 * @param {number} groundFootY tile-local occupant foot Y
 * @param {import('pixi.js').Container | null | undefined} tileC
 * @param {import('pixi.js').Container | null | undefined} worldPanLayer
 */
export function floatDebrisPickBiasScreenPx(spawnX, spawnY, groundFootY, tileC, worldPanLayer) {
  const spawnScreen = tileLocalToScreenPx(spawnX, spawnY, tileC, worldPanLayer);
  const groundScreen = tileLocalToScreenPx(spawnX, groundFootY, tileC, worldPanLayer);
  return Math.max(8, groundScreen.y - spawnScreen.y);
}

/**
 * Foot anchors of live occupant sprites (same local coords `pushSprite` uses).
 * @param {import('pixi.js').Container | null | undefined} tileC
 * @param {string} plantId
 */
export function resolvePlantOccupantAnchors(tileC, plantId) {
  const anchors = [];
  if (!tileC?.children || !plantId) {
    return anchors;
  }
  for (const child of tileC.children) {
    const meta = child?.__windSwayMeta;
    if (!meta || meta.plantId !== plantId) {
      continue;
    }
    if (child.visible === false || !child.texture) {
      continue;
    }
    anchors.push({
      x: child.x,
      y: child.y,
      zBias: 0,
    });
  }
  return anchors;
}

/**
 * The iso renderer draws `tile.plantIds[0]`; debris must use that same plant.
 * @param {object} tile
 * @param {import('../../../game/simCore.mjs').GameState} gameState
 */
export function resolveRenderedPlantForTile(tile, gameState) {
  const plantId = tile?.plantIds?.[0];
  if (!plantId) {
    return null;
  }
  const plant = gameState.plants?.[plantId] || null;
  return plant?.alive ? plant : null;
}

/**
 * @param {object} plant
 * @param {TileOccupantLayout} layout tile-local occupant layout from the last iso sync
 * @param {number} worldX
 * @param {number} worldY
 * @param {ReturnType<typeof listEligibleDebrisSourcesForPlant>[number]} source
 * @param {() => number} rng
 * @param {{ x: number, y: number, zBias?: number } | null} [plantAnchor] live occupant sprite foot
 */
export function buildDebrisSpawnContextForPlant(plant, layout, worldX, worldY, source, rng, plantAnchor = null) {
  if (!plant || !layout || layout.plantId !== plant.id || !source) {
    return null;
  }

  const patchScale = Number(layout.patchScale) || 1;
  const plantDisplayScale = (Number(layout.plantOrLogScale) || ISO_BASE_SCALE) * patchScale;
  let footX;
  let footY;
  let zBias;
  if (plantAnchor) {
    footX = plantAnchor.x;
    footY = plantAnchor.y;
    zBias = Number(plantAnchor.zBias) || 0;
  } else {
    const patchCapacity = Math.max(1, Number(layout.patchCapacity) || 1);
    const copies = patchCapacity > 1
      ? resolvePatchLayout(patchCapacity, `iso:${worldX},${worldY}:${plant.id}`, {
        radiusPx: Math.max(12, ISO_TILE_HALF_WIDTH_PX * 0.32),
        minSpacingPx: Math.max(7, ISO_TILE_HALF_WIDTH_PX * 0.12),
      })
      : [{ x: 0, y: 0, depthY: 0 }];
    const copy = copies[Math.floor(rng() * copies.length)] || copies[0];
    footX = layout.screenX + copy.x;
    footY = layout.occupantAnchorY + copy.y;
    zBias = copy.depthY;
  }
  const isFloat = source.windDebris.behavior === 'float';
  let spawnLift;
  if (isFloat) {
    const occupantFrame = getPlantSpriteFrame(plant.speciesId, plant.stageName)?.frame;
    const occupantOpaqueH = Number(occupantFrame?.opaqueH)
      || Number(occupantFrame?.sourceH)
      || 64;
    spawnLift = -occupantOpaqueH * plantDisplayScale * FLOAT_SPAWN_CANOPY_FRAC;
  } else {
    const debrisOpaqueH = Number(source.opaqueH) || 32;
    spawnLift = -Math.max(8, debrisOpaqueH * plantDisplayScale * 0.55);
  }
  const spawnJitterX = isFloat ? 4 : 6;
  const spawnX = footX + (rng() - 0.5) * spawnJitterX;
  const spawnY = footY + spawnLift;
  const spriteScale = debrisSpriteWorldScale();

  return {
    tileKey: `${worldX},${worldY}`,
    worldX,
    worldY,
    plantId: plant.id,
    speciesId: plant.speciesId,
    partName: source.partName,
    subStageId: source.subStageId,
    windDebris: source.windDebris,
    spriteRef: source.spriteRef,
    spawnX,
    spawnY,
    zBias,
    spriteScale,
    groundY: footY,
    instanceFactor: Number(source.instanceFactor) || 1,
  };
}

/**
 * Build spawn context for the plant actually drawn on this tile.
 * @param {object} tile
 * @param {import('../../../game/simCore.mjs').GameState} gameState
 * @param {TileOccupantLayout | null | undefined} layout
 * @param {number} worldX
 * @param {number} worldY
 * @param {() => number} rng
 * @param {import('pixi.js').Container | null | undefined} [tileC]
 */
export function buildDebrisSpawnContextForTile(tile, gameState, layout, worldX, worldY, rng, tileC = null) {
  const plant = resolveRenderedPlantForTile(tile, gameState);
  if (!plant || !layout || layout.plantId !== plant.id) {
    return null;
  }
  const species = PLANT_BY_ID[plant.speciesId] || null;
  if (!species) {
    return null;
  }
  const sources = listEligibleDebrisSourcesForPlant(
    gameState,
    species,
    plant,
    Number(gameState.dayOfYear) || 1,
  );
  if (sources.length === 0) {
    return null;
  }
  const source = pickWeightedDebrisSource(sources, rng);
  if (!source) {
    return null;
  }
  const anchors = resolvePlantOccupantAnchors(tileC, plant.id);
  const plantAnchor = anchors.length > 0
    ? anchors[Math.floor(rng() * anchors.length)]
    : null;
  return buildDebrisSpawnContextForPlant(plant, layout, worldX, worldY, source, rng, plantAnchor);
}

/**
 * @param {object} slot
 * @param {() => number} rng
 */
export function initFloatDebrisWobble(slot, rng) {
  slot.wobbleAmpRad = FLOAT_WOBBLE_AMP_MIN_RAD
    + rng() * (FLOAT_WOBBLE_AMP_MAX_RAD - FLOAT_WOBBLE_AMP_MIN_RAD);
  slot.wobblePeriodMs = 1600 + rng() * 1600;
  slot.wobbleTimeMs = rng() * slot.wobblePeriodMs;
}

/**
 * @param {object} slot
 * @param {number} dtMs
 */
export function floatDebrisWobbleRotationRad(slot, dtMs) {
  slot.wobbleTimeMs = (Number(slot.wobbleTimeMs) || 0) + Math.max(0, Number(dtMs) || 0);
  const period = Math.max(500, Number(slot.wobblePeriodMs) || 2000);
  const amp = Math.max(0, Number(slot.wobbleAmpRad) || 0);
  return amp * Math.sin((slot.wobbleTimeMs / period) * Math.PI * 2);
}

/**
 * Float debris drifts in the same screen-space direction as viewport dust.
 * @param {{ x?: number, y?: number, strength?: number, angleRadians?: number } | null} windVector
 * @param {number} windDrag
 * @param {() => number} [rng]
 * @param {number} [gustMultiplier] local wind-field multiplier at spawn position
 */
export function computeFloatDriftVelocity(windVector, windDrag, rng = () => 0.5, gustMultiplier = 1) {
  const windDir = windUnitVector(windVector);
  const strength = Math.max(0, Number(windVector?.strength) || 0);
  const drag = Math.max(0, Math.min(1, Number(windDrag) || 0.5));
  const gust = Math.max(0.2, Number(gustMultiplier) || 1);
  const speed = FLOAT_DRIFT_BASE_PX_PER_SEC * strength * drag * gust;
  const jitter = 0.08 * (1 - drag);
  return {
    vx: windDir.x * speed + (rng() - 0.5) * speed * jitter,
    vy: windDir.y * speed + (rng() - 0.5) * speed * jitter,
  };
}

/**
 * @param {{ windDebris: ReturnType<typeof import('../../../game/windDebrisConfig.mjs').normalizeWindDebris> }} ctx
 * @param {number} windStrength
 * @param {number} dtMs
 * @param {number} localMultiplier
 * @param {number} [instanceFactor]
 */
export function spawnChanceThisFrame(ctx, windStrength, dtMs, localMultiplier, instanceFactor = 1) {
  const debugMult = windDebrisDebugSpawnMultiplier();
  const instanceScale = Math.max(0, Number(instanceFactor ?? ctx?.instanceFactor) || 0);
  const ratePerMin = debrisSpawnRatePerMinute(ctx.windDebris, windStrength, localMultiplier)
    * debugMult
    * instanceScale;
  if (ratePerMin <= 0) {
    return 0;
  }
  const dtMin = Math.max(0, Number(dtMs) || 0) / 60000;
  return 1 - Math.exp(-ratePerMin * dtMin);
}

export { DEBRIS_SPRITE_SCALE_MULT, FLOAT_DRIFT_BASE_PX_PER_SEC };
