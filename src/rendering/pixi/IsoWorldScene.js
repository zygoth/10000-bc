import {
  Container, Graphics, Sprite, Text,
} from 'pixi.js';
import { getTileAt } from '../../game/simCore.mjs';
import {
  getCampStationWorldSpriteFrame,
  getCampWigwamSpriteFrame,
} from '../../game/campSpriteCatalog.mjs';
import {
  getDeadLogSpriteFrame,
  getPlantSpriteFrame,
  getRockSpriteFrame,
  getTerrainSpriteFrame,
} from '../../game/plantSpriteCatalog.mjs';
import { getGroundFungusZoneTileSpriteFrame } from '../../game/groundFungusSpriteCatalog.mjs';
import { PLANT_BY_ID } from '../../game/plantCatalog.mjs';
import {
  deterministicMushroomScaleJitter,
  groundFungusClusterCountForYieldGrams,
  lifeStageSizeVisualScaleMultiplier,
  patchSpriteScaleForCapacity,
  resolvePatchCapacity,
  resolvePatchLayout,
  stageSizeForPlant,
} from '../../game/plantPatchLayout.mjs';
import {
  buildTileEntityTokens,
  getStationIdAtTile,
} from '../../game/tileEntityTokens.mjs';
import { resolveInventoryItemSpriteFrame } from '../../game/inventoryItemSpriteResolve.mjs';
import {
  computeOccupantAnchorYFromTileTop,
  computeTileTopCenterYFromGroundAnchor,
} from '../../ui/isoProjection.js';
import {
  ISO_BASE_SCALE,
  ISO_OCCUPANT_VISUAL_NUDGE_PX,
  ISO_ROCK_STACK_OFFSET_PX,
  ISO_CAMP_WORLD_SPRITE_NUDGE_UP_PX,
  ISO_CAMP_WORLD_SPRITE_SCALE_MULT,
  ISO_GROUND_FUNGUS_ZONE_REL_TO_OCCUPANT,
  ISO_SOURCE_TILE_WIDTH,
  ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX,
  ISO_TILE_HALF_HEIGHT_PX,
  ISO_TILE_HALF_WIDTH_PX,
  ISO_TILE_HEIGHT_PX,
  ISO_WATER_VERTICAL_OFFSET_PX,
  ISO_WORLD_ITEM_FOOT_NUDGE_PX,
  ISO_WORLD_ITEM_SCALE_MULT,
  elevationToIsoOffsetPx,
} from './isoConstants.js';
import { computeVisibleIsoTiles, sortVisibleIsoTiles } from './isoMath.js';
import { computeWorldPanLayerPixels } from './isoCameraRoll.js';
import { getSubTextureForSprite } from './textureCache.js';

/** Tile-to-tile player label motion (ms). */
const PLAYER_MOVE_TWEEN_MS = 280;
/** Dropped item flight: player-tile to target-tile (ms). */
const ITEM_DROP_ARRIVAL_MS = 360;

function easeOutCubic(t) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function isoPlantScale(plant) {
  if (!plant) {
    return ISO_BASE_SCALE;
  }
  const species = PLANT_BY_ID[plant.speciesId] || null;
  const stageSize = stageSizeForPlant(species, plant);
  return ISO_BASE_SCALE * lifeStageSizeVisualScaleMultiplier(stageSize);
}

function applyAnchoredSprite(pixiSprite, sprite, scale, anchorScreenX, anchorScreenY, texture, options = null) {
  if (!texture || !sprite?.frame) {
    pixiSprite.visible = false;
    return;
  }
  // Destroyed Pixi v8 sprites null out `anchor`; ignore stale async texture callbacks.
  if (!pixiSprite.anchor) {
    return;
  }
  const f = sprite.frame;
  const sourceW = f.sourceW ?? f.w;
  const sourceH = f.sourceH ?? f.h;
  const footAx = (f.anchorX ?? (sourceW / 2)) / sourceW;
  const footAy = (f.anchorY ?? sourceH) / sourceH;
  const anchorYOffsetPx = Number(options?.anchorYOffsetPx) || 0;
  pixiSprite.texture = texture;
  pixiSprite.anchor.set(footAx, footAy);
  pixiSprite.width = sourceW * scale;
  pixiSprite.height = sourceH * scale;
  pixiSprite.position.set(anchorScreenX, anchorScreenY + anchorYOffsetPx);
  pixiSprite.visible = true;
  if (options?.tint !== undefined && options?.tint !== null) {
    pixiSprite.tint = options.tint;
  } else {
    pixiSprite.tint = 0xffffff;
  }
}

function deepWaterTint() {
  return 0x8aa8c4;
}

/** Stable serialization for dead-log fungi in render signatures. */
function isoDeadLogFungiSig(deadLog) {
  if (!deadLog?.fungi?.length) {
    return '';
  }
  return [...deadLog.fungi]
    .map((f) => `${f.species_id || ''}:${Number(f.yield_current_grams) || 0}`)
    .sort()
    .join(',');
}

/** Stable serialization for world item stacks on a tile. */
function isoWorldItemsSig(worldItems) {
  if (!Array.isArray(worldItems) || worldItems.length === 0) {
    return '';
  }
  return worldItems
    .map((e) => `${typeof e?.itemId === 'string' ? e.itemId : ''}:${Math.floor(Number(e?.quantity) || 0)}`)
    .sort()
    .join(',');
}

/**
 * Content-only signature: changes when sim/world data affecting this tile's visuals changes.
 * Excludes camera anchor and window layout (handled by `_lastIsoLayoutSig` on the scene).
 */
function computeIsoTileContentSignature(gameState, worldX, worldY, tile) {
  if (!tile) {
    return `missing|${worldX}|${worldY}`;
  }
  const south = getTileAt(gameState, worldX, worldY + 1);
  const east = getTileAt(gameState, worldX + 1, worldY);
  const firstPlantId = tile.plantIds?.[0] || '';
  const plant = firstPlantId && gameState.plants?.[firstPlantId] ? gameState.plants[firstPlantId] : null;
  const speciesDef = plant ? (PLANT_BY_ID[plant.speciesId] || null) : null;
  const patchCapacity = (plant && speciesDef) ? resolvePatchCapacity(speciesDef, plant) : 1;
  const stageSize = (plant && speciesDef) ? stageSizeForPlant(speciesDef, plant) : 1;
  const patchScale = patchSpriteScaleForCapacity(patchCapacity, stageSize, 1);
  const plantOrLogScale = plant ? isoPlantScale(plant) : ISO_BASE_SCALE;

  const zone = tile.groundFungusZone;
  const zYieldN = zone ? Number(zone.yieldCurrentGrams) : 0;
  const zCluster = zone && zYieldN > 0
    ? groundFungusClusterCountForYieldGrams(zYieldN)
    : 0;
  const zHasGfArt = zone && zYieldN > 0 && zone.speciesId
    ? Boolean(getGroundFungusZoneTileSpriteFrame(zone.speciesId))
    : false;
  const zoneSig = zone
    ? `${zone.speciesId || ''}:${zYieldN}:gfz:${zHasGfArt ? 1 : 0}:gcl:${zCluster}`
    : '';

  const worldItems = Array.isArray(gameState.worldItemsByTile?.[`${worldX},${worldY}`])
    ? gameState.worldItemsByTile[`${worldX},${worldY}`]
    : [];
  const isCampTile = Number(gameState?.camp?.anchorX) === worldX && Number(gameState?.camp?.anchorY) === worldY;
  const stationAtTile = getStationIdAtTile(gameState?.camp, worldX, worldY);
  const campArtSig = stationAtTile
    ? (getCampStationWorldSpriteFrame(stationAtTile) ? `st:${stationAtTile}` : `st0:${stationAtTile}`)
    : (isCampTile ? (getCampWigwamSpriteFrame() ? 'wig:1' : 'wig:0') : '');
  const drying = gameState?.camp?.dryingRackUnlocked ? '1' : '0';

  const southSig = south
    ? `${Number(south.elevation) || 0}:${south.waterType ? 'w' : ''}`
    : 'x';
  const eastSig = east
    ? `${Number(east.elevation) || 0}:${east.waterType ? 'w' : ''}`
    : 'x';

  const parts = [
    worldX,
    worldY,
    Number(tile.elevation) || 0,
    tile.waterType || '',
    tile.waterFrozen ? 1 : 0,
    tile.waterDepth || '',
    tile.rockType || '',
    firstPlantId,
    plant ? `${plant.speciesId}:${plant.stageName}:${plant.id}` : '',
    patchCapacity,
    patchScale,
    plantOrLogScale,
    tile.deadLog ? `dl:${isoDeadLogFungiSig(tile.deadLog)}` : '',
    zoneSig,
    tile.beehive?.active ? 'b' : '',
    tile.squirrelCache && Number(tile.squirrelCache.nutContentGrams) > 0 ? `c:${Math.floor(Number(tile.squirrelCache.nutContentGrams) || 0)}` : '',
    tile.simpleSnare?.active ? 's' : '',
    tile.deadfallTrap?.active ? 'd' : '',
    tile.fishTrap?.active ? 'f' : '',
    tile.autoRod?.active ? 'a' : '',
    tile.sapTap?.active ? 'p' : '',
    tile.leachingBasket?.active ? 'l' : '',
    isCampTile ? `camp:${drying}` : '',
    stationAtTile || '',
    campArtSig,
    isoWorldItemsSig(worldItems),
    southSig,
    eastSig,
  ];
  return parts.join('\u001f');
}

export class IsoWorldScene {
  constructor() {
    this.root = new Container();
    /** Sub-pixel camera pan: tiles + overlays built at integer anchor, shifted by fractional camera. */
    this.worldPanLayer = new Container();
    this.tilesRoot = new Container();
    /** Drawn after all tile terrain/occupants so labels are not covered by neighbors' elevation stacks. */
    this.tileLabelOverlayRoot = new Container();
    this.selectionGraphics = new Graphics();
    /** Move-target preview (closest tile under cursor); updated without full `sync`. */
    this.hoverMoveTargetGraphics = new Graphics();
    this.worldPanLayer.addChild(this.tilesRoot);
    this.worldPanLayer.addChild(this.tileLabelOverlayRoot);
    /** `[player]` is tweened between tiles; tile tokens omit the player. */
    this.playerTokenRoot = new Container();
    this.playerTokenText = new Text({
      text: '[player]',
      style: {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: 11,
        fontWeight: '700',
        fill: 0xfff4d8,
        align: 'center',
        stroke: { color: 0x000000, width: 4 },
      },
    });
    this.playerTokenText.anchor.set(0.5, 1);
    this.playerTokenRoot.addChild(this.playerTokenText);
    this.worldPanLayer.addChild(this.playerTokenRoot);
    this.worldPanLayer.addChild(this.selectionGraphics);
    this.worldPanLayer.addChild(this.hoverMoveTargetGraphics);
    /** Short-lived “item falling to ground” overlay (uses player `lastDrop`). */
    this.dropArrivalRoot = new Container();
    this.worldPanLayer.addChild(this.dropArrivalRoot);
    this._pixiApp = null;
    /** @type {string | null} */
    this._lastDropArrivalKey = null;
    /**
     * Current item-drop flight (endpoints reprojected from world each frame so camera/Origin
     * updates mid-flight do not stutter the sprite).
     * @type {null | { t0: number, node: import('pixi.js').Sprite | import('pixi.js').Text, fromW: { x: number, y: number }, toW: { x: number, y: number }, itemId: string, startAbovePx: number }}
     */
    this._dropArrivalFlight = null;
    /** @type {import('../../game/simCore.mjs').GameState | null} */
    this._viewGameState = null;
    this._lastSyncBaseCamX = 0;
    this._lastSyncBaseCamY = 0;
    /** Distinguish overlapping async texture loads (see _playDropItemArrivalIfNew). */
    this._dropPendingKey = null;
    this._dropArrivalFrame = this._onDropArrivalFrame.bind(this);
    this.root.addChild(this.worldPanLayer);
    this.tileContainers = new Map();
    this.lastSorted = [];
    this.lastOrigin = { originX: 0, originY: 0 };
    /** Bumps each sync so late texture loads do not touch destroyed sprites. */
    this._syncGeneration = 0;
    /** When window/origin/debug changes, all tiles must rebuild (screen math changes). */
    this._lastIsoLayoutSig = null;

    /** @type {{ x: number, y: number } | null} */
    this._playerLastSim = null;
    /** @type {null | { fromW: { x: number, y: number }, toW: { x: number, y: number }, tileAx: number, tileAy: number, tileBx: number, tileBy: number, startMs: number }} */
    this._playerTween = null;
  }

  _topFaceReferenceAnchorYForTile(gameState, worldX, worldY) {
    const tile = getTileAt(gameState, worldX, worldY);
    if (!tile) {
      return ISO_SOURCE_TILE_WIDTH * ISO_BASE_SCALE;
    }
    const grassSprite = !tile.waterType ? getTerrainSpriteFrame('grass') : null;
    const dirtSprite = !tile.waterType ? getTerrainSpriteFrame('dirt') : null;
    const waterSprite = tile.waterType ? getTerrainSpriteFrame('water') : null;
    const topFaceReferenceSprite = grassSprite || dirtSprite || waterSprite || null;
    return (
      topFaceReferenceSprite?.frame?.anchorY
      ?? topFaceReferenceSprite?.frame?.sourceH
      ?? topFaceReferenceSprite?.frame?.h
      ?? ISO_SOURCE_TILE_WIDTH
    ) * ISO_BASE_SCALE;
  }

  /**
   * Screen position for the `[player]` label at fractional world coords, lerping
   * elevation / top-face anchor between two integer tiles (for smooth diagonal moves).
   */
  _computePlayerTokenAtWorldFloat(gameState, wx, wy, baseCamX, baseCamY, elevT, tileAx, tileAy, tileBx, tileBy) {
    const { originX, originY } = this.lastOrigin;
    const elevA = elevationToIsoOffsetPx(getTileAt(gameState, tileAx, tileAy)?.elevation);
    const elevB = elevationToIsoOffsetPx(getTileAt(gameState, tileBx, tileBy)?.elevation);
    const elevOff = lerp(elevA, elevB, elevT);
    const topRefA = this._topFaceReferenceAnchorYForTile(gameState, tileAx, tileAy);
    const topRefB = this._topFaceReferenceAnchorYForTile(gameState, tileBx, tileBy);
    const topRef = lerp(topRefA, topRefB, elevT);
    const localX = wx - baseCamX;
    const localY = wy - baseCamY;
    const screenX = (localX - localY) * ISO_TILE_HALF_WIDTH_PX + originX;
    const flatY = (localX + localY) * ISO_TILE_HALF_HEIGHT_PX + originY;
    const groundY = flatY + ISO_TILE_HALF_HEIGHT_PX - elevOff;
    const tileTopCenterY = computeTileTopCenterYFromGroundAnchor(
      groundY,
      topRef,
      ISO_TILE_HALF_HEIGHT_PX,
    );
    const tokenY = tileTopCenterY - 24 + ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX;
    return { screenX, tokenY };
  }

  /**
   * `sync` builds geometry at integer tile anchors (`floor(camera)`). Apply fractional camera
   * by shifting the whole world layer — avoids rebuilding sprites every sub-tile frame.
   */
  applyCameraPixelRoll(cameraFx, cameraFy) {
    const { px, py } = computeWorldPanLayerPixels(cameraFx, cameraFy);
    this.worldPanLayer.position.set(px, py);
  }

  /**
   * Provides `ticker` for one-shot item-drop flights (set from PixiWorldView after `Application` init).
   * @param {import('pixi.js').Application} app
   */
  attachApplication(app) {
    this._pixiApp = app;
  }

  _stopDropArrivalAnim() {
    const f = this._dropArrivalFlight;
    if (f) {
      if (this._pixiApp?.ticker) {
        this._pixiApp.ticker.remove(this._dropArrivalFrame);
      }
      this._setGroundWorldItemSpriteVisibleOnTile(f.toW.x, f.toW.y, f.itemId, true);
      if (f.node?.parent) {
        f.node.destroy();
      }
    }
    this._dropArrivalFlight = null;
    this.dropArrivalRoot.removeChildren();
  }

  /**
   * @returns {{ screenX: number, groundY: number } | null}
   */
  _screenGroundForIntegerTile(gameState, worldX, worldY, baseCamX, baseCamY) {
    const { originX, originY } = this.lastOrigin;
    const localX = worldX - baseCamX;
    const localY = worldY - baseCamY;
    const screenX = Math.round((localX - localY) * ISO_TILE_HALF_WIDTH_PX + originX);
    const screenY = Math.round((localX + localY) * ISO_TILE_HALF_HEIGHT_PX + originY);
    const tile = getTileAt(gameState, worldX, worldY);
    const elev = tile ? elevationToIsoOffsetPx(tile.elevation) : 0;
    const groundY = screenY + ISO_TILE_HALF_HEIGHT_PX - elev;
    return { screenX, groundY };
  }

  /**
   * One item-drop: Pixi `ticker` drives the ease; from/to in **screen** space are recomputed from
   * `lastOrigin` + base cam each frame so a mid-flight `sync` (e.g. camera crossing a tile) does
   * not leave the flyer on stale coordinates.
   */
  _onDropArrivalFrame() {
    const f = this._dropArrivalFlight;
    if (!f?.node) {
      return;
    }
    if (!f.node.parent) {
      if (this._pixiApp?.ticker) {
        this._pixiApp.ticker.remove(this._dropArrivalFrame);
      }
      this._dropArrivalFlight = null;
      this._setGroundWorldItemSpriteVisibleOnTile(f.toW.x, f.toW.y, f.itemId, true);
      return;
    }
    const gs = this._viewGameState;
    if (!gs) {
      this._stopDropArrivalAnim();
      return;
    }
    const bax = this._lastSyncBaseCamX;
    const bay = this._lastSyncBaseCamY;
    const fromG = this._screenGroundForIntegerTile(gs, f.fromW.x, f.fromW.y, bax, bay);
    const toG = this._screenGroundForIntegerTile(gs, f.toW.x, f.toW.y, bax, bay);
    if (!fromG || !toG) {
      this._stopDropArrivalAnim();
      return;
    }
    const nudge = ISO_WORLD_ITEM_FOOT_NUDGE_PX;
    const fx = fromG.screenX;
    const fy = fromG.groundY - f.startAbovePx - nudge;
    const tx = toG.screenX;
    const ty = toG.groundY - nudge;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const u = Math.min(1, (now - f.t0) / ITEM_DROP_ARRIVAL_MS);
    const e = easeOutCubic(u);
    f.node.position.set(lerp(fx, tx, e), lerp(fy, ty, e));
    if (u >= 1) {
      if (this._pixiApp?.ticker) {
        this._pixiApp.ticker.remove(this._dropArrivalFrame);
      }
      this._dropArrivalFlight = null;
      this._setGroundWorldItemSpriteVisibleOnTile(f.toW.x, f.toW.y, f.itemId, true);
      f.node.destroy();
    }
  }

  /**
   * If `player.lastDrop` is from the current sim tick, animate one flying sprite to the drop target.
   * @param {import('../../game/simCore.mjs').GameState} gameState
   */
  async _playDropItemArrivalIfNew(gameState, baseCamX, baseCamY) {
    if (!this._pixiApp?.ticker) {
      return;
    }
    const ld = gameState?.actors?.player?.lastDrop;
    if (!ld || !Number.isInteger(ld.x) || !Number.isInteger(ld.y)) {
      return;
    }
    const day = Number.isInteger(ld.day) ? ld.day : 0;
    const dropTick = Math.max(0, Math.floor(Number(ld.dayTick) || 0));
    const stDay = Number.isInteger(gameState?.totalDaysSimulated) ? gameState.totalDaysSimulated : 0;
    const stTick = Math.max(0, Math.floor(Number(gameState?.dayTick) || 0));
    if (day !== stDay) {
      return;
    }
    // `lastDrop` is written during applyActionEffect, then the action runner advances `dayTick`
    // (item_drop costs 1 tick), so the stored tick is usually `stTick - 1`.
    if (dropTick !== stTick && dropTick !== stTick - 1) {
      return;
    }
    const itemId = typeof ld.itemId === 'string' ? ld.itemId : '';
    if (!itemId) {
      return;
    }
    const p = gameState.actors?.player;
    const px = Number(p?.x);
    const py = Number(p?.y);
    if (!Number.isInteger(px) || !Number.isInteger(py)) {
      return;
    }

    const q = Math.max(0, Math.floor(Number(ld.quantity) || 0));
    const key = `d|${stDay}|${dropTick}|${ld.x}|${ld.y}|${itemId}|${q}`;
    if (key === this._lastDropArrivalKey) {
      return;
    }

    const from = this._screenGroundForIntegerTile(gameState, px, py, baseCamX, baseCamY);
    const to = this._screenGroundForIntegerTile(gameState, ld.x, ld.y, baseCamX, baseCamY);
    if (!from || !to) {
      return;
    }

    this._stopDropArrivalAnim();
    this._dropPendingKey = key;

    const startAbovePx = 28;
    const worldSprite = resolveInventoryItemSpriteFrame(itemId);

    const startFlight = (node) => {
      if (this._dropPendingKey !== key) {
        return;
      }
      this._setGroundWorldItemSpriteVisibleOnTile(ld.x, ld.y, itemId, false);
      this._lastDropArrivalKey = key;
      this._dropPendingKey = null;
      this.dropArrivalRoot.addChild(node);
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const gs0 = this._viewGameState || gameState;
      const bax = this._lastSyncBaseCamX;
      const bay = this._lastSyncBaseCamY;
      const fromG0 = this._screenGroundForIntegerTile(gs0, px, py, bax, bay);
      if (fromG0) {
        const nudge = ISO_WORLD_ITEM_FOOT_NUDGE_PX;
        node.position.set(
          fromG0.screenX,
          fromG0.groundY - startAbovePx - nudge,
        );
      }
      this._dropArrivalFlight = {
        t0,
        node,
        fromW: { x: px, y: py },
        toW: { x: ld.x, y: ld.y },
        itemId,
        startAbovePx,
      };
      this._pixiApp.ticker.add(this._dropArrivalFrame);
    };

    if (worldSprite) {
      const tex = await getSubTextureForSprite(worldSprite);
      if (this._dropPendingKey !== key) {
        return;
      }
      const spr = new Sprite(tex);
      const f = worldSprite.frame;
      const sourceW = f?.sourceW ?? f?.w ?? 64;
      const sourceH = f?.sourceH ?? f?.h ?? 64;
      const m = ISO_BASE_SCALE * ISO_WORLD_ITEM_SCALE_MULT;
      spr.width = sourceW * m;
      spr.height = sourceH * m;
      spr.anchor.set(0.5, 0.9);
      startFlight(spr);
    } else {
      if (this._dropPendingKey !== key) {
        return;
      }
      const t = new Text({
        text: itemId.includes(':') ? (itemId.split(':')[1] || '?').slice(0, 3) : itemId.slice(0, 3),
        style: {
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          fontSize: 12,
          fill: 0xfff4d8,
          fontWeight: '800',
          stroke: { color: 0x000000, width: 3 },
        },
      });
      t.anchor.set(0.5, 1);
      startFlight(t);
    }
  }

  /**
   * Per-frame player label position (tweened between sim tiles). Call from the Pixi rAF loop.
   */
  stepPlayerVisual(gameState, cameraFx, cameraFy) {
    if (!this.playerTokenRoot || !this.playerTokenText) {
      return;
    }
    const p = gameState?.actors?.player;
    const sx = p?.x;
    const sy = p?.y;
    if (!Number.isInteger(sx) || !Number.isInteger(sy)) {
      this.playerTokenRoot.visible = false;
      this._playerLastSim = null;
      this._playerTween = null;
      return;
    }
    if (!Array.isArray(this.lastSorted) || this.lastSorted.length === 0) {
      return;
    }

    const baseCamX = Math.floor(Number(cameraFx) + 1e-9);
    const baseCamY = Math.floor(Number(cameraFy) + 1e-9);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (this._playerLastSim === null) {
      this._playerLastSim = { x: sx, y: sy };
      const pos = this._computePlayerTokenAtWorldFloat(
        gameState, sx, sy, baseCamX, baseCamY, 1, sx, sy, sx, sy,
      );
      if (pos) {
        this.playerTokenText.position.set(pos.screenX, pos.tokenY);
        this.playerTokenRoot.visible = true;
      }
      return;
    }

    if (sx !== this._playerLastSim.x || sy !== this._playerLastSim.y) {
      let fromWx;
      let fromWy;
      let tileAx;
      let tileAy;
      if (this._playerTween) {
        const { fromW, toW, startMs } = this._playerTween;
        const uPrev = Math.min(1, (now - startMs) / PLAYER_MOVE_TWEEN_MS);
        const ePrev = easeOutCubic(uPrev);
        fromWx = fromW.x + (toW.x - fromW.x) * ePrev;
        fromWy = fromW.y + (toW.y - fromW.y) * ePrev;
        tileAx = Math.round(fromWx);
        tileAy = Math.round(fromWy);
      } else {
        fromWx = this._playerLastSim.x;
        fromWy = this._playerLastSim.y;
        tileAx = this._playerLastSim.x;
        tileAy = this._playerLastSim.y;
      }
      this._playerTween = {
        fromW: { x: fromWx, y: fromWy },
        toW: { x: sx, y: sy },
        tileAx,
        tileAy,
        tileBx: sx,
        tileBy: sy,
        startMs: now,
      };
      this._playerLastSim = { x: sx, y: sy };
    }

    if (this._playerTween) {
      const { fromW, toW, tileAx, tileAy, tileBx, tileBy, startMs } = this._playerTween;
      const u = Math.min(1, (now - startMs) / PLAYER_MOVE_TWEEN_MS);
      const e = easeOutCubic(u);
      const wx = fromW.x + (toW.x - fromW.x) * e;
      const wy = fromW.y + (toW.y - fromW.y) * e;
      const pos = this._computePlayerTokenAtWorldFloat(
        gameState, wx, wy, baseCamX, baseCamY, e, tileAx, tileAy, tileBx, tileBy,
      );
      if (pos) {
        this.playerTokenText.position.set(pos.screenX, pos.tokenY);
        this.playerTokenRoot.visible = true;
      }
      if (u >= 1) {
        this._playerTween = null;
      }
    } else {
      const pos = this._computePlayerTokenAtWorldFloat(
        gameState, sx, sy, baseCamX, baseCamY, 1, sx, sy, sx, sy,
      );
      if (pos) {
        this.playerTokenText.position.set(pos.screenX, pos.tokenY);
        this.playerTokenRoot.visible = true;
      }
    }
  }

  _isoGlobalLayoutSig(originX, originY, windowWidth, windowHeight, cameraAnchorElevationPx, showAnchorDebug) {
    return `${originX}\u001f${originY}\u001f${windowWidth}\u001f${windowHeight}\u001f${cameraAnchorElevationPx}\u001f${showAnchorDebug ? 1 : 0}`;
  }

  _setGroundWorldItemSpriteVisibleOnTile(wx, wy, itemId, vis) {
    const tileC = this.tileContainers.get(`${wx},${wy}`);
    if (!tileC) {
      return;
    }
    for (const ch of tileC.children) {
      if (ch?.__isoWorldGroundItem && ch?.__isoWorldItemId === itemId) {
        ch.visible = vis;
      }
    }
  }

  _applyIsoTileCameraPanOffset(tileC, baseCamX, baseCamY) {
    const ref = tileC.__isoBuildBaseCam;
    if (!ref) {
      return;
    }
    const dbcx = baseCamX - ref.x;
    const dbcy = baseCamY - ref.y;
    tileC.position.set(
      (-dbcx + dbcy) * ISO_TILE_HALF_WIDTH_PX,
      (-dbcx - dbcy) * ISO_TILE_HALF_HEIGHT_PX,
    );
  }

  /**
   * Label / debug overlay nodes for one tile (rebuilt every sync; terrain may be skipped).
   */
  _appendIsoTileOverlayLabels(
    labelOverlayQueue,
    {
      depthKey,
      worldX,
      screenX,
      tileTopCenterY,
      occupantAnchorY,
      plant,
      occupantSprite,
      combinedOverlaySymbol,
      tileEntityTokens,
      showAnchorDebug,
    },
  ) {
    if (!occupantSprite && plant) {
      const t = new Text({
        text: plant.speciesId[0]?.toUpperCase() || '?',
        style: {
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          fontSize: 11,
          fontWeight: '700',
          fill: 0xfff4d8,
          align: 'center',
          stroke: { color: 0x000000, width: 3 },
        },
      });
      t.anchor.set(0.5, 1);
      t.position.set(screenX, tileTopCenterY - 12 + ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX);
      labelOverlayQueue.push({ depth: depthKey, wx: worldX, node: t });
    }

    if (showAnchorDebug) {
      const g = new Graphics();
      g.roundPixels = true;
      g.circle(0, 0, 4);
      g.fill({ color: 0xff00ff, alpha: 0.9 });
      g.position.set(screenX, occupantAnchorY);
      labelOverlayQueue.push({ depth: depthKey, wx: worldX, node: g });
    }

    if (combinedOverlaySymbol) {
      const t = new Text({
        text: combinedOverlaySymbol,
        style: {
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          fontSize: 22,
          fontWeight: '800',
          fill: 0xffe6b2,
          align: 'center',
          stroke: { color: 0x000000, width: 3 },
        },
      });
      t.anchor.set(0.5, 1);
      t.position.set(screenX, tileTopCenterY - 8 + ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX);
      labelOverlayQueue.push({ depth: depthKey, wx: worldX, node: t });
    }

    tileEntityTokens.forEach((token, idx) => {
      const t = new Text({
        text: token,
        style: {
          fontFamily: 'system-ui, Segoe UI, sans-serif',
          fontSize: 11,
          fontWeight: '700',
          fill: 0xfff4d8,
          align: 'center',
          stroke: { color: 0x000000, width: 4 },
        },
      });
      t.anchor.set(0.5, 1);
      t.position.set(screenX, tileTopCenterY - 24 - (idx * 16) + ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX);
      labelOverlayQueue.push({ depth: depthKey, wx: worldX, node: t });
    });
  }

  /**
   * @returns {Promise<void>}
   */
  async sync({
    gameState,
    cameraX,
    cameraY,
    windowWidth,
    windowHeight,
    cameraAnchorElevationPx,
    selectedTileX,
    selectedTileY,
    showAnchorDebug,
  }) {
    this._syncGeneration += 1;

    const { visible, originX, originY } = computeVisibleIsoTiles(
      gameState,
      cameraX,
      cameraY,
      windowWidth,
      windowHeight,
      cameraAnchorElevationPx,
    );
    const sorted = sortVisibleIsoTiles(visible);
    this.lastSorted = sorted;
    this.lastOrigin = { originX, originY };

    const baseCamX = Math.floor(Number(cameraX) + 1e-9);
    const baseCamY = Math.floor(Number(cameraY) + 1e-9);
    this._viewGameState = gameState;
    this._lastSyncBaseCamX = baseCamX;
    this._lastSyncBaseCamY = baseCamY;

    const nextKeys = new Set(sorted.map(({ worldX, worldY }) => `${worldX},${worldY}`));
    for (const key of this.tileContainers.keys()) {
      if (!nextKeys.has(key)) {
        const c = this.tileContainers.get(key);
        this.tilesRoot.removeChild(c);
        c.destroy({ children: true });
        this.tileContainers.delete(key);
      }
    }

    while (this.tileLabelOverlayRoot.children.length > 0) {
      const ch = this.tileLabelOverlayRoot.removeChildAt(this.tileLabelOverlayRoot.children.length - 1);
      ch.destroy({ children: true });
    }

    const texturePromises = [];
    const labelOverlayQueue = [];

    const layoutSig = this._isoGlobalLayoutSig(
      originX,
      originY,
      windowWidth,
      windowHeight,
      cameraAnchorElevationPx,
      showAnchorDebug,
    );
    const layoutChanged = this._lastIsoLayoutSig !== layoutSig;
    this._lastIsoLayoutSig = layoutSig;

    for (const { worldX, worldY, tile } of sorted) {
      const key = `${worldX},${worldY}`;
      const depthKey = worldY + worldX;
      let tileC = this.tileContainers.get(key);
      if (!tileC) {
        tileC = new Container();
        this.tileContainers.set(key, tileC);
        this.tilesRoot.addChild(tileC);
      }

      const contentSig = computeIsoTileContentSignature(gameState, worldX, worldY, tile);
      const canSkip = !layoutChanged
        && tileC.__isoContentSig === contentSig
        && tileC.children.length > 0;

      const localX = worldX - baseCamX;
      const localY = worldY - baseCamY;
      const screenX = Math.round((localX - localY) * ISO_TILE_HALF_WIDTH_PX + originX);
      const screenY = Math.round((localX + localY) * ISO_TILE_HALF_HEIGHT_PX + originY);
      const elevationOffsetPx = elevationToIsoOffsetPx(tile.elevation);
      const groundY = screenY + ISO_TILE_HALF_HEIGHT_PX - elevationOffsetPx;

      const firstPlantId = tile.plantIds[0];
      const plant = firstPlantId ? gameState.plants[firstPlantId] : null;
      const deadLogSprite = tile.deadLog ? getDeadLogSpriteFrame() : null;
      const occupantSprite = plant
        ? getPlantSpriteFrame(plant.speciesId, plant.stageName)
        : deadLogSprite;
      const speciesDef = plant ? (PLANT_BY_ID[plant.speciesId] || null) : null;
      const patchCapacity = (plant && speciesDef) ? resolvePatchCapacity(speciesDef, plant) : 1;
      const stageSize = (plant && speciesDef) ? stageSizeForPlant(speciesDef, plant) : 1;
      const patchScale = patchSpriteScaleForCapacity(patchCapacity, stageSize, 1);
      const plantOrLogScale = plant ? isoPlantScale(plant) : ISO_BASE_SCALE;

      const zone = tile.groundFungusZone;
      const groundYieldN = zone ? Number(zone.yieldCurrentGrams) : 0;
      const groundClusterN = zone && groundYieldN > 0
        ? groundFungusClusterCountForYieldGrams(groundYieldN)
        : 0;
      const groundZoneFr = groundClusterN > 0 && zone?.speciesId
        ? getGroundFungusZoneTileSpriteFrame(zone.speciesId)
        : null;
      const zoneSymbol = zone && groundYieldN > 0 && !groundZoneFr && zone.speciesId
        ? zone.speciesId[0].toUpperCase()
        : '';
      const logMushroomSymbol = tile.deadLog
        ? ((tile.deadLog.fungi || [])
          .find((entry) => Number(entry?.yield_current_grams) > 0)
          ?.species_id?.[0]?.toUpperCase() || '')
        : '';
      const mushroomOverlaySymbol = logMushroomSymbol || (!plant && zoneSymbol ? zoneSymbol : '');
      const featureOverlaySymbol = (showAnchorDebug && tile.beehive?.active)
        ? 'B'
        : (tile.squirrelCache && Number(tile.squirrelCache.nutContentGrams) > 0 ? 'C' : '');
      const combinedOverlaySymbol = [mushroomOverlaySymbol, featureOverlaySymbol].filter(Boolean).join('');

      const worldItems = Array.isArray(gameState.worldItemsByTile?.[`${worldX},${worldY}`])
        ? gameState.worldItemsByTile[`${worldX},${worldY}`]
        : [];
      const isCampTile = Number(gameState?.camp?.anchorX) === worldX && Number(gameState?.camp?.anchorY) === worldY;
      const stationAtTile = getStationIdAtTile(gameState?.camp, worldX, worldY);
      const campWorldSprite = stationAtTile
        ? getCampStationWorldSpriteFrame(stationAtTile)
        : (isCampTile ? getCampWigwamSpriteFrame() : null);
      const tileEntityTokens = buildTileEntityTokens(tile, {
        isPlayerTile: false,
        isCampTile,
        stationAtTile,
        worldItems,
        camp: gameState?.camp,
        omitCampEntityLabels: Boolean(campWorldSprite),
      });

      const grassSprite = !tile.waterType ? getTerrainSpriteFrame('grass') : null;
      const dirtSprite = !tile.waterType ? getTerrainSpriteFrame('dirt') : null;
      const waterSprite = tile.waterType ? getTerrainSpriteFrame('water') : null;
      const missingTerrainSprites = tile.waterType
        ? !waterSprite
        : (!dirtSprite && !grassSprite);
      const topFaceReferenceSprite = grassSprite || dirtSprite || waterSprite || null;
      const topFaceReferenceAnchorY = (
        topFaceReferenceSprite?.frame?.anchorY
        ?? topFaceReferenceSprite?.frame?.sourceH
        ?? topFaceReferenceSprite?.frame?.h
        ?? ISO_SOURCE_TILE_WIDTH
      ) * ISO_BASE_SCALE;
      const tileTopCenterY = computeTileTopCenterYFromGroundAnchor(
        groundY,
        topFaceReferenceAnchorY,
        ISO_TILE_HALF_HEIGHT_PX,
      );
      const occupantAnchorY = computeOccupantAnchorYFromTileTop(tileTopCenterY, ISO_OCCUPANT_VISUAL_NUDGE_PX);

      if (canSkip) {
        this._applyIsoTileCameraPanOffset(tileC, baseCamX, baseCamY);
        this._appendIsoTileOverlayLabels(labelOverlayQueue, {
          depthKey,
          worldX,
          screenX,
          tileTopCenterY,
          occupantAnchorY,
          plant,
          occupantSprite,
          combinedOverlaySymbol,
          tileEntityTokens,
          showAnchorDebug,
        });
        continue;
      }

      tileC.position.set(0, 0);
      tileC.removeChildren();

      const occupantCopies = (plant && occupantSprite && patchCapacity > 1)
        ? resolvePatchLayout(patchCapacity, `iso:${worldX},${worldY}:${plant.id}`, {
          radiusPx: Math.max(12, ISO_TILE_HALF_WIDTH_PX * 0.32),
          minSpacingPx: Math.max(7, ISO_TILE_HALF_WIDTH_PX * 0.12),
        })
        : [{ x: 0, y: 0, depthY: 0 }];

      const mushroomBaseScale = ISO_BASE_SCALE * ISO_GROUND_FUNGUS_ZONE_REL_TO_OCCUPANT;
      // Match `applyAnchoredSprite`: use logical source size, not atlas rect `w`/`h` (often 4× larger).
      const mf = groundZoneFr?.frame;
      const mushLogicalW = Number(mf?.sourceW) || Number(mf?.w) || 32;
      const mushLogicalH = Number(mf?.sourceH) || Number(mf?.h) || 32;
      const mVis = Math.max(mushLogicalW, mushLogicalH) * mushroomBaseScale;
      const minMushroomSpacingPx = Math.max(14, 0.78 * mVis);
      const groundFungusCopies = (groundClusterN > 0 && groundZoneFr && zone?.speciesId)
        ? resolvePatchLayout(groundClusterN, `gfp:${worldX},${worldY}:${zone.speciesId},${groundYieldN}`, {
          radiusPx: Math.max(16, ISO_TILE_HALF_WIDTH_PX * 0.34, minMushroomSpacingPx * 0.85,
            minMushroomSpacingPx * Math.sqrt(groundClusterN) * 0.48),
          minSpacingPx: minMushroomSpacingPx,
        })
        : [{ x: 0, y: 0, depthY: 0 }];

      const rockSprite = tile.rockType ? getRockSpriteFrame(tile.rockType) : null;
      const iceSprite = tile.waterFrozen ? getTerrainSpriteFrame('ice') : null;
      const southTile = getTileAt(gameState, worldX, worldY + 1);
      const eastTile = getTileAt(gameState, worldX + 1, worldY);
      const southElevationOffsetPx = southTile ? elevationToIsoOffsetPx(southTile.elevation) : 0;
      const eastElevationOffsetPx = eastTile ? elevationToIsoOffsetPx(eastTile.elevation) : 0;
      const sideFillDepthPx = Math.max(
        0,
        elevationOffsetPx - southElevationOffsetPx,
        elevationOffsetPx - eastElevationOffsetPx,
      );
      const sideFillDepth = Math.min(32, Math.ceil(sideFillDepthPx / ISO_TILE_HALF_HEIGHT_PX));
      const needsDirtUnderlay = Boolean(!tile.waterType && (!southTile || southTile.waterType));

      const pushSprite = (spriteRef, scale, ax, ay, opts) => {
        if (!spriteRef) return;
        const s = new Sprite();
        tileC.addChild(s);
        texturePromises.push(
          getSubTextureForSprite(spriteRef).then((tex) => {
            // Do not use `_syncGeneration` here: a later `sync` may `canSkip` and bump the gen while
            // this texture is still in flight—then the sprite would never get a texture (invisible).
            if (!s.parent || s.parent !== tileC) {
              return;
            }
            applyAnchoredSprite(s, spriteRef, scale, ax, ay, tex, opts);
          }),
        );
      };

      if (needsDirtUnderlay && dirtSprite) {
        pushSprite(dirtSprite, ISO_BASE_SCALE, screenX, groundY + ISO_TILE_HALF_HEIGHT_PX);
      }
      if (!tile.waterType && dirtSprite) {
        for (let idx = 0; idx < sideFillDepth; idx += 1) {
          pushSprite(
            dirtSprite,
            ISO_BASE_SCALE,
            screenX,
            groundY + (ISO_TILE_HALF_HEIGHT_PX * (idx + 1)),
          );
        }
      }
      if (dirtSprite) {
        pushSprite(dirtSprite, ISO_BASE_SCALE, screenX, groundY);
      }
      if (grassSprite) {
        pushSprite(grassSprite, ISO_BASE_SCALE, screenX, groundY);
      }
      if (waterSprite) {
        const tint = tile.waterType && tile.waterDepth === 'deep' ? deepWaterTint() : 0xffffff;
        pushSprite(
          waterSprite,
          ISO_BASE_SCALE,
          screenX,
          groundY + ISO_WATER_VERTICAL_OFFSET_PX,
          { tint },
        );
      }
      if (iceSprite) {
        pushSprite(iceSprite, ISO_BASE_SCALE, screenX, groundY + ISO_WATER_VERTICAL_OFFSET_PX);
      }
      if (missingTerrainSprites) {
        const g = new Graphics();
        g.roundPixels = true;
        g.position.set(screenX, groundY);
        g.beginPath();
        g.moveTo(0, -ISO_TILE_HALF_HEIGHT_PX);
        g.lineTo(ISO_TILE_HALF_WIDTH_PX, 0);
        g.lineTo(0, ISO_TILE_HALF_HEIGHT_PX);
        g.lineTo(-ISO_TILE_HALF_WIDTH_PX, 0);
        g.closePath();
        g.fill({ color: tile.waterType ? 0x2d5f8d : 0x5f7846, alpha: 1 });
        tileC.addChild(g);
      }
      if (rockSprite) {
        pushSprite(rockSprite, ISO_BASE_SCALE, screenX, groundY - ISO_ROCK_STACK_OFFSET_PX);
      }
      if (groundClusterN > 0 && groundZoneFr) {
        groundFungusCopies.forEach((copy, gi) => {
          const jitter = deterministicMushroomScaleJitter(
            `gfs:sc:${worldX},${worldY},${gi},${zone.speciesId}`,
          );
          pushSprite(
            groundZoneFr,
            mushroomBaseScale * jitter,
            screenX + copy.x,
            occupantAnchorY + copy.y,
            null,
          );
        });
      }
      if (occupantSprite) {
        occupantCopies.forEach((copy) => {
          pushSprite(
            occupantSprite,
            plantOrLogScale * patchScale,
            screenX + copy.x,
            occupantAnchorY + copy.y,
            deadLogSprite ? { anchorYOffsetPx: ISO_TILE_HEIGHT_PX } : null,
          );
        });
      }

      if (campWorldSprite) {
        pushSprite(
          campWorldSprite,
          ISO_BASE_SCALE * ISO_CAMP_WORLD_SPRITE_SCALE_MULT,
          screenX,
          occupantAnchorY,
          { anchorYOffsetPx: ISO_CAMP_WORLD_SPRITE_NUDGE_UP_PX },
        );
      }

      const worldStack0 = Array.isArray(worldItems) && worldItems.length > 0 ? worldItems[0] : null;
      const worldItemId0 = typeof worldStack0?.itemId === 'string' ? worldStack0.itemId : '';
      const worldItemSpriteForTile = worldItemId0
        ? resolveInventoryItemSpriteFrame(worldItemId0)
        : null;
      if (worldItemSpriteForTile) {
        const s = new Sprite();
        s.__isoWorldGroundItem = true;
        s.__isoWorldItemId = worldItemId0;
        tileC.addChild(s);
        const wRef = worldItemSpriteForTile;
        const wScale = ISO_BASE_SCALE * ISO_WORLD_ITEM_SCALE_MULT;
        const wAy = groundY - ISO_WORLD_ITEM_FOOT_NUDGE_PX;
        texturePromises.push(
          getSubTextureForSprite(wRef).then((tex) => {
            if (!s.parent || s.parent !== tileC) {
              return;
            }
            applyAnchoredSprite(s, wRef, wScale, screenX, wAy, tex, null);
          }),
        );
      }

      this._appendIsoTileOverlayLabels(labelOverlayQueue, {
        depthKey,
        worldX,
        screenX,
        tileTopCenterY,
        occupantAnchorY,
        plant,
        occupantSprite,
        combinedOverlaySymbol,
        tileEntityTokens,
        showAnchorDebug,
      });
      tileC.__isoContentSig = contentSig;
      tileC.__isoBuildBaseCam = { x: baseCamX, y: baseCamY };
    }

    labelOverlayQueue.sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      return a.wx - b.wx;
    });
    for (const { node } of labelOverlayQueue) {
      this.tileLabelOverlayRoot.addChild(node);
    }

    // Reused tile containers keep stale sibling order; Pixi draws later children on top.
    // Always match painter order (same as `sortVisibleIsoTiles`: back → front).
    const paintOrder = [];
    for (const { worldX, worldY } of sorted) {
      const c = this.tileContainers.get(`${worldX},${worldY}`);
      if (c && c.parent === this.tilesRoot) {
        paintOrder.push(c);
      }
    }
    for (const c of paintOrder) {
      this.tilesRoot.removeChild(c);
    }
    for (const c of paintOrder) {
      this.tilesRoot.addChild(c);
    }

    await Promise.all(texturePromises);

    await this._playDropItemArrivalIfNew(gameState, baseCamX, baseCamY);

    this.selectionGraphics.clear();
    if (Number.isInteger(selectedTileX) && Number.isInteger(selectedTileY)) {
      const t = getTileAt(gameState, selectedTileX, selectedTileY);
      if (t) {
        const lx = selectedTileX - baseCamX;
        const ly = selectedTileY - baseCamY;
        const sx = Math.round((lx - ly) * ISO_TILE_HALF_WIDTH_PX + originX);
        const sy = Math.round((lx + ly) * ISO_TILE_HALF_HEIGHT_PX + originY);
        const elev = elevationToIsoOffsetPx(t.elevation);
        const gY = sy + ISO_TILE_HALF_HEIGHT_PX - elev;
        const grassSprite = !t.waterType ? getTerrainSpriteFrame('grass') : null;
        const dirtSprite = !t.waterType ? getTerrainSpriteFrame('dirt') : null;
        const waterSprite = t.waterType ? getTerrainSpriteFrame('water') : null;
        const topFaceReferenceSprite = grassSprite || dirtSprite || waterSprite || null;
        const topFaceReferenceAnchorY = (
          topFaceReferenceSprite?.frame?.anchorY
          ?? topFaceReferenceSprite?.frame?.sourceH
          ?? topFaceReferenceSprite?.frame?.h
          ?? ISO_SOURCE_TILE_WIDTH
        ) * ISO_BASE_SCALE;
        const tileTopCenterY = computeTileTopCenterYFromGroundAnchor(
          gY,
          topFaceReferenceAnchorY,
          ISO_TILE_HALF_HEIGHT_PX,
        );
        this.selectionGraphics.position.set(sx, tileTopCenterY);
        this.selectionGraphics.beginPath();
        this.selectionGraphics.moveTo(0, -ISO_TILE_HALF_HEIGHT_PX);
        this.selectionGraphics.lineTo(ISO_TILE_HALF_WIDTH_PX, 0);
        this.selectionGraphics.lineTo(0, ISO_TILE_HALF_HEIGHT_PX);
        this.selectionGraphics.lineTo(-ISO_TILE_HALF_WIDTH_PX, 0);
        this.selectionGraphics.closePath();
        this.selectionGraphics.fill({ color: 0x87e3a0, alpha: 0.28 });
      }
    }
  }

  /**
   * Highlights the tile that would receive a primary click (closest iso face).
   * @param {{ worldX: number, worldY: number } | null} target
   */
  drawHoverMoveTarget(gameState, cameraX, cameraY, target) {
    this.hoverMoveTargetGraphics.clear();
    if (!target || !Number.isInteger(target.worldX) || !Number.isInteger(target.worldY)) {
      return;
    }
    const t = getTileAt(gameState, target.worldX, target.worldY);
    if (!t) {
      return;
    }
    const baseCamX = Math.floor(Number(cameraX) + 1e-9);
    const baseCamY = Math.floor(Number(cameraY) + 1e-9);
    const { originX, originY } = this.lastOrigin;
    const lx = target.worldX - baseCamX;
    const ly = target.worldY - baseCamY;
    const sx = Math.round((lx - ly) * ISO_TILE_HALF_WIDTH_PX + originX);
    const sy = Math.round((lx + ly) * ISO_TILE_HALF_HEIGHT_PX + originY);
    const elev = elevationToIsoOffsetPx(t.elevation);
    const gY = sy + ISO_TILE_HALF_HEIGHT_PX - elev;
    const grassSprite = !t.waterType ? getTerrainSpriteFrame('grass') : null;
    const dirtSprite = !t.waterType ? getTerrainSpriteFrame('dirt') : null;
    const waterSprite = t.waterType ? getTerrainSpriteFrame('water') : null;
    const topFaceReferenceSprite = grassSprite || dirtSprite || waterSprite || null;
    const topFaceReferenceAnchorY = (
      topFaceReferenceSprite?.frame?.anchorY
      ?? topFaceReferenceSprite?.frame?.sourceH
      ?? topFaceReferenceSprite?.frame?.h
      ?? ISO_SOURCE_TILE_WIDTH
    ) * ISO_BASE_SCALE;
    const tileTopCenterY = computeTileTopCenterYFromGroundAnchor(
      gY,
      topFaceReferenceAnchorY,
      ISO_TILE_HALF_HEIGHT_PX,
    );
    const g = this.hoverMoveTargetGraphics;
    g.position.set(sx, tileTopCenterY);
    g.beginPath();
    g.moveTo(0, -ISO_TILE_HALF_HEIGHT_PX);
    g.lineTo(ISO_TILE_HALF_WIDTH_PX, 0);
    g.lineTo(0, ISO_TILE_HALF_HEIGHT_PX);
    g.lineTo(-ISO_TILE_HALF_WIDTH_PX, 0);
    g.closePath();
    g.fill({ color: 0xffc878, alpha: 0.16 });
    g.stroke({ width: 2.5, color: 0xf0d595, alpha: 0.92 });
  }

  destroy() {
    this._syncGeneration += 1;
    this._stopDropArrivalAnim();
    this.tileContainers.clear();
    this._playerLastSim = null;
    this._playerTween = null;
    this.worldPanLayer.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}
