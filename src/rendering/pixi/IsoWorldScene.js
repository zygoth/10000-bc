import {
  Container, Graphics, Sprite, Text,
} from 'pixi.js';
import { getTileAt } from '../../game/simCore.mjs';
import {
  getDeadLogSpriteFrame,
  getPlantSpriteFrame,
  getRockSpriteFrame,
  getTerrainSpriteFrame,
} from '../../game/plantSpriteCatalog.mjs';
import { PLANT_BY_ID } from '../../game/plantCatalog.mjs';
import {
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
import {
  computeOccupantAnchorYFromTileTop,
  computeTileTopCenterYFromGroundAnchor,
} from '../../ui/isoProjection.js';
import {
  ISO_BASE_SCALE,
  ISO_OCCUPANT_VISUAL_NUDGE_PX,
  ISO_ROCK_STACK_OFFSET_PX,
  ISO_SOURCE_TILE_WIDTH,
  ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX,
  ISO_TILE_HALF_HEIGHT_PX,
  ISO_TILE_HALF_WIDTH_PX,
  ISO_TILE_HEIGHT_PX,
  ISO_WATER_VERTICAL_OFFSET_PX,
  elevationToIsoOffsetPx,
} from './isoConstants.js';
import { computeVisibleIsoTiles, sortVisibleIsoTiles } from './isoMath.js';
import { computeWorldPanLayerPixels } from './isoCameraRoll.js';
import { getSubTextureForSprite } from './textureCache.js';

/** Tile-to-tile player label motion (ms). */
const PLAYER_MOVE_TWEEN_MS = 280;

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
  const zoneSig = zone
    ? `${zone.speciesId || ''}:${Number(zone.yieldCurrentGrams) || 0}`
    : '';

  const worldItems = Array.isArray(gameState.worldItemsByTile?.[`${worldX},${worldY}`])
    ? gameState.worldItemsByTile[`${worldX},${worldY}`]
    : [];
  const isCampTile = Number(gameState?.camp?.anchorX) === worldX && Number(gameState?.camp?.anchorY) === worldY;
  const stationAtTile = getStationIdAtTile(gameState?.camp, worldX, worldY);
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
    tile.beehive ? 'b' : '',
    tile.squirrelCache && Number(tile.squirrelCache.nutContentGrams) > 0 ? `c:${Math.floor(Number(tile.squirrelCache.nutContentGrams) || 0)}` : '',
    tile.simpleSnare?.active ? 's' : '',
    tile.deadfallTrap?.active ? 'd' : '',
    tile.fishTrap?.active ? 'f' : '',
    tile.autoRod?.active ? 'a' : '',
    tile.sapTap?.active ? 'p' : '',
    tile.leachingBasket?.active ? 'l' : '',
    isCampTile ? `camp:${drying}` : '',
    stationAtTile || '',
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
    const syncGen = this._syncGeneration;

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

      const depthKey = worldY + worldX;
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
      const zoneSymbol = zone && Number(zone.yieldCurrentGrams) > 0
        ? zone.speciesId[0].toUpperCase()
        : '';
      const logMushroomSymbol = tile.deadLog
        ? ((tile.deadLog.fungi || [])
          .find((entry) => Number(entry?.yield_current_grams) > 0)
          ?.species_id?.[0]?.toUpperCase() || '')
        : '';
      const mushroomOverlaySymbol = logMushroomSymbol || (!plant && zoneSymbol ? zoneSymbol : '');
      const featureOverlaySymbol = tile.beehive
        ? 'B'
        : (tile.squirrelCache && Number(tile.squirrelCache.nutContentGrams) > 0 ? 'C' : '');
      const combinedOverlaySymbol = [mushroomOverlaySymbol, featureOverlaySymbol].filter(Boolean).join('');

      const worldItems = Array.isArray(gameState.worldItemsByTile?.[`${worldX},${worldY}`])
        ? gameState.worldItemsByTile[`${worldX},${worldY}`]
        : [];
      const isCampTile = Number(gameState?.camp?.anchorX) === worldX && Number(gameState?.camp?.anchorY) === worldY;
      const stationAtTile = getStationIdAtTile(gameState?.camp, worldX, worldY);
      const tileEntityTokens = buildTileEntityTokens(tile, {
        isPlayerTile: false,
        isCampTile,
        stationAtTile,
        worldItems,
        camp: gameState?.camp,
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
            if (syncGen !== this._syncGeneration) {
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
    this.tileContainers.clear();
    this._playerLastSim = null;
    this._playerTween = null;
    this.worldPanLayer.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}
