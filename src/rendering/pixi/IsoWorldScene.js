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

function isoPlantScale(plant) {
  if (!plant) {
    return ISO_BASE_SCALE;
  }
  const species = PLANT_BY_ID[plant.speciesId] || null;
  const stage = species?.lifeStages?.find((entry) => entry.stage === plant.stageName) || null;
  const size = Number(stage?.size || 0);
  return size >= 8 ? ISO_BASE_SCALE : (ISO_BASE_SCALE * 0.5);
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
    this.worldPanLayer.addChild(this.selectionGraphics);
    this.worldPanLayer.addChild(this.hoverMoveTargetGraphics);
    this.root.addChild(this.worldPanLayer);
    this.tileContainers = new Map();
    this.lastSorted = [];
    this.lastOrigin = { originX: 0, originY: 0 };
    /** Bumps each sync so late texture loads do not touch destroyed sprites. */
    this._syncGeneration = 0;
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
    /** Integer tile coords; avoids full `player` object in deps and matches sync to float anchor. */
    playerWorldX,
    playerWorldY,
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

    for (const { worldX, worldY, tile } of sorted) {
      const key = `${worldX},${worldY}`;
      let tileC = this.tileContainers.get(key);
      if (!tileC) {
        tileC = new Container();
        this.tileContainers.set(key, tileC);
        this.tilesRoot.addChild(tileC);
      }
      tileC.removeChildren();

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
      const occupantCopies = (plant && occupantSprite && patchCapacity > 1)
        ? resolvePatchLayout(patchCapacity, `iso:${worldX},${worldY}:${plant.id}`, {
          radiusPx: Math.max(8, ISO_TILE_HALF_WIDTH_PX * 0.24),
          minSpacingPx: Math.max(5, ISO_TILE_HALF_WIDTH_PX * 0.1),
          jitterPx: 2,
        })
        : [{ x: 0, y: 0, depthY: 0 }];
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
      const isPlayerTile = Number(playerWorldX) === worldX && Number(playerWorldY) === worldY;
      const isCampTile = Number(gameState?.camp?.anchorX) === worldX && Number(gameState?.camp?.anchorY) === worldY;
      const stationAtTile = getStationIdAtTile(gameState?.camp, worldX, worldY);
      const tileEntityTokens = buildTileEntityTokens(tile, {
        isPlayerTile,
        isCampTile,
        stationAtTile,
        worldItems,
        camp: gameState?.camp,
      });

      const rockSprite = tile.rockType ? getRockSpriteFrame(tile.rockType) : null;
      const grassSprite = !tile.waterType ? getTerrainSpriteFrame('grass') : null;
      const dirtSprite = !tile.waterType ? getTerrainSpriteFrame('dirt') : null;
      const waterSprite = tile.waterType ? getTerrainSpriteFrame('water') : null;
      const iceSprite = tile.waterFrozen ? getTerrainSpriteFrame('ice') : null;
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
    this.worldPanLayer.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}
