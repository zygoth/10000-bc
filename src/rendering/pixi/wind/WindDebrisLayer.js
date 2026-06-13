import { Sprite } from 'pixi.js';
import { getSubTextureForSprite } from '../textureCache.js';
import { isWindCalm } from './windStrengthField.mjs';
import { isOnScreen } from './windDustViewport.mjs';
import { isoOccupantDepthZ } from './windDebrisDepth.mjs';
import {
  buildDebrisSpawnContextForTile,
  computeFloatDriftVelocity,
  floatDebrisPickBiasScreenPx,
  floatDebrisTilePickScreenPx,
  floatDebrisWobbleRotationRad,
  initFloatDebrisWobble,
  resolvePlantOccupantAnchors,
  screenToTileLocalPx,
  spawnChanceThisFrame,
  tileLocalToScreenPx,
} from './windDebrisSpawn.mjs';

const POOL_SIZE = 48;
const FADE_IN_MS = 150;
const REST_MS = 1500;
const FADE_OUT_MS = 1000;
const FLOAT_LIFETIME_MS = 5000;
const FLOAT_FADE_OUT_MS = 1500;
const FLOAT_OFFSCREEN_MARGIN_PX = 48;
const GRAVITY_PX_PER_SEC2 = 220;

function debrisScreenPx(sprite, tileC, worldPanLayer) {
  const panX = Number(worldPanLayer?.position?.x) || 0;
  const panY = Number(worldPanLayer?.position?.y) || 0;
  const tcx = Number(tileC?.position?.x) || 0;
  const tcy = Number(tileC?.position?.y) || 0;
  return {
    x: panX + tcx + sprite.x,
    y: panY + tcy + sprite.y,
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutCubic(t) {
  const u = Math.max(0, Math.min(1, t));
  return 1 - (1 - u) ** 3;
}

/** Pixi v8 nulls `scale`/`anchor` when a display object is destroyed. */
function isLiveDebrisSprite(sprite) {
  return Boolean(sprite?.parent && sprite.scale && sprite.anchor);
}

function applyAnchoredDebrisSprite(sprite, spriteRef, scale, x, y, texture, zBias) {
  if (!texture || !spriteRef?.frame || !sprite.scale || !sprite.anchor) {
    if (sprite?.scale && sprite?.anchor) {
      sprite.visible = false;
    }
    return;
  }
  const f = spriteRef.frame;
  const sourceW = f.sourceW ?? f.w;
  const sourceH = f.sourceH ?? f.h;
  const footAx = (f.anchorX ?? (sourceW / 2)) / sourceW;
  const footAy = (f.anchorY ?? sourceH) / sourceH;
  sprite.texture = texture;
  sprite.anchor.set(footAx, footAy);
  sprite.width = sourceW * scale;
  sprite.height = sourceH * scale;
  sprite.position.set(x, y);
  sprite.zIndex = isoOccupantDepthZ(x, y, zBias);
  sprite.visible = true;
}

function createParticleSlot() {
  const sprite = new Sprite();
  sprite.eventMode = 'none';
  return {
    active: false,
    sprite,
    state: 'idle',
    stateMs: 0,
    tileKey: '',
    originX: 0,
    originY: 0,
    x: 0,
    y: 0,
    zBias: 0,
    vx: 0,
    vy: 0,
    spinRadPerSec: 0,
    rotation: 0,
    groundY: 0,
    config: null,
    textureReady: false,
    wobbleAmpRad: 0,
    wobblePeriodMs: 0,
    wobbleTimeMs: 0,
    floatPickBiasScreenPx: 0,
  };
}

/**
 * World-anchored plant debris (fall + float) parented to tile containers for iso depth.
 */
export class WindDebrisLayer {
  constructor() {
    /** @type {ReturnType<typeof createParticleSlot>[]} */
    this.particles = Array.from({ length: POOL_SIZE }, () => createParticleSlot());
    this._spawnRng = mulberry32(0xDEB5);
  }

  /**
   * @param {string} tileKey
   */
  recycleForTile(tileKey) {
    for (const slot of this.particles) {
      if (slot.active && slot.tileKey === tileKey) {
        this._release(slot);
      }
    }
  }

  /**
   * @param {number} dtMs
   * @param {import('../../../game/simCore.mjs').GameState | null} gameState
   * @param {{ x?: number, y?: number, strength?: number } | null} windVector
   * @param {import('./windStrengthField.mjs').WindStrengthField} windField
   * @param {Array<{ worldX: number, worldY: number, tile: object }>} sortedTiles
   * @param {Map<string, import('pixi.js').Container>} tileContainers
   * @param {import('pixi.js').Container | null | undefined} worldPanLayer
   * @param {number} viewW
   * @param {number} viewH
   * @param {(screenX: number, screenY: number) => { worldX: number, worldY: number } | null} [pickTileAtScreen]
   */
  step(dtMs, gameState, windVector, windField, sortedTiles, tileContainers, worldPanLayer, viewW, viewH, pickTileAtScreen = null) {
    const windStrength = Number(windVector?.strength) || 0;
    if (!gameState || isWindCalm(windStrength)) {
      this._clearAll();
      return;
    }

    const dt = Math.max(0, Math.min(0.1, Number(dtMs) / 1000));
    const windX = Number(windVector?.x) || 0;
    const windY = Number(windVector?.y) || 0;
    const rng = this._spawnRng;

    this._trySpawn(
      dtMs,
      gameState,
      windVector,
      windField,
      sortedTiles,
      tileContainers,
      worldPanLayer,
      rng,
      windX,
      windY,
    );

    for (const slot of this.particles) {
      if (!slot.active) {
        continue;
      }
      if (!isLiveDebrisSprite(slot.sprite)) {
        this._release(slot);
        continue;
      }
      this._advanceParticle(
        slot,
        dtMs,
        dt,
        windVector,
        windField,
        windX,
        windY,
        worldPanLayer,
        viewW,
        viewH,
        tileContainers,
        pickTileAtScreen,
      );
    }
  }

  _trySpawn(dtMs, gameState, windVector, windField, sortedTiles, tileContainers, worldPanLayer, rng, windX, windY) {
    const windStrength = Number(windVector?.strength) || 0;
    for (const { worldX, worldY, tile } of sortedTiles) {
      if (!tile?.plantIds?.length) {
        continue;
      }
      const tileKey = `${worldX},${worldY}`;
      const tileC = tileContainers.get(tileKey);
      if (!tileC) {
        continue;
      }
      const layout = tileC.__isoOccupantLayout;
      if (!layout?.plantId) {
        continue;
      }
      const anchors = resolvePlantOccupantAnchors(tileC, layout.plantId);
      const anchor = anchors[0] || null;
      const sampleScreen = anchor
        ? tileLocalToScreenPx(anchor.x, anchor.y, tileC, worldPanLayer)
        : { x: layout.screenX, y: layout.occupantAnchorY };
      const local = windField.sampleAtScreenPx(sampleScreen.x, sampleScreen.y);
      const ctx = buildDebrisSpawnContextForTile(
        tile,
        gameState,
        layout,
        worldX,
        worldY,
        rng,
        tileC,
      );
      if (!ctx) {
        continue;
      }
      const chance = spawnChanceThisFrame(ctx, windStrength, dtMs, local.multiplier);
      if (rng() >= chance) {
        continue;
      }
      if (this._countActive() >= POOL_SIZE - 2) {
        return;
      }
      this._spawn(ctx, tileC, rng, windVector, worldPanLayer, local.multiplier);
    }
  }

  _spawn(ctx, tileC, rng, windVector, worldPanLayer, gustMultiplier = 1) {
    const entry = this.particles.find((p) => !p.active);
    if (!entry) {
      return;
    }

    const drag = Math.max(0, Math.min(1, Number(ctx.windDebris?.windDrag) || 0.5));
    const isFloat = ctx.windDebris?.behavior === 'float';
    const spinSign = rng() < 0.5 ? -1 : 1;
    const spinSpeed = isFloat ? 0 : (2.2 + rng() * 3.5) * spinSign;
    const windX = Number(windVector?.x) || 0;
    const windY = Number(windVector?.y) || 0;

    entry.active = true;
    entry.textureReady = false;
    entry.state = 'fadeIn';
    entry.stateMs = 0;
    entry.tileKey = ctx.tileKey;
    entry.originX = ctx.spawnX;
    entry.originY = ctx.spawnY;
    entry.x = ctx.spawnX;
    entry.y = ctx.spawnY;
    entry.zBias = ctx.zBias;
    if (isFloat) {
      initFloatDebrisWobble(entry, rng);
      entry.floatPickBiasScreenPx = floatDebrisPickBiasScreenPx(
        ctx.spawnX,
        ctx.spawnY,
        ctx.groundY,
        tileC,
        worldPanLayer,
      );
      const drift = computeFloatDriftVelocity(windVector, drag, rng, gustMultiplier);
      entry.vx = drift.vx;
      entry.vy = drift.vy;
    } else {
      entry.wobbleAmpRad = 0;
      entry.wobblePeriodMs = 0;
      entry.wobbleTimeMs = 0;
      entry.vx = windX * drag * 42 + (rng() - 0.5) * 14;
      entry.vy = windY * drag * 18 - 10 - rng() * 10;
    }
    entry.spinRadPerSec = spinSpeed;
    entry.rotation = isFloat ? 0 : rng() * Math.PI * 2;
    entry.groundY = ctx.groundY;
    entry.config = ctx.windDebris;
    entry.sprite.alpha = 0;
    entry.sprite.rotation = entry.rotation;
    entry.sprite.visible = false;

    tileC.sortableChildren = true;
    if (entry.sprite.parent && entry.sprite.parent !== tileC) {
      entry.sprite.parent.removeChild(entry.sprite);
    }
    if (!entry.sprite.parent) {
      tileC.addChild(entry.sprite);
    }

    const e = entry;
    getSubTextureForSprite(ctx.spriteRef).then((tex) => {
      if (!e.active || e.sprite.parent !== tileC || !isLiveDebrisSprite(e.sprite)) {
        return;
      }
      applyAnchoredDebrisSprite(
        e.sprite,
        ctx.spriteRef,
        ctx.spriteScale,
        e.x,
        e.y,
        tex,
        e.zBias,
      );
      e.textureReady = true;
      e.sprite.visible = true;
      e.sprite.rotation = e.rotation;
      if (e.state === 'fadeIn') {
        const u = Math.min(1, e.stateMs / FADE_IN_MS);
        e.sprite.alpha = easeOutCubic(u);
      }
    });
  }

  /**
   * Float debris must live on the tile container it visually overlaps so iso paint order stays correct.
   */
  _reparentFloatDebrisIfNeeded(slot, sprite, worldPanLayer, tileContainers, pickTileAtScreen) {
    if (!pickTileAtScreen || !sprite.parent) {
      return;
    }
    const sourceTileC = sprite.parent;
    const footScreen = tileLocalToScreenPx(sprite.x, sprite.y, sourceTileC, worldPanLayer);
    const pickScreen = floatDebrisTilePickScreenPx(
      sprite.x,
      sprite.y,
      sourceTileC,
      worldPanLayer,
      slot.floatPickBiasScreenPx,
    );
    const hit = pickTileAtScreen(pickScreen.x, pickScreen.y);
    if (!hit) {
      return;
    }
    const targetKey = `${hit.worldX},${hit.worldY}`;
    const targetTileC = tileContainers.get(targetKey);
    if (!targetTileC || targetTileC === sourceTileC) {
      return;
    }
    const local = screenToTileLocalPx(footScreen.x, footScreen.y, targetTileC, worldPanLayer);
    targetTileC.sortableChildren = true;
    targetTileC.addChild(sprite);
    slot.tileKey = targetKey;
    slot.x = local.x;
    slot.y = local.y;
    sprite.position.set(local.x, local.y);
    sprite.zIndex = isoOccupantDepthZ(local.x, local.y, slot.zBias);
  }

  _stepFloatDebrisMotion(
    slot,
    dtMs,
    dt,
    windField,
    worldPanLayer,
    viewW,
    viewH,
    tileContainers,
    pickTileAtScreen,
    releaseIfOffscreen,
  ) {
    const sprite = slot.sprite;
    this._reparentFloatDebrisIfNeeded(
      slot,
      sprite,
      worldPanLayer,
      tileContainers,
      pickTileAtScreen,
    );
    let gustMult = 1;
    const tileC = sprite.parent;
    if (tileC && windField) {
      const { x: sx, y: sy } = debrisScreenPx(sprite, tileC, worldPanLayer);
      gustMult = Math.max(0.2, windField.sampleAtScreenPx(sx, sy).multiplier || 1);
    }
    slot.x += slot.vx * dt * gustMult;
    slot.y += slot.vy * dt * gustMult;
    sprite.position.set(slot.x, slot.y);
    sprite.rotation = floatDebrisWobbleRotationRad(slot, dtMs);
    this._reparentFloatDebrisIfNeeded(
      slot,
      sprite,
      worldPanLayer,
      tileContainers,
      pickTileAtScreen,
    );
    sprite.zIndex = isoOccupantDepthZ(slot.x, slot.y, slot.zBias);
    if (releaseIfOffscreen && tileC) {
      const { x: sx, y: sy } = debrisScreenPx(sprite, tileC, worldPanLayer);
      if (!isOnScreen(sx, sy, viewW, viewH, FLOAT_OFFSCREEN_MARGIN_PX)) {
        this._release(slot);
      }
    }
  }

  _advanceParticle(slot, dtMs, dt, windVector, windField, windX, windY, worldPanLayer, viewW, viewH, tileContainers, pickTileAtScreen) {
    const cfg = slot.config;
    const sprite = slot.sprite;

    if (slot.state === 'fadeIn') {
      slot.stateMs += dtMs;
      if (slot.textureReady) {
        const u = Math.min(1, slot.stateMs / FADE_IN_MS);
        sprite.alpha = easeOutCubic(u);
        if (u >= 1) {
          slot.state = 'active';
          slot.stateMs = 0;
        }
      } else {
        sprite.alpha = 0;
      }
    } else if (slot.state === 'resting') {
      slot.stateMs += dtMs;
      sprite.alpha = 1;
      if (slot.stateMs >= REST_MS) {
        slot.state = 'fadeOut';
        slot.stateMs = 0;
      }
    } else if (slot.state === 'fadeOut') {
      slot.stateMs += dtMs;
      const fadeOutMs = cfg?.behavior === 'float' ? FLOAT_FADE_OUT_MS : FADE_OUT_MS;
      const u = Math.min(1, slot.stateMs / fadeOutMs);
      sprite.alpha = 1 - easeOutCubic(u);
      if (u >= 1) {
        this._release(slot);
        return;
      }
    } else {
      sprite.alpha = 1;
    }

    if (slot.state === 'active') {
      const mass = Math.max(0.05, Number(cfg?.mass) || 1);
      const drag = Math.max(0, Math.min(1, Number(cfg?.windDrag) || 0.5));

      if (cfg?.behavior === 'float') {
        slot.stateMs += dtMs;
        if (slot.stateMs >= FLOAT_LIFETIME_MS) {
          slot.state = 'fadeOut';
          slot.stateMs = 0;
        }
        this._stepFloatDebrisMotion(
          slot,
          dtMs,
          dt,
          windField,
          worldPanLayer,
          viewW,
          viewH,
          tileContainers,
          pickTileAtScreen,
          true,
        );
        return;
      }

      slot.vx += windX * drag * 90 * dt;
      slot.vy += windY * drag * 40 * dt;
      slot.vy += (GRAVITY_PX_PER_SEC2 / mass) * dt;
      const terminal = Number(cfg?.terminalFallSpeed) || 48;
      if (slot.vy > terminal) {
        slot.vy = terminal;
      }
      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;
      slot.rotation += slot.spinRadPerSec * dt;
      sprite.rotation = slot.rotation;
      sprite.position.set(slot.x, slot.y);
      sprite.zIndex = isoOccupantDepthZ(slot.x, slot.y, slot.zBias);

      if (slot.y >= slot.groundY) {
        slot.y = slot.groundY;
        slot.vx = 0;
        slot.vy = 0;
        sprite.position.set(slot.x, slot.y);
        sprite.rotation = slot.rotation;
        sprite.zIndex = isoOccupantDepthZ(slot.x, slot.y, slot.zBias);
        slot.state = 'resting';
        slot.stateMs = 0;
      }
    } else if (slot.state === 'fadeOut' && cfg?.behavior === 'float') {
      this._stepFloatDebrisMotion(
        slot,
        dtMs,
        dt,
        windField,
        worldPanLayer,
        viewW,
        viewH,
        tileContainers,
        pickTileAtScreen,
        false,
      );
    } else if (slot.state !== 'fadeOut') {
      sprite.zIndex = isoOccupantDepthZ(slot.x, slot.y, slot.zBias);
    }
  }

  _countActive() {
    let n = 0;
    for (const p of this.particles) {
      if (p.active) {
        n += 1;
      }
    }
    return n;
  }

  _release(slot) {
    slot.active = false;
    slot.state = 'idle';
    slot.stateMs = 0;
    slot.textureReady = false;
    slot.wobbleAmpRad = 0;
    slot.wobblePeriodMs = 0;
    slot.wobbleTimeMs = 0;
    slot.floatPickBiasScreenPx = 0;
    const sprite = slot.sprite;
    if (sprite.parent) {
      sprite.parent.removeChild(sprite);
    }
    if (isLiveDebrisSprite(sprite)) {
      sprite.visible = false;
      sprite.alpha = 1;
      sprite.rotation = 0;
    }
  }

  _clearAll() {
    for (const slot of this.particles) {
      if (slot.active) {
        this._release(slot);
      }
    }
  }
}

export {
  POOL_SIZE,
  FADE_IN_MS,
  REST_MS,
  FADE_OUT_MS,
  FLOAT_LIFETIME_MS,
  FLOAT_FADE_OUT_MS,
  FLOAT_OFFSCREEN_MARGIN_PX,
};
