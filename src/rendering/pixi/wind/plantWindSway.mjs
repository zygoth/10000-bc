import { lifeStageSizeVisualScaleMultiplier } from '../../../game/plantPatchLayout.mjs';
import { isWindCalm } from './windStrengthField.mjs';

export const SWAY_MODE = {
  PIVOT: 'pivot',
  SQUASH: 'squash',
};

export const SWAY_SILHOUETTE_PIVOT_THRESHOLD = 1.35;
export const SWAY_MAX_ANGLE_DEG = 7;
export const SWAY_SQUASH_AMP = 0.055;
export const SWAY_OMEGA_RAD_PER_SEC = 2.6;
/** Sway amplitude at life-stage size 10 vs size 1 (after inverse visual-scale term). */
export const LARGE_STAGE_SWAY_FRACTION = 0.22;

const SWAY_MAX_ANGLE_RAD = (SWAY_MAX_ANGLE_DEG * Math.PI) / 180;

/** Pixi v8 nulls `scale`/`anchor` when a display object is destroyed. */
function isLiveWindSwaySprite(sprite) {
  return Boolean(sprite?.parent && sprite.scale && sprite.anchor);
}

/**
 * @param {{ centerAnchored?: boolean, silhouetteAspect?: number, opaqueW?: number, opaqueH?: number, sourceW?: number, sourceH?: number, w?: number, h?: number } | null | undefined} frame
 */
export function resolveSilhouetteAspect(frame) {
  if (Number.isFinite(Number(frame?.silhouetteAspect))) {
    return Number(frame.silhouetteAspect);
  }
  const opaqueW = Number(frame?.opaqueW);
  const opaqueH = Number(frame?.opaqueH);
  if (Number.isFinite(opaqueW) && opaqueW > 0 && Number.isFinite(opaqueH) && opaqueH > 0) {
    return opaqueH / opaqueW;
  }
  const w = Number(frame?.sourceW) || Number(frame?.w) || 1;
  const h = Number(frame?.sourceH) || Number(frame?.h) || 1;
  return h / Math.max(1, w);
}

/**
 * @param {{ centerAnchored?: boolean, silhouetteAspect?: number, opaqueW?: number, opaqueH?: number, sourceW?: number, sourceH?: number, w?: number, h?: number } | null | undefined} frame
 */
export function resolveSwayMode(frame) {
  if (frame?.centerAnchored === true) {
    return SWAY_MODE.SQUASH;
  }
  return resolveSilhouetteAspect(frame) >= SWAY_SILHOUETTE_PIVOT_THRESHOLD
    ? SWAY_MODE.PIVOT
    : SWAY_MODE.SQUASH;
}

/**
 * Larger life-stage sizes sway less: inverse visual scale plus extra damping for mature stages.
 * @param {number} stageSize
 */
export function sizeSwayFactor(stageSize) {
  const sizeNorm = Math.max(1, Math.min(10, Math.round(Number(stageSize) || 1)));
  const mult = lifeStageSizeVisualScaleMultiplier(sizeNorm);
  const inverseScale = 1 / Math.max(0.01, mult);
  const t = (sizeNorm - 1) / 9;
  const matureDamping = 1 - (t * (1 - LARGE_STAGE_SWAY_FRACTION));
  return inverseScale * matureDamping;
}

/**
 * Stable per-plant phase offset so neighbors desync slightly.
 * @param {string | number | null | undefined} key
 */
export function swayPhaseOffset(key) {
  const s = String(key ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 6283) / 1000 * Math.PI;
}

/**
 * @param {import('pixi.js').Sprite} sprite
 * @param {import('pixi.js').Container | null | undefined} tileC
 * @param {import('pixi.js').Container | null | undefined} worldPanLayer
 */
export function footScreenPositionForSprite(sprite, tileC, worldPanLayer) {
  const panX = Number(worldPanLayer?.position?.x) || 0;
  const panY = Number(worldPanLayer?.position?.y) || 0;
  const tcx = Number(tileC?.position?.x) || 0;
  const tcy = Number(tileC?.position?.y) || 0;
  return {
    x: panX + tcx + sprite.x,
    y: panY + tcy + sprite.y,
  };
}

/**
 * Capture display scale after `applyAnchoredSprite` sets width/height from logical source size.
 * @param {import('pixi.js').Sprite} sprite
 */
export function capturePlantWindSwayBaseScale(sprite) {
  const meta = sprite?.__windSwayMeta;
  if (!meta || !isLiveWindSwaySprite(sprite)) {
    return;
  }
  meta.baseScaleX = sprite.scale.x;
  meta.baseScaleY = sprite.scale.y;
}

/**
 * @param {import('pixi.js').Sprite} sprite
 * @param {{ mode: string, phase: number, stageSize: number, baseScaleX?: number, baseScaleY?: number }} meta
 * @param {number} nowMs
 * @param {number} windStrength daily wind strength 0..1
 */
export function applyPlantWindSwayToSprite(sprite, meta, nowMs, windStrength) {
  if (!isLiveWindSwaySprite(sprite)) {
    return;
  }
  const baseScaleX = Number(meta.baseScaleX);
  const baseScaleY = Number(meta.baseScaleY);
  if (!Number.isFinite(baseScaleX) || !Number.isFinite(baseScaleY)) {
    return;
  }

  const amp = Math.max(0, Math.min(1, Number(windStrength) || 0)) * sizeSwayFactor(meta.stageSize);
  const wave = Math.sin(SWAY_OMEGA_RAD_PER_SEC * (nowMs / 1000) + meta.phase);

  sprite.rotation = 0;
  sprite.scale.set(baseScaleX, baseScaleY);

  if (amp <= 0) {
    return;
  }

  if (meta.mode === SWAY_MODE.PIVOT) {
    sprite.rotation = wave * SWAY_MAX_ANGLE_RAD * amp;
    return;
  }

  const squash = SWAY_SQUASH_AMP * wave * amp;
  sprite.scale.set(baseScaleX * (1 + squash), baseScaleY * (1 - squash * 0.4));
}

/**
 * @param {Map<string, import('pixi.js').Container>} tileContainers
 */
export function resetPlantWindSwayTransforms(tileContainers) {
  for (const tileC of tileContainers.values()) {
    for (const child of tileC.children) {
      const meta = child?.__windSwayMeta;
      if (!meta || !isLiveWindSwaySprite(child)) {
        continue;
      }
      child.rotation = 0;
      const baseScaleX = Number(meta.baseScaleX);
      const baseScaleY = Number(meta.baseScaleY);
      if (Number.isFinite(baseScaleX) && Number.isFinite(baseScaleY)) {
        child.scale.set(baseScaleX, baseScaleY);
      }
    }
  }
}

/**
 * @param {number} nowMs
 * @param {{ strength?: number } | null} windVector
 * @param {Map<string, import('pixi.js').Container>} tileContainers
 */
export function stepPlantWindSway(nowMs, windVector, tileContainers) {
  const windStrength = Number(windVector?.strength) || 0;
  if (isWindCalm(windStrength)) {
    resetPlantWindSwayTransforms(tileContainers);
    return;
  }

  for (const tileC of tileContainers.values()) {
    for (const child of tileC.children) {
      const meta = child?.__windSwayMeta;
      if (!meta || child.visible === false || !isLiveWindSwaySprite(child)) {
        continue;
      }
      applyPlantWindSwayToSprite(child, meta, nowMs, windStrength);
    }
  }
}
