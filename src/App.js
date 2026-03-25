import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  advanceTick,
  advanceDay,
  canGenerateAnimalZones,
  canGenerateBeehives,
  canGenerateFishPopulations,
  canGenerateMushroomZones,
  canGenerateSquirrelCaches,
  createInitialGameState,
  deserializeGameState,
  generateAnimalZones,
  generateBeehives,
  generateFishPopulations,
  generateGroundFungusZones,
  generateSquirrelCaches,
  getAnimalDensityAtTile,
  getFishDensityAtTile,
  getActionTickCost,
  getGroundFungusById,
  getMetrics,
  getTileAt,
  serializeGameState,
  validateAction,
} from './game/simCore.mjs';
import {
  getDeadLogSpriteFrame,
  getPlantSpriteFrame,
  getRockSpriteFrame,
  getTerrainSpriteFrame,
} from './game/plantSpriteCatalog.mjs';
import { parsePlantPartItemId } from './game/plantPartDescriptors.mjs';
import { ANIMAL_CATALOG } from './game/animalCatalog.mjs';
import { ITEM_BY_ID } from './game/itemCatalog.mjs';
import { getSeason, PLANT_CATALOG, PLANT_BY_ID } from './game/plantCatalog.mjs';
import GameModeChrome from './ui/GameModeChrome.jsx';
import {
  computeOccupantAnchorYFromTileTop,
  computeTileTopCenterYFromGroundAnchor,
} from './ui/isoProjection.js';

const OBSERVER_VIEWPORT_WIDTH = 15;
const OBSERVER_VIEWPORT_HEIGHT = 10;
const BEEHIVE_UNLOCK_DAYS = 400;
const SQUIRREL_CACHE_UNLOCK_DAYS = 400;
const ANIMAL_ZONE_UNLOCK_DAYS = 400;
const FISH_POPULATION_UNLOCK_DAYS = 0;
const ISO_GLOBAL_RENDER_SCALE = 1;
const ISO_BASE_TILE_WIDTH_PX = 128;
const ISO_BASE_TILE_HEIGHT_PX = 64;
const ISO_TILE_WIDTH_PX = ISO_BASE_TILE_WIDTH_PX * ISO_GLOBAL_RENDER_SCALE;
const ISO_TILE_HEIGHT_PX = ISO_BASE_TILE_HEIGHT_PX * ISO_GLOBAL_RENDER_SCALE;
const ISO_TILE_HALF_WIDTH_PX = ISO_TILE_WIDTH_PX / 2;
const ISO_TILE_HALF_HEIGHT_PX = ISO_TILE_HEIGHT_PX / 2;
const ISO_SOURCE_TILE_WIDTH = 64;
const ISO_BASE_SCALE = ISO_TILE_WIDTH_PX / ISO_SOURCE_TILE_WIDTH;
const ISO_HALF_CUBE_FRAME_HEIGHT = 52;
const ISO_FULL_CUBE_FRAME_HEIGHT = 64;
const ISO_WATER_VERTICAL_OFFSET_PX = (ISO_FULL_CUBE_FRAME_HEIGHT - ISO_HALF_CUBE_FRAME_HEIGHT) * ISO_BASE_SCALE;
const ISO_ROCK_STACK_OFFSET_PX = ISO_TILE_HALF_HEIGHT_PX;
const ISO_OCCUPANT_VISUAL_NUDGE_PX = -4;
/** Push iso origin down so the followed tile reads nearer true vertical center under the top HUD. */
const ISO_PLAY_TOP_HUD_CENTER_BIAS_PX = 80;
/** Extra vertical shift (in full isometric tile heights) requested for framing the player. */
const ISO_PLAY_VERTICAL_NUDGE_EXTRA_TILE_HEIGHTS = 1;
/** Nudge overlay labels ([player], C, fungus letters); reduced from half-face after UX feedback. */
const ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX = (ISO_HALF_CUBE_FRAME_HEIGHT * ISO_BASE_SCALE) * 0.38;
const ISO_ELEVATION_LEVELS = 6;
const ISO_MAX_ELEVATION_OFFSET_PX = ISO_ELEVATION_LEVELS * ISO_TILE_HALF_HEIGHT_PX;
const TICKS_PER_DAY = 400;
const NIGHT_TICK_THRESHOLD = Math.floor(TICKS_PER_DAY / 2);

const FISH_SPECIES = ANIMAL_CATALOG.filter((animal) => animal.animalClass === 'fish');
const LAND_ANIMAL_SPECIES = ANIMAL_CATALOG.filter((animal) => animal.animalClass !== 'fish');

const RENDERER_LAYOUT = {
  observer: {
    tilePx: 36,
    tileGapPx: 2,
    spriteScaleMode: 'fit',
    showTileMeta: true,
  },
  game: {
    tilePx: 64,
    tileGapPx: 4,
    spriteScaleMode: 'native',
    showTileMeta: false,
  },
};

const OVERLAY_OPTIONS = [
  { value: 'heightmap', label: 'Heightmap (elevation)' },
  { value: 'moisture', label: 'Moisture' },
  { value: 'ph', label: 'Soil pH' },
  { value: 'fertility', label: 'Fertility' },
  { value: 'shade', label: 'Shade' },
  { value: 'avgSoilMatch', label: 'Avg Soil Match' },
  { value: 'maxSoilMatch', label: 'Best Species Match' },
  { value: 'drainage', label: 'Drainage (categorical)' },
  { value: 'recentDispersal', label: 'Recent Dispersal (by method)' },
  { value: 'speciesSupport', label: 'Species Support (strict)' },
  { value: 'animalDensity', label: 'Animal Density (by species)' },
  { value: 'fishDensity', label: 'Fish Density (by species)' },
  { value: 'mushroomZones', label: 'Mushroom Zones' },
  { value: 'beehives', label: 'Beehives' },
  { value: 'squirrelCaches', label: 'Squirrel Caches' },
];

const DRAINAGE_ORDER = ['poor', 'moderate', 'well', 'excellent'];
const PARTNER_VITAL_KEYS = [
  { key: 'hunger', label: 'Hunger' },
  { key: 'thirst', label: 'Thirst' },
  { key: 'health', label: 'Health' },
];
const NATURE_SIGHT_OVERLAY_OPTIONS = [
  'calorie_heatmap',
  'animal_density',
  'mushroom_zones',
  'plant_compatibility',
  'fishing_hotspots',
];
const CAMP_STATION_OPTIONS = [
  'raised_sleeping_platform',
  'windbreak_reflector_wall',
  'drying_rack',
  'workbench',
  'thread_spinner',
];
const EQUIPMENT_SLOTS = ['gloves', 'coat', 'head'];

function tileKey(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }
  return `${x},${y}`;
}

function inferTileContextActions(tile) {
  if (!tile) {
    return ['inspect', 'move'];
  }

  const actions = ['inspect', 'move', 'item_drop', 'item_pickup'];
  if (tile.plantIds?.length > 0 || tile.rockType || tile.squirrelCache) {
    actions.push('harvest');
  }
  if (tile.plantIds?.length > 0) {
    actions.push('fell_tree');
  }
  if (tile.waterType) {
    actions.push('waterskin_fill', 'fish_rod_cast', 'trap_place_fish_weir');
  } else {
    actions.push(
      'dig',
      'hoe',
      'trap_place_snare',
      'trap_place_deadfall',
      'auto_rod_place',
      'tap_insert_spout',
      'tap_remove_spout',
      'tap_place_vessel',
      'tap_retrieve_vessel',
      'leaching_basket_place',
      'leaching_basket_retrieve',
    );
  }
  return actions;
}

function buildDefaultPayload(kind, context) {
  const selectedX = Number.isInteger(context?.selectedX) ? context.selectedX : null;
  const selectedY = Number.isInteger(context?.selectedY) ? context.selectedY : null;
  const tile = context?.tile || null;
  const player = context?.player || {};
  const px = Number.isInteger(player?.x) ? player.x : selectedX;
  const py = Number.isInteger(player?.y) ? player.y : selectedY;
  const dx = Number.isInteger(selectedX) && Number.isInteger(px)
    ? Math.max(-1, Math.min(1, selectedX - px))
    : 0;
  const dy = Number.isInteger(selectedY) && Number.isInteger(py)
    ? Math.max(-1, Math.min(1, selectedY - py))
    : 0;
  const selectedInventoryItemId = context?.selectedInventoryItemId || '';
  const selectedStockpileItemId = context?.selectedStockpileItemId || '';
  const selectedWorldItemId = context?.selectedWorldItemId || '';
  const selectedConditionId = context?.selectedConditionInstanceId || '';
  const selectedVisionItemId = context?.selectedVisionItemId || '';
  const selectedVisionCategory = context?.selectedVisionCategory || '';
  const selectedOverlay = context?.selectedNatureOverlay || NATURE_SIGHT_OVERLAY_OPTIONS[0];
  const selectedInventoryQuantity = Number.isInteger(context?.selectedInventoryQuantity)
    ? Math.max(1, context.selectedInventoryQuantity)
    : 1;
  const selectedStockpileQuantity = Number.isInteger(context?.selectedStockpileQuantity)
    ? Math.max(1, context.selectedStockpileQuantity)
    : 1;
  const selectedWorldItemQuantity = Number.isInteger(context?.selectedWorldItemQuantity)
    ? Math.max(1, context.selectedWorldItemQuantity)
    : 1;

  const sharedTilePayload = Number.isInteger(selectedX) && Number.isInteger(selectedY)
    ? { x: selectedX, y: selectedY }
    : {};

  switch (kind) {
    case 'move':
      return { dx, dy };
    case 'inspect':
    case 'dig':
    case 'hoe':
    case 'trap_place_snare':
    case 'trap_place_deadfall':
    case 'trap_place_fish_weir':
    case 'auto_rod_place':
    case 'trap_check':
    case 'tap_insert_spout':
    case 'tap_remove_spout':
    case 'tap_place_vessel':
    case 'tap_retrieve_vessel':
    case 'leaching_basket_retrieve':
      return sharedTilePayload;
    case 'harvest':
      if (tile?.plantIds?.length > 0) {
        return {
          plantId: tile.plantIds[0],
          partName: 'fruit',
          subStageId: 'ripe',
          actions: 1,
          ...sharedTilePayload,
        };
      }
      return sharedTilePayload;
    case 'fell_tree':
      return tile?.plantIds?.length > 0
        ? { plantId: tile.plantIds[0], ...sharedTilePayload }
        : sharedTilePayload;
    case 'fish_rod_cast':
      return {};
    case 'waterskin_fill':
    case 'waterskin_drink':
      return {};
    case 'leaching_basket_place':
      return {
        ...sharedTilePayload,
        itemId: selectedInventoryItemId,
        quantity: 1,
      };
    case 'item_pickup':
      return {
        ...sharedTilePayload,
        itemId: selectedWorldItemId,
        quantity: selectedWorldItemQuantity,
      };
    case 'item_drop':
    case 'camp_stockpile_add':
    case 'camp_drying_rack_add_inventory':
      return {
        itemId: selectedInventoryItemId,
        quantity: selectedInventoryQuantity,
        ...sharedTilePayload,
      };
    case 'eat':
      return {
        itemId: selectedInventoryItemId,
        quantity: 1,
        ...sharedTilePayload,
      };
    case 'process_item':
      return {
        itemId: selectedInventoryItemId,
        quantity: 1,
        processId: '',
      };
    case 'camp_stockpile_remove':
    case 'camp_drying_rack_add':
      return {
        itemId: selectedStockpileItemId,
        quantity: selectedStockpileQuantity,
      };
    case 'camp_drying_rack_remove':
      return {
        slotIndex: 0,
        quantity: 1,
      };
    case 'meal_plan_set':
      return {
        ingredients: selectedStockpileItemId ? [{ itemId: selectedStockpileItemId, quantity: 1 }] : [],
      };
    case 'meal_plan_commit':
      return {};
    case 'camp_station_build':
      return {
        stationId: CAMP_STATION_OPTIONS[0],
      };
    case 'tool_craft':
      return {
        outputItemId: '',
        outputQuantity: 1,
        materialPlan: [],
      };
    case 'equip_item':
      return {
        itemId: selectedInventoryItemId,
      };
    case 'unequip_item':
      return {
        equipmentSlot: 'gloves',
      };
    case 'partner_task_set':
      return {
        task: {
          taskId: `ui-task-${Date.now()}`,
          kind: 'spin_cordage',
          ticksRequired: 2,
          outputs: [{ itemId: 'cordage', quantity: 1 }],
        },
        queuePolicy: 'append',
      };
    case 'debrief_enter':
    case 'debrief_exit':
    case 'partner_vision_request':
      return {};
    case 'partner_medicine_administer':
      return selectedConditionId ? { conditionInstanceId: selectedConditionId } : {};
    case 'partner_vision_confirm':
      return selectedVisionItemId ? { itemId: selectedVisionItemId } : {};
    case 'partner_vision_choose':
      return selectedVisionCategory ? { category: selectedVisionCategory } : {};
    case 'nature_sight_overlay_set':
      return { overlay: selectedOverlay };
    default:
      return {};
  }
}

function drainageToIndex(drainage) {
  const idx = DRAINAGE_ORDER.indexOf(drainage);
  if (idx === -1) {
    return 0.5;
  }
  return idx / (DRAINAGE_ORDER.length - 1);
}

function normalizeVitalValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}

function vitalSeverityClass(value) {
  if (value <= 0.15) {
    return 'critical';
  }
  if (value <= 0.35) {
    return 'low';
  }
  if (value <= 0.6) {
    return 'warning';
  }
  return 'good';
}

function buildTileEntityTokens(tile, context = {}) {
  const tokens = [];
  const {
    isPlayerTile = false,
    isCampTile = false,
    worldItems = [],
    camp = null,
  } = context;

  if (isPlayerTile) {
    tokens.push('[player]');
  }
  if (isCampTile) {
    tokens.push('[camp]');
    if (camp?.dryingRackUnlocked) {
      tokens.push('[drying rack]');
    }
    if (Array.isArray(camp?.stationsUnlocked) && camp.stationsUnlocked.length > 0) {
      tokens.push('[camp station]');
    }
  }

  if (tile?.simpleSnare?.active) {
    tokens.push('[snare]');
  }
  if (tile?.deadfallTrap?.active) {
    tokens.push('[deadfall]');
  }
  if (tile?.fishTrap?.active) {
    tokens.push('[fish trap]');
  }
  if (tile?.autoRod?.active) {
    tokens.push('[auto rod]');
  }
  if (tile?.sapTap?.active) {
    tokens.push('[sap tap]');
  }
  if (tile?.leachingBasket?.active) {
    tokens.push('[leaching basket]');
  }
  const worldItemToken = buildWorldItemToken(worldItems);
  if (worldItemToken) {
    tokens.push(worldItemToken);
  }

  return tokens;
}

function buildWorldItemToken(worldItems) {
  if (!Array.isArray(worldItems) || worldItems.length === 0) {
    return '';
  }
  const uniqueItemIds = Array.from(new Set(
    worldItems
      .map((entry) => (typeof entry?.itemId === 'string' ? entry.itemId : ''))
      .filter(Boolean),
  ));
  if (uniqueItemIds.length === 0) {
    return '';
  }
  if (uniqueItemIds.length > 1) {
    return '[items]';
  }
  return `[${formatItemTokenLabel(uniqueItemIds[0])}]`;
}

function formatItemTokenLabel(itemId) {
  const item = ITEM_BY_ID[itemId];
  if (item?.name) {
    return item.name.toLowerCase();
  }
  if (typeof itemId !== 'string' || !itemId) {
    return 'item';
  }
  const segments = itemId.split(':');
  if (segments.length === 3) {
    const [speciesId, partName] = segments;
    const species = PLANT_BY_ID[speciesId] || null;
    const speciesLabel = species?.name ? species.name.toLowerCase() : formatTokenLabel(speciesId || 'plant').toLowerCase();
    return `${speciesLabel} ${formatTokenLabel(partName || 'part').toLowerCase()}`;
  }
  if (segments.length === 2) {
    return `${formatTokenLabel(segments[1]).toLowerCase()}`;
  }
  return formatTokenLabel(itemId).toLowerCase() || 'item';
}

function titleCase(value) {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTokenLabel(value) {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isSpeciesIdentifiedInState(state, speciesId) {
  if (!state || typeof speciesId !== 'string' || !speciesId) {
    return false;
  }
  const collections = [
    state?.identifiedPlantSpeciesIds,
    state?.camp?.identifiedPlantSpeciesIds,
    state?.camp?.identifiedSpeciesIds,
    state?.camp?.research?.identifiedSpeciesIds,
  ];
  return collections.some((collection) => Array.isArray(collection) && collection.includes(speciesId));
}

function tileSupportsSpeciesStrict(tile, species) {
  if (!tile || !species || tile.waterType) {
    return false;
  }

  const [minPh, maxPh] = species.soil.ph_range;
  if (tile.ph < minPh || tile.ph > maxPh) {
    return false;
  }

  const [drainMin, drainMax] = species.soil.drainage?.tolerance_range || [0, 1];
  const drainIdx = drainageToIndex(tile.drainage);
  if (drainIdx < drainMin || drainIdx > drainMax) {
    return false;
  }

  const [fertilityMin, fertilityMax] = species.soil.fertility?.tolerance_range || [0, 1];
  if (tile.fertility < fertilityMin || tile.fertility > fertilityMax) {
    return false;
  }

  const [moistureMin, moistureMax] = species.soil.moisture?.tolerance_range || [0, 1];
  if (tile.moisture < moistureMin || tile.moisture > moistureMax) {
    return false;
  }

  const [shadeMin, shadeMax] = species.soil.shade?.tolerance_range || [0, 1];
  const effectiveShade = Number.isFinite(tile.effectiveShadeForOccupant)
    ? tile.effectiveShadeForOccupant
    : tile.shade;
  if (effectiveShade < shadeMin || effectiveShade > shadeMax) {
    return false;
  }

  return true;
}

function blendColor(startRgb, endRgb, value) {
  const t = Math.max(0, Math.min(1, value));
  const r = Math.round(startRgb[0] + (endRgb[0] - startRgb[0]) * t);
  const g = Math.round(startRgb[1] + (endRgb[1] - startRgb[1]) * t);
  const b = Math.round(startRgb[2] + (endRgb[2] - startRgb[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function moistureColor(moisture) {
  return blendColor([200, 169, 110], [45, 74, 30], moisture);
}

function phColor(ph) {
  const normalized = (ph - 5.2) / 2.8;
  return blendColor([173, 86, 45], [80, 123, 196], normalized);
}

function fertilityColor(fertility) {
  return blendColor([135, 91, 45], [59, 138, 44], fertility);
}

function shadeColor(shade) {
  return blendColor([238, 230, 178], [45, 64, 45], shade);
}

function scoreColor(score) {
  return blendColor([166, 74, 74], [52, 132, 75], score);
}

function animalDensityColor(density) {
  return blendColor([88, 74, 58], [82, 168, 92], density);
}

function fishDensityColor(density) {
  return blendColor([39, 67, 96], [78, 200, 223], density);
}

function beehiveColor(hasBeehive) {
  return hasBeehive ? '#d9a53b' : '#4a4338';
}

function squirrelCacheColor(hasCache) {
  return hasCache ? '#a06f3f' : '#4a4338';
}

function heightColor(elevation) {
  return blendColor([30, 37, 58], [222, 224, 218], Number(elevation) || 0);
}

function drainageColor(drainage) {
  return {
    poor: '#456b8f',
    moderate: '#5d8f6f',
    well: '#9e9256',
    excellent: '#b36c4b',
  }[drainage] || '#7b7b7b';
}

function dispersalActivityColor(recentTileEvent) {
  if (!recentTileEvent || recentTileEvent.total <= 0) {
    return '#3e3b35';
  }

  const methodCounts = recentTileEvent.methods || {};
  const dominantMethod = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const baseByMethod = {
    wind: '#8dcf7a',
    gravity: '#c8a06b',
    water: '#4f9dd6',
    animal_cached: '#ba7fe8',
    animal_eaten: '#e28a65',
    explosive: '#e85f5f',
    runner: '#67c08f',
  };

  const base = baseByMethod[dominantMethod] || '#d6d067';
  const intensity = Math.min(1, recentTileEvent.total / 8);
  return blendColor([58, 53, 46], [
    Number.parseInt(base.slice(1, 3), 16),
    Number.parseInt(base.slice(3, 5), 16),
    Number.parseInt(base.slice(5, 7), 16),
  ], intensity);
}

function overlayColor(
  mode,
  tile,
  recentTileEvent = null,
  speciesSupport = null,
  animalDensity = null,
  fishDensity = null,
) {
  if (mode === 'heightmap') {
    return heightColor(tile.elevation);
  }

  if (mode === 'recentDispersal') {
    return dispersalActivityColor(recentTileEvent);
  }

  if (mode === 'speciesSupport') {
    if (tile.waterType) {
      return tile.waterDepth === 'deep' ? '#245282' : '#3e7eb8';
    }
    return speciesSupport ? '#5ea86c' : '#7d4343';
  }

  if (mode === 'mushroomZones') {
    const zone = tile.groundFungusZone;
    if (!zone) {
      if (tile.waterType) {
        return tile.waterDepth === 'deep' ? '#245282' : '#3e7eb8';
      }
      return '#4a4338';
    }

    const id = zone.speciesId || '';
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }

    const hue = Math.abs(hash) % 360;
    const fruiting = Number(zone.yieldCurrentGrams) > 0;
    const lightness = fruiting ? 58 : 42;
    const saturation = fruiting ? 62 : 38;
    return `hsl(${hue}deg ${saturation}% ${lightness}%)`;
  }

  if (mode === 'animalDensity') {
    if (tile.waterType) {
      return tile.waterDepth === 'deep' ? '#245282' : '#3e7eb8';
    }
    return animalDensityColor(Number(animalDensity) || 0);
  }

  if (mode === 'fishDensity') {
    if (!tile.waterType) {
      return '#4a4338';
    }
    return fishDensityColor(Number(fishDensity) || 0);
  }

  if (mode === 'beehives') {
    if (tile.waterType) {
      return tile.waterDepth === 'deep' ? '#245282' : '#3e7eb8';
    }
    return beehiveColor(Boolean(tile.beehive));
  }

  if (mode === 'squirrelCaches') {
    if (tile.waterType) {
      return tile.waterDepth === 'deep' ? '#245282' : '#3e7eb8';
    }
    return squirrelCacheColor(Boolean(tile.squirrelCache));
  }

  if (mode === 'moisture' && tile.rockType) {
    return '#6a6458';
  }

  if (tile.waterType) {
    return tile.waterDepth === 'deep' ? '#245282' : '#3e7eb8';
  }

  switch (mode) {
    case 'ph':
      return phColor(tile.ph);
    case 'fertility':
      return fertilityColor(tile.fertility ?? 0);
    case 'shade':
      return shadeColor(tile.shade);
    case 'avgSoilMatch':
      return scoreColor(tile.avgSoilMatch ?? 0);
    case 'maxSoilMatch':
      return scoreColor(tile.maxSoilMatch ?? 0);
    case 'drainage':
      return drainageColor(tile.drainage);
    case 'moisture':
    default:
      return moistureColor(tile.moisture);
  }
}

function tileTooltip(
  x,
  y,
  tile,
  plant = null,
  recentTileEvent = null,
  selectedSpeciesId = null,
  speciesSupport = null,
  linkedPlantExists = null,
  selectedAnimalId = null,
  selectedAnimalDensity = null,
  selectedFishId = null,
  selectedFishDensity = null,
) {
  const occupancy = linkedPlantExists === null
    ? (tile.plantIds.length > 0 ? 'occupied' : 'empty')
    : (linkedPlantExists ? 'occupied' : 'empty');
  const parts = [
    `${x},${y}`,
    `elevation=${(tile.elevation ?? 0).toFixed(3)}`,
    `drainage=${tile.drainage}`,
    `tile=${occupancy}`,
    `ph=${tile.ph.toFixed(2)}`,
    `moisture=${tile.moisture.toFixed(2)}`,
    `fertility=${(tile.fertility ?? 0).toFixed(2)}`,
    `shade=${tile.shade.toFixed(2)}`,
    `avgMatch=${(tile.avgSoilMatch ?? 0).toFixed(2)}`,
    `bestMatch=${(tile.maxSoilMatch ?? 0).toFixed(2)}`,
  ];

  if (tile.waterType) {
    parts.push(`water=${tile.waterType}`);
  }

  if (tile.rockType) {
    parts.push(`rock=${tile.rockType}`);
  }

  if (plant) {
    parts.push(`plant=${plant.speciesId}`);
    parts.push(`stage=${plant.stageName}`);
    parts.push(`age=${plant.age}`);
    parts.push(`vitality=${Number.isFinite(plant.vitality) ? plant.vitality.toFixed(3) : 'n/a'}`);
    if (plant.source) {
      parts.push(`source=${plant.source}`);
    }
  } else if (tile.deadLog) {
    parts.push(`dead_log=${tile.deadLog.sourceSpeciesId || 'unknown'}`);
    parts.push(`log_size=${tile.deadLog.sizeAtDeath || 'n/a'}`);
    parts.push(`decay_stage=${tile.deadLog.decayStage || 'n/a'}`);

    const activeLogFungus = (tile.deadLog.fungi || [])
      .find((entry) => Number(entry?.yield_current_grams) > 0);
    if (activeLogFungus) {
      parts.push(`log_fungus=${activeLogFungus.species_id}`);
      parts.push(`log_fungus_yield_g=${Number(activeLogFungus.yield_current_grams).toFixed(0)}`);
    }
  }

  if (tile.groundFungusZone) {
    const fungus = getGroundFungusById(tile.groundFungusZone.speciesId);
    const yieldGrams = Number(tile.groundFungusZone.yieldCurrentGrams || 0);
    parts.push(`ground_fungus_zone=${fungus?.commonName || tile.groundFungusZone.speciesId}`);
    parts.push(`ground_fungus_zone_id=${tile.groundFungusZone.zoneId}`);
    parts.push(`ground_fungus_fruiting=${yieldGrams > 0 ? 'yes' : 'no'}`);
    parts.push(`fungus_yield_g=${yieldGrams.toFixed(0)}`);
  }

  if (tile.beehive) {
    parts.push(`beehive=${tile.beehive.speciesId || 'unknown'}`);
    parts.push(`beehive_active=${tile.beehive.active === true ? 'yes' : 'no'}`);
    parts.push(`honey_g=${Number(tile.beehive.yieldCurrentHoneyGrams || 0).toFixed(0)}`);
    parts.push(`larvae_g=${Number(tile.beehive.yieldCurrentLarvaeGrams || 0).toFixed(0)}`);
    parts.push(`beeswax_g=${Number(tile.beehive.yieldCurrentBeeswaxGrams || 0).toFixed(0)}`);
  }

  if (tile.squirrelCache) {
    parts.push(`squirrel_cache=${tile.squirrelCache.placementType || 'ground'}`);
    parts.push(`cache_item_species=${tile.squirrelCache.cachedSpeciesId || 'unknown'}`);
    parts.push(`cache_item_part=${tile.squirrelCache.cachedPartName || 'unknown'}`);
    parts.push(`cache_item_sub_stage=${tile.squirrelCache.cachedSubStageId || 'unknown'}`);
    parts.push(`cache_nut_g=${Number(tile.squirrelCache.nutContentGrams || 0).toFixed(0)}`);
  }

  if (recentTileEvent && recentTileEvent.total > 0) {
    const methodSummary = Object.entries(recentTileEvent.methods)
      .sort((a, b) => b[1] - a[1])
      .map(([method, count]) => `${method}:${count}`)
      .join(',');
    parts.push(`dispersedToday=${recentTileEvent.total}`);
    parts.push(`methods=${methodSummary}`);
  }

  if (selectedSpeciesId) {
    const selectedSpecies = PLANT_BY_ID[selectedSpeciesId] || null;
    if (selectedSpecies?.dispersal?.requires_disturbance) {
      parts.push(`disturbed=${tile.disturbed === true ? 'yes' : 'no'}`);
    }
    parts.push(`supports_${selectedSpeciesId}=${speciesSupport ? 'yes' : 'no'}`);
  }

  if (selectedAnimalId) {
    parts.push(`animal_species=${selectedAnimalId}`);
    parts.push(`animal_density=${(Number(selectedAnimalDensity) || 0).toFixed(3)}`);
  }

  if (selectedFishId) {
    parts.push(`fish_species=${selectedFishId}`);
    parts.push(`fish_density=${(Number(selectedFishDensity) || 0).toFixed(3)}`);
  }

  return parts.join(' | ');
}

function playTileTooltip(tile, plant = null) {
  const parts = [];
  if (plant) {
    const species = PLANT_BY_ID[plant.speciesId] || null;
    parts.push(species?.name || 'Unknown Plant');
    parts.push(`Stage: ${formatTokenLabel(plant.stageName || 'unknown')}`);
  } else if (tile?.deadLog) {
    parts.push('Dead Log');
  } else if (tile?.rockType) {
    parts.push(formatTokenLabel(tile.rockType));
  } else if (tile?.waterType) {
    parts.push(formatTokenLabel(tile.waterType));
  } else {
    parts.push('Ground');
  }
  return parts.join(' | ');
}

function resolvePlantPartSpriteFrame(itemId) {
  const descriptor = parsePlantPartItemId(itemId);
  if (!descriptor) {
    return null;
  }
  const species = descriptor.species;
  const lifeStageKeys = Object.keys(species?.lifeStages?.reduce((acc, entry) => ({ ...acc, [entry.stage]: true }), {}) || {});
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
  return preferredStage ? getPlantSpriteFrame(descriptor.speciesId, preferredStage) : null;
}

function spriteStyle(sprite, tilePx, scaleMode = 'fit') {
  const atlasScale = scaleMode === 'native' ? 1 : tilePx / sprite.frame.w;
  const x = sprite.frame.x * atlasScale;
  const y = sprite.frame.y * atlasScale;
  const width = sprite.atlasWidth * atlasScale;
  const height = sprite.atlasHeight * atlasScale;
  const publicBase = process.env.PUBLIC_URL || '';

  return {
    backgroundImage: `url(${publicBase}${sprite.imagePath})`,
    backgroundPosition: `-${x}px -${y}px`,
    backgroundSize: `${width}px ${height}px`,
  };
}

function anchoredSpriteStyle(sprite, scale, anchorX, anchorY, extra = null, options = null) {
  const sourceWidth = (sprite.frame.sourceW ?? sprite.frame.w) * scale;
  const sourceHeight = (sprite.frame.sourceH ?? sprite.frame.h) * scale;
  const offsetX = (sprite.frame.offsetX ?? 0) * scale;
  const offsetY = (sprite.frame.offsetY ?? 0) * scale;
  const anchorYOffsetPx = Number(options?.anchorYOffsetPx) || 0;
  const footAnchorX = (sprite.frame.anchorX ?? ((sprite.frame.sourceW ?? sprite.frame.w) / 2)) * scale;
  const footAnchorY = (sprite.frame.anchorY ?? (sprite.frame.sourceH ?? sprite.frame.h)) * scale;
  const x = sprite.frame.x * scale;
  const y = sprite.frame.y * scale;
  const atlasWidth = sprite.atlasWidth * scale;
  const atlasHeight = sprite.atlasHeight * scale;
  const publicBase = process.env.PUBLIC_URL || '';
  return {
    position: 'absolute',
    left: `${Math.round(anchorX - footAnchorX)}px`,
    top: `${Math.round((anchorY - footAnchorY) + anchorYOffsetPx)}px`,
    width: `${Math.round(sourceWidth)}px`,
    height: `${Math.round(sourceHeight)}px`,
    backgroundImage: `url(${publicBase}${sprite.imagePath})`,
    backgroundPosition: `-${x - offsetX}px -${y - offsetY}px`,
    backgroundSize: `${atlasWidth}px ${atlasHeight}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    ...(extra || {}),
  };
}

function isoPlantScale(plant) {
  if (!plant) {
    return ISO_BASE_SCALE;
  }

  const species = PLANT_BY_ID[plant.speciesId] || null;
  const stage = species?.lifeStages?.find((entry) => entry.stage === plant.stageName) || null;
  const size = Number(stage?.size || 0);
  return size >= 8 ? ISO_BASE_SCALE : (ISO_BASE_SCALE * 0.5);
}

function elevationToIsoOffsetPx(elevation) {
  const normalized = Math.max(0, Math.min(1, Number(elevation) || 0));
  return normalized * ISO_MAX_ELEVATION_OFFSET_PX;
}

function applyAutoUnlockGenerations(state) {
  let nextState = state;

  if (canGenerateFishPopulations(nextState)) {
    nextState = generateFishPopulations(nextState);
  }
  if (canGenerateAnimalZones(nextState)) {
    nextState = generateAnimalZones(nextState);
  }
  if (canGenerateMushroomZones(nextState)) {
    nextState = generateGroundFungusZones(nextState);
  }
  if (canGenerateBeehives(nextState)) {
    nextState = generateBeehives(nextState);
  }
  if (canGenerateSquirrelCaches(nextState)) {
    nextState = generateSquirrelCaches(nextState);
  }

  return nextState;
}

function App() {
  const [seedInput, setSeedInput] = useState('10000');
  const [mapWidthInput, setMapWidthInput] = useState('80');
  const [mapHeightInput, setMapHeightInput] = useState('80');
  const [preSimDaysInput, setPreSimDaysInput] = useState('0');
  const [gameState, setGameState] = useState(() => applyAutoUnlockGenerations(createInitialGameState(10000, { width: 80, height: 80 })));
  const [cameraX, setCameraX] = useState(32);
  const [cameraY, setCameraY] = useState(35);
  const [overlayMode, setOverlayMode] = useState('moisture');
  const [rendererMode, setRendererMode] = useState('observer');
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(() => PLANT_CATALOG[0]?.id || '');
  const [selectedAnimalSpeciesId, setSelectedAnimalSpeciesId] = useState(() => LAND_ANIMAL_SPECIES[0]?.id || '');
  const [selectedFishSpeciesId, setSelectedFishSpeciesId] = useState(() => FISH_SPECIES[0]?.id || '');
  const [snapshotStatus, setSnapshotStatus] = useState('');
  const [isDraggingObserver, setIsDraggingObserver] = useState(false);
  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }));
  const fileInputRef = useRef(null);
  const dragStartRef = useRef(null);
  const dragCameraStartRef = useRef(null);
  const actionLogSeenCountRef = useRef(0);
  const isoCanvasRef = useRef(null);
  const prevCameraRef = useRef({ x: null, y: null });
  const [selectedGameTile, setSelectedGameTile] = useState(null);
  const [tileContextMenu, setTileContextMenu] = useState(null);
  const [tilePanelMode, setTilePanelMode] = useState('context');
  const [showAnchorDebug, setShowAnchorDebug] = useState(false);
  const [isInventoryPanelOpen, setIsInventoryPanelOpen] = useState(false);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
  const [debriefTab, setDebriefTab] = useState('summary');
  const [hasVisitedMealTab, setHasVisitedMealTab] = useState(false);
  const [dismissedWarningIds, setDismissedWarningIds] = useState([]);
  const [actionComposerStatus, setActionComposerStatus] = useState('');
  const [playActionFeed, setPlayActionFeed] = useState([]);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('');
  const [selectedStockpileItemId, setSelectedStockpileItemId] = useState('');
  const [selectedWorldItemId, setSelectedWorldItemId] = useState('');
  const [selectedConditionInstanceId, setSelectedConditionInstanceId] = useState('');
  const [selectedVisionItemId, setSelectedVisionItemId] = useState('');
  const [selectedVisionCategory, setSelectedVisionCategory] = useState('');
  const [selectedNatureOverlay, setSelectedNatureOverlay] = useState(NATURE_SIGHT_OVERLAY_OPTIONS[0]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const metrics = useMemo(() => getMetrics(gameState), [gameState]);
  const recentDispersalSummary = useMemo(() => {
    const totalsByMethod = gameState.recentDispersal?.totalsByMethod || {};
    const entries = Object.entries(totalsByMethod).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return 'none';
    }
    return entries.map(([method, count]) => `${method}:${count}`).join(' | ');
  }, [gameState.recentDispersal]);
  const selectedSpecies = useMemo(
    () => (selectedSpeciesId ? PLANT_BY_ID[selectedSpeciesId] || null : null),
    [selectedSpeciesId],
  );
  const speciesSupportKeySet = useMemo(() => {
    if (!selectedSpecies) {
      return new Set();
    }

    const supports = new Set();
    for (const tile of gameState.tiles) {
      if (tileSupportsSpeciesStrict(tile, selectedSpecies)) {
        supports.add(`${tile.x},${tile.y}`);
      }
    }
    return supports;
  }, [gameState.tiles, selectedSpecies]);

  const rendererLayout = RENDERER_LAYOUT[rendererMode] || RENDERER_LAYOUT.observer;
  const familyVitalGroups = useMemo(() => {
    const actorOrder = ['player', 'partner', 'child'];
    return actorOrder
      .map((actorId) => {
        const actor = gameState?.actors?.[actorId];
        if (!actor || typeof actor !== 'object') {
          return null;
        }
        return {
          actorId,
          label: actorId === 'player' ? 'Player' : actorId === 'partner' ? 'Partner' : 'Child',
          rows: PARTNER_VITAL_KEYS.map(({ key, label }) => {
            const value = normalizeVitalValue(actor[key]);
            const severity = vitalSeverityClass(value);
            const percent = Math.round(value * 100);
            return {
              key,
              label,
              severity,
              percent,
            };
          }),
        };
      })
      .filter(Boolean);
  }, [gameState?.actors]);
  const debriefState = gameState?.camp?.debrief && typeof gameState.camp.debrief === 'object'
    ? gameState.camp.debrief
    : { active: false, medicineRequests: [], medicineNotifications: [] };
  const medicineRequests = useMemo(
    () => (Array.isArray(debriefState.medicineRequests) ? debriefState.medicineRequests : []),
    [debriefState.medicineRequests],
  );
  const medicineNotifications = useMemo(
    () => (Array.isArray(debriefState.medicineNotifications) ? debriefState.medicineNotifications : []),
    [debriefState.medicineNotifications],
  );
  const visionRequest = debriefState?.visionRequest && typeof debriefState.visionRequest === 'object'
    ? debriefState.visionRequest
    : null;
  const visionNotifications = useMemo(
    () => (Array.isArray(debriefState?.visionNotifications) ? debriefState.visionNotifications : []),
    [debriefState?.visionNotifications],
  );
  const visionUsesThisSeason = Number.isInteger(debriefState?.visionUsesThisSeason) ? debriefState.visionUsesThisSeason : 0;
  const isDebriefActive = debriefState.active === true;
  const playerActor = gameState?.actors?.player || null;
  const playerAtCamp = playerActor
    && Number(playerActor.x) === Number(gameState?.camp?.anchorX)
    && Number(playerActor.y) === Number(gameState?.camp?.anchorY);
  const playerNatureSightDays = Number.isInteger(playerActor?.natureSightDaysRemaining)
    ? playerActor.natureSightDaysRemaining
    : Math.max(0, Math.floor(Number(playerActor?.natureSightDaysRemaining) || 0));
  const playerEquipment = playerActor?.inventory?.equipment && typeof playerActor.inventory.equipment === 'object'
    ? playerActor.inventory.equipment
    : { gloves: null, coat: null, head: null };
  const playerInventoryStacks = useMemo(
    () => (Array.isArray(playerActor?.inventory?.stacks) ? playerActor.inventory.stacks : []),
    [playerActor?.inventory?.stacks],
  );
  const playerInventoryEntries = useMemo(
    () => playerInventoryStacks.map((entry, idx) => {
      const item = ITEM_BY_ID[entry.itemId] || null;
      const plantPartDescriptor = parsePlantPartItemId(entry.itemId);
      const quantity = Math.max(0, Number(entry.quantity) || 0);
      const unitWeightKg = Number.isFinite(Number(entry?.unitWeightKg))
        ? Number(entry.unitWeightKg)
        : Number.isFinite(Number(item?.unit_weight_g))
          ? (Number(item.unit_weight_g) / 1000)
          : Number.isFinite(Number(plantPartDescriptor?.subStage?.unit_weight_g))
            ? (Number(plantPartDescriptor.subStage.unit_weight_g) / 1000)
            : 0;
      const totalWeightKg = unitWeightKg * quantity;
      const sprite = resolvePlantPartSpriteFrame(entry.itemId);
      return {
        key: `${entry.itemId}-${idx}`,
        itemId: entry.itemId,
        name: item?.name
          || (plantPartDescriptor ? `${plantPartDescriptor.speciesName} ${plantPartDescriptor.partLabel}` : entry.itemId),
        quantity,
        unitWeightKg,
        totalWeightKg,
        decayDays: Number.isFinite(Number(item?.decay_days)) ? Number(item.decay_days) : null,
        spriteStyle: sprite ? spriteStyle(sprite, 22, 'native') : null,
      };
    }),
    [playerInventoryStacks],
  );
  const playerCarryWeightKg = useMemo(
    () => playerInventoryEntries.reduce((sum, entry) => sum + entry.totalWeightKg, 0),
    [playerInventoryEntries],
  );
  const playerCarryCapacityKg = Number.isFinite(Number(playerActor?.inventory?.maxCarryWeightKg))
    ? Number(playerActor.inventory.maxCarryWeightKg)
    : 0;
  const campStockpileStacks = useMemo(
    () => (Array.isArray(gameState?.camp?.stockpile?.stacks) ? gameState.camp.stockpile.stacks : []),
    [gameState?.camp?.stockpile?.stacks],
  );
  const campStockpileEntries = useMemo(
    () => campStockpileStacks.map((entry, idx) => {
      const item = ITEM_BY_ID[entry.itemId] || null;
      const plantPartDescriptor = parsePlantPartItemId(entry.itemId);
      const sprite = resolvePlantPartSpriteFrame(entry.itemId);
      return {
        key: `${entry.itemId}-${idx}`,
        itemId: entry.itemId,
        name: item?.name
          || (plantPartDescriptor ? `${plantPartDescriptor.speciesName} ${plantPartDescriptor.partLabel}` : entry.itemId),
        quantity: Math.max(0, Number(entry.quantity) || 0),
        decayDaysRemaining: Number.isFinite(Number(entry?.decayDaysRemaining))
          ? Number(entry.decayDaysRemaining)
          : null,
        freshness: Number.isFinite(Number(entry?.freshness))
          ? Number(entry.freshness)
          : null,
        spriteStyle: sprite ? spriteStyle(sprite, 22, 'native') : null,
      };
    }),
    [campStockpileStacks],
  );
  const debriefSpoilageEntries = useMemo(
    () => campStockpileEntries
      .filter((entry) => Number.isFinite(entry.decayDaysRemaining) && entry.decayDaysRemaining <= 1.5)
      .sort((a, b) => (a.decayDaysRemaining || 0) - (b.decayDaysRemaining || 0)),
    [campStockpileEntries],
  );
  const partnerTaskQueue = gameState?.camp?.partnerTaskQueue && typeof gameState.camp.partnerTaskQueue === 'object'
    ? gameState.camp.partnerTaskQueue
    : { active: null, queued: [] };
  const queueActiveTask = partnerTaskQueue?.active && typeof partnerTaskQueue.active === 'object'
    ? partnerTaskQueue.active
    : null;
  const queuePendingTasks = Array.isArray(partnerTaskQueue?.queued)
    ? partnerTaskQueue.queued
    : [];
  const partnerTaskHistory = Array.isArray(gameState?.camp?.partnerTaskHistory)
    ? gameState.camp.partnerTaskHistory
    : [];
  const mealPlan = gameState?.camp?.mealPlan && typeof gameState.camp.mealPlan === 'object'
    ? gameState.camp.mealPlan
    : { ingredients: [], preview: null };
  const mealPlanIngredients = Array.isArray(mealPlan.ingredients) ? mealPlan.ingredients : [];
  const mealPlanPreview = mealPlan.preview && typeof mealPlan.preview === 'object' ? mealPlan.preview : null;
  const lastMealResult = gameState?.camp?.lastMealResult && typeof gameState.camp.lastMealResult === 'object'
    ? gameState.camp.lastMealResult
    : null;
  const chosenVisionRewards = Array.isArray(debriefState?.chosenVisionRewards)
    ? debriefState.chosenVisionRewards
    : [];
  const campDryingRackSlots = useMemo(
    () => (Array.isArray(gameState?.camp?.dryingRack?.slots) ? gameState.camp.dryingRack.slots : []),
    [gameState?.camp?.dryingRack?.slots],
  );
  const visionSelectionOptions = useMemo(
    () => (Array.isArray(debriefState?.visionSelectionOptions) ? debriefState.visionSelectionOptions : []),
    [debriefState?.visionSelectionOptions],
  );
  const pendingVisionChoices = useMemo(
    () => (Array.isArray(debriefState?.pendingVisionChoices) ? debriefState.pendingVisionChoices : []),
    [debriefState?.pendingVisionChoices],
  );
  const selectedDebriefTab = isDebriefActive ? debriefTab : null;
  const selectedTileX = Number.isInteger(selectedGameTile?.x) ? selectedGameTile.x : null;
  const selectedTileY = Number.isInteger(selectedGameTile?.y) ? selectedGameTile.y : null;
  const selectedTileEntity = Number.isInteger(selectedTileX) && Number.isInteger(selectedTileY)
    ? getTileAt(gameState, selectedTileX, selectedTileY)
    : null;
  const selectedTileWorldItems = useMemo(() => {
    const key = tileKey(selectedTileX, selectedTileY);
    return key && Array.isArray(gameState?.worldItemsByTile?.[key]) ? gameState.worldItemsByTile[key] : [];
  }, [gameState, selectedTileX, selectedTileY]);
  const selectedTileWorldItemEntries = useMemo(
    () => selectedTileWorldItems.map((entry, idx) => {
      const item = ITEM_BY_ID[entry.itemId] || null;
      const plantPartDescriptor = parsePlantPartItemId(entry.itemId);
      const sprite = resolvePlantPartSpriteFrame(entry.itemId);
      return {
        key: `${entry.itemId}-${idx}`,
        itemId: entry.itemId,
        name: item?.name
          || (plantPartDescriptor ? `${plantPartDescriptor.speciesName} ${plantPartDescriptor.partLabel}` : entry.itemId),
        quantity: Math.max(0, Number(entry.quantity) || 0),
        spriteStyle: sprite ? spriteStyle(sprite, 22, 'native') : null,
      };
    }),
    [selectedTileWorldItems],
  );
  const selectedInventoryQuantity = useMemo(() => {
    const selectedEntry = playerInventoryEntries.find((entry) => entry.itemId === selectedInventoryItemId);
    return selectedEntry ? Math.max(1, Number(selectedEntry.quantity) || 1) : 1;
  }, [playerInventoryEntries, selectedInventoryItemId]);
  const selectedStockpileQuantity = useMemo(() => {
    const selectedEntry = campStockpileEntries.find((entry) => entry.itemId === selectedStockpileItemId);
    return selectedEntry ? Math.max(1, Number(selectedEntry.quantity) || 1) : 1;
  }, [campStockpileEntries, selectedStockpileItemId]);
  const selectedWorldItemQuantity = useMemo(() => {
    const selectedEntry = selectedTileWorldItemEntries.find((entry) => entry.itemId === selectedWorldItemId);
    return selectedEntry ? Math.max(1, Number(selectedEntry.quantity) || 1) : 1;
  }, [selectedTileWorldItemEntries, selectedWorldItemId]);
  const inventoryQuickActionsByItemId = useMemo(() => {
    const actionKinds = ['eat', 'item_drop', 'equip_item', 'camp_stockpile_add', 'camp_drying_rack_add_inventory'];
    const labelByKind = {
      eat: 'Eat',
      item_drop: 'Drop',
      equip_item: 'Equip',
      camp_stockpile_add: 'Move to Stockpile',
      camp_drying_rack_add_inventory: 'Move to Drying Rack',
    };
    return playerInventoryEntries.reduce((acc, itemEntry) => {
      const baseContext = {
        selectedX: selectedTileX,
        selectedY: selectedTileY,
        tile: selectedTileEntity,
        player: playerActor,
        selectedInventoryItemId: itemEntry.itemId,
        selectedInventoryQuantity: Math.max(1, Number(itemEntry.quantity) || 1),
        selectedStockpileItemId,
        selectedStockpileQuantity,
        selectedWorldItemId,
        selectedWorldItemQuantity,
        selectedConditionInstanceId,
        selectedVisionItemId,
        selectedVisionCategory,
        selectedNatureOverlay,
      };
      acc[itemEntry.itemId] = actionKinds
        .map((kind) => {
          const payload = buildDefaultPayload(kind, baseContext);
          const validation = validateAction(gameState, { actorId: 'player', kind, payload });
          if (!validation.ok) {
            return null;
          }
          return {
            kind,
            label: labelByKind[kind] || kind.replace(/_/g, ' '),
            payload,
          };
        })
        .filter(Boolean);
      return acc;
    }, {});
  }, [
    campStockpileEntries,
    gameState,
    playerActor,
    playerInventoryEntries,
    selectedConditionInstanceId,
    selectedNatureOverlay,
    selectedStockpileItemId,
    selectedStockpileQuantity,
    selectedTileEntity,
    selectedTileX,
    selectedTileY,
    selectedVisionCategory,
    selectedVisionItemId,
    selectedWorldItemId,
    selectedWorldItemQuantity,
  ]);
  const stockpileQuickActionsByItemId = useMemo(() => {
    const actionKinds = ['camp_stockpile_remove', 'camp_drying_rack_add'];
    const labelByKind = {
      camp_stockpile_remove: 'Withdraw',
      camp_drying_rack_add: 'Move to Drying Rack',
    };
    return campStockpileEntries.reduce((acc, itemEntry) => {
      const baseContext = {
        selectedX: selectedTileX,
        selectedY: selectedTileY,
        tile: selectedTileEntity,
        player: playerActor,
        selectedInventoryItemId,
        selectedInventoryQuantity,
        selectedStockpileItemId: itemEntry.itemId,
        selectedStockpileQuantity: Math.max(1, Number(itemEntry.quantity) || 1),
        selectedWorldItemId,
        selectedWorldItemQuantity,
        selectedConditionInstanceId,
        selectedVisionItemId,
        selectedVisionCategory,
        selectedNatureOverlay,
      };
      acc[itemEntry.itemId] = actionKinds
        .map((kind) => {
          const payload = buildDefaultPayload(kind, baseContext);
          const validation = validateAction(gameState, { actorId: 'player', kind, payload });
          if (!validation.ok) {
            return null;
          }
          return {
            kind,
            label: labelByKind[kind] || kind.replace(/_/g, ' '),
            payload,
          };
        })
        .filter(Boolean);
      return acc;
    }, {});
  }, [
    campStockpileEntries,
    gameState,
    playerActor,
    selectedConditionInstanceId,
    selectedInventoryItemId,
    selectedInventoryQuantity,
    selectedNatureOverlay,
    selectedTileEntity,
    selectedTileX,
    selectedTileY,
    selectedVisionCategory,
    selectedVisionItemId,
    selectedWorldItemId,
    selectedWorldItemQuantity,
  ]);
  const availableContextActionEntries = useMemo(() => {
    if (!selectedTileEntity || selectedTileX === null || selectedTileY === null) {
      return [];
    }
    const entries = [];
    const baseContext = {
      selectedX: selectedTileX,
      selectedY: selectedTileY,
      tile: selectedTileEntity,
      player: playerActor,
      selectedInventoryItemId,
      selectedInventoryQuantity,
      selectedStockpileItemId,
      selectedStockpileQuantity,
      selectedWorldItemId,
      selectedWorldItemQuantity,
      selectedConditionInstanceId,
      selectedVisionItemId,
      selectedVisionCategory,
      selectedNatureOverlay,
    };

    // Expand harvest: one entry per activeSubStage per plant on the tile
    for (const plantId of (selectedTileEntity.plantIds || [])) {
      const plant = gameState.plants?.[plantId];
      if (!plant?.alive || !Array.isArray(plant.activeSubStages)) continue;
      for (const sub of plant.activeSubStages) {
        const payload = {
          plantId,
          partName: sub.partName,
          subStageId: sub.subStageId,
          actions: 1,
          x: selectedTileX,
          y: selectedTileY,
        };
        const v = validateAction(gameState, { actorId: 'player', kind: 'harvest', payload });
        if (v.ok) {
          entries.push({
            kind: 'harvest',
            label: `Harvest ${sub.partName} (${sub.subStageId})`,
            tickCost: Number(v?.normalizedAction?.tickCost) || getActionTickCost('harvest', payload),
            payload,
          });
        }
      }
    }

    // Add tile-based harvest entries for non-plant harvest targets (cache/rock).
    const tileHarvestPayload = { x: selectedTileX, y: selectedTileY };
    const tileHarvestValidation = validateAction(gameState, { actorId: 'player', kind: 'harvest', payload: tileHarvestPayload });
    if (tileHarvestValidation.ok) {
      const targetType = tileHarvestValidation?.normalizedAction?.payload?.targetType;
      if (targetType === 'squirrel_cache' || targetType === 'rock' || targetType === 'log_fungus') {
        const fungusSpeciesId = tileHarvestValidation?.normalizedAction?.payload?.speciesId;
        entries.push({
          kind: 'harvest',
          label: targetType === 'squirrel_cache'
            ? 'Harvest squirrel cache'
            : targetType === 'log_fungus'
              ? `Harvest ${formatTokenLabel(fungusSpeciesId || 'log fungus')}`
              : 'Harvest rock',
          tickCost: Number(tileHarvestValidation?.normalizedAction?.tickCost) || getActionTickCost('harvest', tileHarvestPayload),
          payload: tileHarvestPayload,
        });
      }
    }

    // Expand item_pickup: one entry per world item on tile
    for (const item of selectedTileWorldItemEntries) {
      const payload = { x: selectedTileX, y: selectedTileY, itemId: item.itemId, quantity: 1 };
      const v = validateAction(gameState, { actorId: 'player', kind: 'item_pickup', payload });
      if (v.ok) {
        entries.push({
          kind: 'item_pickup',
          label: `Pick Up ${item.name}`,
          tickCost: getActionTickCost('item_pickup', payload),
          payload,
        });
      }
    }

    // All other context actions (not move, not harvest, not item_pickup — those are handled above)
    const hasInspectablePlant = Array.isArray(selectedTileEntity?.plantIds) && selectedTileEntity.plantIds.some((plantId) => {
      const plant = gameState?.plants?.[plantId];
      if (!plant || plant.alive !== true || !Array.isArray(plant.activeSubStages)) {
        return false;
      }
      const species = PLANT_BY_ID[plant.speciesId] || null;
      return plant.activeSubStages.some((entry) => {
        const partName = typeof entry?.partName === 'string' ? entry.partName : '';
        const subStageId = typeof entry?.subStageId === 'string' ? entry.subStageId : '';
        if (!partName || !subStageId) {
          return false;
        }
        const partDef = (species?.parts || []).find((candidate) => candidate?.name === partName) || null;
        const subStageDef = (partDef?.subStages || []).find((candidate) => candidate?.id === subStageId) || null;
        const digTicksToDiscover = Number(subStageDef?.dig_ticks_to_discover);
        return !(Number.isFinite(digTicksToDiscover) && digTicksToDiscover > 0);
      });
    });
    const otherKinds = inferTileContextActions(selectedTileEntity).filter(
      (k) => k !== 'move' && k !== 'harvest' && k !== 'item_pickup',
    );
    for (const kind of otherKinds) {
      if (kind === 'inspect' && !hasInspectablePlant) {
        continue;
      }
      const payload = buildDefaultPayload(kind, baseContext);
      const v = validateAction(gameState, { actorId: 'player', kind, payload });
      if (v.ok) {
        entries.push({
          kind,
          label: kind.replace(/_/g, ' '),
          tickCost: getActionTickCost(kind, payload),
          payload,
        });
      }
    }
    return entries;
  }, [
    gameState,
    playerActor,
    selectedConditionInstanceId,
    selectedInventoryItemId,
    selectedNatureOverlay,
    selectedStockpileItemId,
    selectedTileEntity,
    selectedTileWorldItemEntries,
    selectedTileX,
    selectedTileY,
    selectedVisionCategory,
    selectedVisionItemId,
    selectedWorldItemId,
  ]);
  const selectedInspectData = useMemo(() => {
    if (!selectedTileEntity) {
      return null;
    }
    const firstPlantId = Array.isArray(selectedTileEntity.plantIds) ? selectedTileEntity.plantIds[0] : null;
    const firstPlant = firstPlantId ? gameState?.plants?.[firstPlantId] : null;
    if (!firstPlant || firstPlant.alive !== true) {
      return null;
    }
    const species = PLANT_BY_ID[firstPlant.speciesId] || null;
    const lifeStage = (species?.lifeStages || []).find((entry) => entry?.stage === firstPlant.stageName) || null;
    const activeParts = Array.isArray(firstPlant.activeSubStages)
      ? firstPlant.activeSubStages.map((entry) => {
        const partName = typeof entry?.partName === 'string' ? entry.partName : '';
        const subStageId = typeof entry?.subStageId === 'string' ? entry.subStageId : '';
        if (!partName || !subStageId) {
          return null;
        }
        const partDef = (species?.parts || []).find((candidate) => candidate?.name === partName) || null;
        const subStageDef = (partDef?.subStages || []).find((candidate) => candidate?.id === subStageId) || null;
        const digTicksToDiscover = Number(subStageDef?.dig_ticks_to_discover);
        return {
          partName,
          partLabel: formatTokenLabel(partName),
          subStageId,
          subStageLabel: formatTokenLabel(subStageId),
          fieldDescription: typeof subStageDef?.field_description === 'string' ? subStageDef.field_description : '',
          gameDescription: typeof subStageDef?.game_description === 'string' ? subStageDef.game_description : '',
          isUndergroundOnly: Number.isFinite(digTicksToDiscover) && digTicksToDiscover > 0,
        };
      }).filter(Boolean)
      : [];
    const aboveGroundParts = activeParts.filter((entry) => entry.isUndergroundOnly !== true);
    const identified = isSpeciesIdentifiedInState(gameState, firstPlant.speciesId);
    return {
      canInspect: aboveGroundParts.length > 0,
      identified,
      plantName: species?.name || firstPlant.speciesId,
      speciesId: firstPlant.speciesId,
      lifeStageLabel: formatTokenLabel(firstPlant.stageName || 'unknown'),
      fieldDescription: typeof lifeStage?.field_description === 'string'
        ? lifeStage.field_description
        : 'No field notes available.',
      gameDescription: typeof species?.game_description === 'string' ? species.game_description : '',
      activeParts: aboveGroundParts,
    };
  }, [gameState, selectedTileEntity]);
  const dayTick = Number(gameState?.dayTick) || 0;
  const dayProgressPercent = Math.max(0, Math.min(100, (dayTick / TICKS_PER_DAY) * 100));
  const nightThresholdPercent = Math.max(0, Math.min(100, (NIGHT_TICK_THRESHOLD / TICKS_PER_DAY) * 100));
  const seasonName = titleCase(getSeason(Number(gameState?.dayOfYear) || 1));
  const epochNumber = 1;
  const calendarLabel = `${seasonName} · Day ${Number(gameState?.dayOfYear) || 1} · Epoch ${epochNumber}`;
  const playerTickBudgetCurrent = Number(playerActor?.tickBudgetCurrent) || 0;
  const playerTickBudgetBase = Number(playerActor?.tickBudgetBase) || 0;
  const playerOverdraftTicks = Number(playerActor?.overdraftTicks) || 0;
  const hasTickOverdraft = playerTickBudgetCurrent < 0 || playerOverdraftTicks > 0;
  const warningEntries = useMemo(() => {
    const entries = [];
    if (hasTickOverdraft) {
      entries.push({
        id: 'tick-overdraft',
        severity: 'critical',
        title: 'Tick Overdraft',
        message: `You are over budget by ${Math.max(playerOverdraftTicks, Math.abs(Math.min(0, playerTickBudgetCurrent)))} ticks.`,
      });
    }
    if (!isDebriefActive && dayTick >= NIGHT_TICK_THRESHOLD) {
      entries.push({
        id: 'nightfall',
        severity: 'warning',
        title: 'Night Is Falling',
        message: 'End Day at camp to enter debrief before conditions worsen.',
      });
    }
    if (!isDebriefActive && dayTick >= NIGHT_TICK_THRESHOLD && !playerAtCamp) {
      entries.push({
        id: 'return-camp',
        severity: 'warning',
        title: 'Return To Camp',
        message: 'You are away from camp after night threshold.',
      });
    }
    return entries;
  }, [dayTick, hasTickOverdraft, isDebriefActive, playerAtCamp, playerOverdraftTicks, playerTickBudgetCurrent]);
  const visibleWarningEntries = useMemo(
    () => warningEntries.filter((entry) => !dismissedWarningIds.includes(entry.id)),
    [dismissedWarningIds, warningEntries],
  );
  const canBeginDay = hasVisitedMealTab;
  const observerTileStepPx = RENDERER_LAYOUT.observer.tilePx + RENDERER_LAYOUT.observer.tileGapPx;
  const gameViewportWidth = Math.max(4, Math.floor((windowSize.width - 24) / ISO_TILE_WIDTH_PX) + 1);
  const gameViewportHeight = Math.max(4, Math.floor((windowSize.height - 24) / ISO_TILE_HEIGHT_PX) + 1);
  const viewportWidth = rendererMode === 'game'
    ? Math.min(gameState.width, gameViewportWidth)
    : OBSERVER_VIEWPORT_WIDTH;
  const viewportHeight = rendererMode === 'game'
    ? Math.min(gameState.height, gameViewportHeight)
    : OBSERVER_VIEWPORT_HEIGHT;
  const cameraAnchorTile = useMemo(
    () => getTileAt(gameState, cameraX, cameraY),
    [cameraX, cameraY, gameState],
  );
  const cameraAnchorElevationPx = rendererMode === 'game'
    ? 0
    : elevationToIsoOffsetPx(cameraAnchorTile?.elevation);

  useEffect(() => {
    if (!selectedInventoryItemId && playerInventoryStacks.length > 0) {
      setSelectedInventoryItemId(playerInventoryStacks[0].itemId || '');
    } else if (selectedInventoryItemId && !playerInventoryStacks.some((entry) => entry.itemId === selectedInventoryItemId)) {
      setSelectedInventoryItemId(playerInventoryStacks[0]?.itemId || '');
    }
  }, [playerInventoryStacks, selectedInventoryItemId]);

  useEffect(() => {
    if (!selectedStockpileItemId && campStockpileStacks.length > 0) {
      setSelectedStockpileItemId(campStockpileStacks[0].itemId || '');
    } else if (selectedStockpileItemId && !campStockpileStacks.some((entry) => entry.itemId === selectedStockpileItemId)) {
      setSelectedStockpileItemId(campStockpileStacks[0]?.itemId || '');
    }
  }, [campStockpileStacks, selectedStockpileItemId]);

  useEffect(() => {
    if (!selectedWorldItemId && selectedTileWorldItems.length > 0) {
      setSelectedWorldItemId(selectedTileWorldItems[0].itemId || '');
    } else if (selectedWorldItemId && !selectedTileWorldItems.some((entry) => entry.itemId === selectedWorldItemId)) {
      setSelectedWorldItemId(selectedTileWorldItems[0]?.itemId || '');
    }
  }, [selectedTileWorldItems, selectedWorldItemId]);

  useEffect(() => {
    if (!selectedConditionInstanceId && medicineRequests.length > 0) {
      setSelectedConditionInstanceId(medicineRequests[0].conditionInstanceId || '');
    } else if (
      selectedConditionInstanceId
      && !medicineRequests.some((entry) => entry.conditionInstanceId === selectedConditionInstanceId)
    ) {
      setSelectedConditionInstanceId(medicineRequests[0]?.conditionInstanceId || '');
    }
  }, [medicineRequests, selectedConditionInstanceId]);

  useEffect(() => {
    if (!selectedVisionItemId && visionSelectionOptions.length > 0) {
      setSelectedVisionItemId(visionSelectionOptions[0].itemId || '');
    } else if (selectedVisionItemId && !visionSelectionOptions.some((entry) => entry.itemId === selectedVisionItemId)) {
      setSelectedVisionItemId(visionSelectionOptions[0]?.itemId || '');
    }
  }, [selectedVisionItemId, visionSelectionOptions]);

  useEffect(() => {
    if (!selectedVisionCategory && pendingVisionChoices.length > 0) {
      setSelectedVisionCategory(pendingVisionChoices[0].category || '');
    } else if (selectedVisionCategory && !pendingVisionChoices.some((entry) => entry.category === selectedVisionCategory)) {
      setSelectedVisionCategory(pendingVisionChoices[0]?.category || '');
    }
  }, [pendingVisionChoices, selectedVisionCategory]);

  useEffect(() => {
    if (!selectedGameTile && playerActor && Number.isInteger(playerActor.x) && Number.isInteger(playerActor.y)) {
      setSelectedGameTile({ x: playerActor.x, y: playerActor.y });
    }
  }, [playerActor, selectedGameTile]);

  useLayoutEffect(() => {
    if (rendererMode !== 'game') {
      return;
    }
    if (!playerActor || !Number.isInteger(playerActor.x) || !Number.isInteger(playerActor.y)) {
      return;
    }
    const nextX = playerActor.x;
    const nextY = playerActor.y;
    const canvas = isoCanvasRef.current;
    if (canvas) {
      canvas.style.transition = '';
      canvas.style.transform = 'translate(0px, 0px)';
    }
    prevCameraRef.current = { x: nextX, y: nextY };
    setCameraX(nextX);
    setCameraY(nextY);
    return undefined;
  }, [playerActor, rendererMode]);

  useEffect(() => {
    if (!isDebriefActive) {
      setHasVisitedMealTab(false);
      setDebriefTab('summary');
      return;
    }
    if (debriefTab === 'meal') {
      setHasVisitedMealTab(true);
    }
  }, [debriefTab, isDebriefActive]);

  useEffect(() => {
    const activeIds = new Set(warningEntries.map((entry) => entry.id));
    setDismissedWarningIds((prev) => prev.filter((id) => activeIds.has(id)));
  }, [warningEntries]);

  useEffect(() => {
    const logs = Array.isArray(gameState.currentDayActionLog) ? gameState.currentDayActionLog : [];
    const previousCount = actionLogSeenCountRef.current;
    if (logs.length > previousCount) {
      const newlyLoggedEntries = logs.slice(previousCount);
      const newEntries = logs.slice(previousCount).map((entry) => ({
        stamp: Date.now() + Math.random(),
        kind: entry.kind || 'unknown',
        status: entry.status || 'applied',
        message: entry.message || '',
        code: entry.code || '',
      }));
      setPlayActionFeed((prev) => [...newEntries, ...prev].slice(0, 16));

      const digDiscoveryEntry = newlyLoggedEntries
        .slice()
        .reverse()
        .find(
          (entry) => entry?.kind === 'dig'
            && entry?.status === 'applied'
            && typeof entry?.message === 'string'
            && entry.message.startsWith('dig discovery after '),
        );
      if (digDiscoveryEntry) {
        setActionComposerStatus(digDiscoveryEntry.message);
      }
    }
    actionLogSeenCountRef.current = logs.length;
  }, [gameState.currentDayActionLog]);

  const rows = useMemo(() => {
    const nextRows = [];

    for (let y = 0; y < viewportHeight; y += 1) {
      const cols = [];
      for (let x = 0; x < viewportWidth; x += 1) {
        const worldX = cameraX + x;
        const worldY = cameraY + y;
        const tile = getTileAt(gameState, worldX, worldY);
        cols.push({
          worldX,
          worldY,
          tile,
        });
      }
      nextRows.push(cols);
    }

    return nextRows;
  }, [cameraX, cameraY, gameState, viewportHeight, viewportWidth]);

  const visibleIsoTiles = useMemo(() => {
    if (rendererMode !== 'game') {
      return [];
    }

    const originX = Math.round(windowSize.width / 2);
    const originY = Math.round(windowSize.height / 2)
      + ISO_PLAY_TOP_HUD_CENTER_BIAS_PX
      + ISO_PLAY_VERTICAL_NUDGE_EXTRA_TILE_HEIGHTS * ISO_TILE_HEIGHT_PX
      + cameraAnchorElevationPx;
    const xMin = -ISO_TILE_WIDTH_PX;
    const xMax = windowSize.width + ISO_TILE_WIDTH_PX;
    const yMin = -ISO_TILE_HEIGHT_PX;
    const yMax = windowSize.height + ISO_TILE_HEIGHT_PX;
    const corners = [
      [xMin, yMin],
      [xMax, yMin],
      [xMin, yMax],
      [xMax, yMax],
    ];

    let minLocalX = Number.POSITIVE_INFINITY;
    let maxLocalX = Number.NEGATIVE_INFINITY;
    let minLocalY = Number.POSITIVE_INFINITY;
    let maxLocalY = Number.NEGATIVE_INFINITY;

    for (const [sx, sy] of corners) {
      const sum = (sy - originY) / ISO_TILE_HALF_HEIGHT_PX;
      const diff = (sx - originX) / ISO_TILE_HALF_WIDTH_PX;
      const localX = (sum + diff) / 2;
      const localY = (sum - diff) / 2;
      minLocalX = Math.min(minLocalX, localX);
      maxLocalX = Math.max(maxLocalX, localX);
      minLocalY = Math.min(minLocalY, localY);
      maxLocalY = Math.max(maxLocalY, localY);
    }

    const pad = 2;
    const startLocalX = Math.floor(minLocalX) - pad;
    const endLocalX = Math.ceil(maxLocalX) + pad;
    const startLocalY = Math.floor(minLocalY) - pad;
    const endLocalY = Math.ceil(maxLocalY) + pad;

    const visible = [];
    for (let localY = startLocalY; localY <= endLocalY; localY += 1) {
      for (let localX = startLocalX; localX <= endLocalX; localX += 1) {
        const worldX = cameraX + localX;
        const worldY = cameraY + localY;
        if (worldX < 0 || worldY < 0 || worldX >= gameState.width || worldY >= gameState.height) {
          continue;
        }
        const tile = getTileAt(gameState, worldX, worldY);
        if (!tile) {
          continue;
        }
        visible.push({ worldX, worldY, tile });
      }
    }

    return visible;
  }, [cameraAnchorElevationPx, cameraX, cameraY, gameState, rendererMode, windowSize.height, windowSize.width]);

  const buildNewGameState = useCallback(() => {
    const parsed = Number.parseInt(seedInput, 10);
    const safeSeed = Number.isFinite(parsed) ? parsed : 10000;
    const parsedWidth = Number.parseInt(mapWidthInput, 10);
    const parsedHeight = Number.parseInt(mapHeightInput, 10);
    const safeWidth = Number.isFinite(parsedWidth) ? parsedWidth : 80;
    const safeHeight = Number.isFinite(parsedHeight) ? parsedHeight : 80;
    const parsedPreSimDays = Number.parseInt(preSimDaysInput, 10);
    const preSimDays = Number.isFinite(parsedPreSimDays) ? Math.max(0, parsedPreSimDays) : 0;
    const base = createInitialGameState(safeSeed, { width: safeWidth, height: safeHeight });
    return applyAutoUnlockGenerations(preSimDays > 0 ? advanceDay(base, preSimDays) : base);
  }, [mapHeightInput, mapWidthInput, preSimDaysInput, seedInput]);

  const initializeFromSeed = useCallback((enterPlayMode = false) => {
    const nextState = buildNewGameState();
    setGameState(nextState);
    const centeredX = Math.max(0, Math.floor((nextState.width - viewportWidth) / 2));
    const centeredY = Math.max(0, Math.floor((nextState.height - viewportHeight) / 2));
    setCameraX(centeredX);
    setCameraY(centeredY);
    setSelectedGameTile({ x: nextState.camp.anchorX, y: nextState.camp.anchorY });
    setSnapshotStatus(`new game ready (seed ${nextState.seed}, pre-sim ${Math.max(0, Number.parseInt(preSimDaysInput, 10) || 0)} day(s))`);
    if (enterPlayMode) {
      setRendererMode('game');
    }
  }, [buildNewGameState, preSimDaysInput, viewportHeight, viewportWidth]);

  const runSteps = (steps) => {
    setGameState((prev) => applyAutoUnlockGenerations(advanceDay(prev, steps)));
  };

  const submitPlayerAction = useCallback((kind, payload = {}) => {
    setGameState((prev) => applyAutoUnlockGenerations(advanceTick(prev, {
      actions: [
        {
          actionId: `ui-${kind}-${Date.now()}`,
          actorId: 'player',
          kind,
          payload,
        },
      ],
    })));
  }, []);

  const appendLocalFeed = useCallback((entry) => {
    setPlayActionFeed((prev) => [
      { stamp: Date.now() + Math.random(), ...entry },
      ...prev,
    ].slice(0, 16));
  }, []);

  const runQuickAction = useCallback((kind, payloadOverrides = null) => {
    const basePayload = buildDefaultPayload(kind, {
      selectedX: selectedTileX,
      selectedY: selectedTileY,
      tile: selectedTileEntity,
      player: playerActor,
      selectedInventoryItemId,
      selectedInventoryQuantity,
      selectedStockpileItemId,
      selectedStockpileQuantity,
      selectedWorldItemId,
      selectedWorldItemQuantity,
      selectedConditionInstanceId,
      selectedVisionItemId,
      selectedVisionCategory,
      selectedNatureOverlay,
    });
    const payload = payloadOverrides ? { ...basePayload, ...payloadOverrides } : basePayload;
    const validation = validateAction(gameState, {
      actorId: 'player',
      kind,
      payload,
    });
    if (!validation.ok) {
      setActionComposerStatus(`Blocked: ${validation.message}`);
      appendLocalFeed({
        kind,
        status: 'blocked',
        message: validation.message,
        code: validation.code,
      });
      return;
    }
    submitPlayerAction(kind, payload);
    setActionComposerStatus(`Submitted: ${kind}`);
    appendLocalFeed({
      kind,
      status: 'submitted',
      message: 'queued',
      code: null,
    });
  }, [
    appendLocalFeed,
    gameState,
    playerActor,
    selectedConditionInstanceId,
    selectedInventoryItemId,
    selectedInventoryQuantity,
    selectedNatureOverlay,
    selectedStockpileItemId,
    selectedStockpileQuantity,
    selectedTileEntity,
    selectedTileX,
    selectedTileY,
    selectedVisionCategory,
    selectedVisionItemId,
    selectedWorldItemId,
    selectedWorldItemQuantity,
    submitPlayerAction,
  ]);

  const runTileQuickAction = useCallback((kind, worldX, worldY, tileOverride = null, payloadOverrides = null) => {
    const basePayload = buildDefaultPayload(kind, {
      selectedX: worldX,
      selectedY: worldY,
      tile: tileOverride,
      player: playerActor,
      selectedInventoryItemId,
      selectedInventoryQuantity,
      selectedStockpileItemId,
      selectedStockpileQuantity,
      selectedWorldItemId,
      selectedWorldItemQuantity,
      selectedConditionInstanceId,
      selectedVisionItemId,
      selectedVisionCategory,
      selectedNatureOverlay,
    });
    const payload = payloadOverrides && typeof payloadOverrides === 'object'
      ? { ...basePayload, ...payloadOverrides }
      : basePayload;
    const validation = validateAction(gameState, {
      actorId: 'player',
      kind,
      payload,
    });
    if (!validation.ok) {
      setActionComposerStatus(`Blocked: ${validation.message}`);
      appendLocalFeed({
        kind,
        status: 'blocked',
        message: validation.message,
        code: validation.code,
      });
      return;
    }
    submitPlayerAction(kind, payload);
    setActionComposerStatus(`Submitted: ${kind}`);
    appendLocalFeed({
      kind,
      status: 'submitted',
      message: 'queued',
      code: null,
    });
  }, [
    appendLocalFeed,
    gameState,
    playerActor,
    selectedConditionInstanceId,
    selectedInventoryItemId,
    selectedInventoryQuantity,
    selectedNatureOverlay,
    selectedStockpileItemId,
    selectedStockpileQuantity,
    selectedVisionCategory,
    selectedVisionItemId,
    selectedWorldItemId,
    selectedWorldItemQuantity,
    submitPlayerAction,
  ]);

  const runContextMenuAction = useCallback((entry) => {
    if (!tileContextMenu || !Number.isInteger(tileContextMenu.worldX) || !Number.isInteger(tileContextMenu.worldY)) {
      return;
    }
    const { worldX, worldY } = tileContextMenu;
    const kind = typeof entry === 'string' ? entry : entry.kind;
    const bakedPayload = typeof entry === 'object' && entry.payload ? entry.payload : null;

    if (kind === 'inspect') {
      if (!selectedInspectData?.canInspect) {
        setActionComposerStatus('Inspect requires a tile with an above-ground plant part.');
        setTileContextMenu(null);
        return;
      }
      setTilePanelMode('inspect');
      setActionComposerStatus('Inspecting plant.');
      setTileContextMenu(null);
      return;
    }
    if (kind === 'dig') {
      const input = window.prompt('Dig duration ticks', '5');
      if (input === null) {
        setTileContextMenu(null);
        return;
      }
      const requestedTicks = Math.max(1, Math.floor(Number(input) || 1));
      runTileQuickAction(kind, worldX, worldY, getTileAt(gameState, worldX, worldY), { tickCost: requestedTicks });
      setTileContextMenu(null);
      return;
    }
    if (bakedPayload) {
      submitPlayerAction(kind, bakedPayload);
      setActionComposerStatus(`Submitted: ${kind}`);
      setTileContextMenu(null);
      return;
    }
    runTileQuickAction(kind, worldX, worldY, getTileAt(gameState, worldX, worldY));
    setTileContextMenu(null);
  }, [gameState, runTileQuickAction, selectedInspectData, submitPlayerAction, tileContextMenu]);

  const generateMushroomZones = () => {
    if (!canGenerateMushroomZones(gameState)) {
      const remaining = Math.max(0, 400 - Number(gameState.totalDaysSimulated || 0));
      setSnapshotStatus(`mushroom zones locked: simulate ${remaining} more day(s)`);
      return;
    }

    const nextState = generateGroundFungusZones(gameState);
    const generatedZoneTileCount = nextState.tiles.filter((tile) => tile.groundFungusZone).length;

    setGameState(nextState);
    setOverlayMode('mushroomZones');
    setRendererMode('observer');

    if (generatedZoneTileCount > 0) {
      setSnapshotStatus(`generated mushroom zones on ${generatedZoneTileCount} tiles`);
    } else {
      setSnapshotStatus('mushroom generation ran but found no eligible tiles');
    }
  };

  const generateBeehiveTiles = () => {
    if (!canGenerateBeehives(gameState)) {
      const remaining = Math.max(0, BEEHIVE_UNLOCK_DAYS - Number(gameState.totalDaysSimulated || 0));
      setSnapshotStatus(`beehives locked: simulate ${remaining} more day(s)`);
      return;
    }

    const nextState = generateBeehives(gameState);
    const beehiveTileCount = nextState.tiles.filter((tile) => tile.beehive).length;

    setGameState(nextState);
    setOverlayMode('beehives');
    setRendererMode('observer');
    setSnapshotStatus(`generated beehives on ${beehiveTileCount} tile(s)`);
  };

  const generateSquirrelCacheTiles = () => {
    if (!canGenerateSquirrelCaches(gameState)) {
      const remaining = Math.max(0, SQUIRREL_CACHE_UNLOCK_DAYS - Number(gameState.totalDaysSimulated || 0));
      setSnapshotStatus(`squirrel caches locked: simulate ${remaining} more day(s)`);
      return;
    }

    const nextState = generateSquirrelCaches(gameState);
    const cacheTileCount = nextState.tiles.filter((tile) => tile.squirrelCache).length;

    setGameState(nextState);
    setOverlayMode('squirrelCaches');
    setRendererMode('observer');
    setSnapshotStatus(`generated squirrel caches on ${cacheTileCount} tile(s)`);
  };

  const generateFishDensity = () => {
    if (!canGenerateFishPopulations(gameState)) {
      const remaining = Math.max(0, FISH_POPULATION_UNLOCK_DAYS - Number(gameState.totalDaysSimulated || 0));
      setSnapshotStatus(`fish populations locked: simulate ${remaining} more day(s)`);
      return;
    }

    const nextState = generateFishPopulations(gameState);
    const generatedSpecies = Object.keys(nextState.fishDensityByTile || {}).length;

    setGameState(nextState);
    setOverlayMode('fishDensity');
    setRendererMode('observer');

    if (generatedSpecies > 0) {
      setSnapshotStatus(`generated fish populations for ${generatedSpecies} species`);
    } else {
      setSnapshotStatus('fish generation ran but found no eligible water bodies/species');
    }
  };

  const generateAnimalDensityZones = () => {
    if (!canGenerateAnimalZones(gameState)) {
      const remaining = Math.max(0, ANIMAL_ZONE_UNLOCK_DAYS - Number(gameState.totalDaysSimulated || 0));
      setSnapshotStatus(`animal density locked: simulate ${remaining} more day(s)`);
      return;
    }

    const nextState = generateAnimalZones(gameState);
    const generatedSpecies = Object.keys(nextState.animalDensityByZone || {}).length;

    setGameState(nextState);
    setOverlayMode('animalDensity');
    setRendererMode('observer');

    if (generatedSpecies > 0) {
      setSnapshotStatus(`generated animal densities for ${generatedSpecies} species`);
    } else {
      setSnapshotStatus('animal generation ran but found no eligible species');
    }
  };

  const maxCameraX = Math.max(0, gameState.width - viewportWidth);
  const maxCameraY = Math.max(0, gameState.height - viewportHeight);

  const clampCameraX = useCallback((value) => Math.max(0, Math.min(maxCameraX, value)), [maxCameraX]);
  const clampCameraY = useCallback((value) => Math.max(0, Math.min(maxCameraY, value)), [maxCameraY]);

  useEffect(() => {
    setCameraX((prev) => Math.max(0, Math.min(maxCameraX, prev)));
    setCameraY((prev) => Math.max(0, Math.min(maxCameraY, prev)));
  }, [maxCameraX, maxCameraY]);

  const panCamera = useCallback((dx, dy) => {
    setCameraX((prev) => clampCameraX(prev + dx));
    setCameraY((prev) => clampCameraY(prev + dy));
  }, [clampCameraX, clampCameraY]);

  useEffect(() => {
    if (rendererMode !== 'game') {
      return undefined;
    }

    const onKeyDown = (event) => {
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || active?.isContentEditable) {
        return;
      }

      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          setIsInventoryPanelOpen((prev) => !prev);
          break;
        case 'Escape':
          event.preventDefault();
          setIsPauseMenuOpen((prev) => !prev);
          break;
        case 'i':
        case 'I':
          event.preventDefault();
          if (selectedInspectData?.canInspect) {
            setTilePanelMode('inspect');
          } else {
            setActionComposerStatus('Inspect requires a tile with an above-ground plant part.');
          }
          break;
        case 's':
        case 'S':
          event.preventDefault();
          setTilePanelMode('context');
          break;
        case 'n':
        case 'N':
          event.preventDefault();
          setSelectedNatureOverlay((prev) => {
            const idx = NATURE_SIGHT_OVERLAY_OPTIONS.indexOf(prev);
            const nextIdx = idx >= 0
              ? (idx + 1) % NATURE_SIGHT_OVERLAY_OPTIONS.length
              : 0;
            return NATURE_SIGHT_OVERLAY_OPTIONS[nextIdx];
          });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          panCamera(-1, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          panCamera(1, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          panCamera(0, -1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          panCamera(0, 1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panCamera, rendererMode, selectedInspectData]);

  const handleObserverPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragCameraStartRef.current = { x: cameraX, y: cameraY };
    setIsDraggingObserver(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleObserverPointerMove = (event) => {
    if (!isDraggingObserver || !dragStartRef.current || !dragCameraStartRef.current) {
      return;
    }

    const deltaTilesX = Math.round((dragStartRef.current.x - event.clientX) / observerTileStepPx);
    const deltaTilesY = Math.round((dragStartRef.current.y - event.clientY) / observerTileStepPx);
    const nextCameraX = clampCameraX(dragCameraStartRef.current.x + deltaTilesX);
    const nextCameraY = clampCameraY(dragCameraStartRef.current.y + deltaTilesY);

    setCameraX(nextCameraX);
    setCameraY(nextCameraY);
  };

  const finishObserverDrag = (event) => {
    if (!isDraggingObserver) {
      return;
    }

    setIsDraggingObserver(false);
    dragStartRef.current = null;
    dragCameraStartRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const downloadSnapshot = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      state: gameState,
      metrics,
    };

    const blob = new Blob([serializeGameState(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sim_snapshot_y${gameState.year}_d${gameState.dayOfYear}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSnapshotStatus('snapshot saved');
  };

  const handleLoadSnapshot = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const loadedState = applyAutoUnlockGenerations(deserializeGameState(text));
      setGameState(loadedState);
      setCameraX(Math.max(0, Math.floor((loadedState.width - viewportWidth) / 2)));
      setCameraY(Math.max(0, Math.floor((loadedState.height - viewportHeight) / 2)));
      setSnapshotStatus(`loaded ${file.name}`);
    } catch (error) {
      setSnapshotStatus(`load failed: ${error.message}`);
    }

    event.target.value = '';
  };

  const activeOverlayMode = rendererMode === 'game' ? 'moisture' : overlayMode;

  const renderTileGrid = () => (
    <div
      className={[
        'tile-grid',
        'draggable-grid',
        `renderer-${rendererMode}`,
        rendererMode === 'game' ? 'fullscreen-grid' : '',
        isDraggingObserver ? 'dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{
        '--tile-size-px': `${rendererLayout.tilePx}px`,
        '--tile-gap-px': `${rendererLayout.tileGapPx}px`,
        '--viewport-width': viewportWidth,
        '--viewport-height': viewportHeight,
      }}
      onPointerDown={handleObserverPointerDown}
      onPointerMove={handleObserverPointerMove}
      onPointerUp={finishObserverDrag}
      onPointerCancel={finishObserverDrag}
    >
      {rows.map((row) => row.map(({ worldX, worldY, tile }) => {
        if (!tile) {
          return <div key={`${worldX}-${worldY}`} className="tile offmap">×</div>;
        }

        const firstPlantId = tile.plantIds[0];
        const plant = firstPlantId ? gameState.plants[firstPlantId] : null;
        const zone = tile.groundFungusZone;
        const zoneSymbol = zone && Number(zone.yieldCurrentGrams) > 0
          ? zone.speciesId[0].toUpperCase()
          : '';
        const featureOverlaySymbol = tile.beehive
          ? 'B'
          : (tile.squirrelCache && Number(tile.squirrelCache.nutContentGrams) > 0 ? 'C' : '');
        const worldItems = Array.isArray(gameState.worldItemsByTile?.[`${worldX},${worldY}`])
          ? gameState.worldItemsByTile[`${worldX},${worldY}`]
          : [];
        const isPlayerTile = Number(playerActor?.x) === worldX && Number(playerActor?.y) === worldY;
        const isCampTile = Number(gameState?.camp?.anchorX) === worldX && Number(gameState?.camp?.anchorY) === worldY;
        const tileEntityTokens = buildTileEntityTokens(tile, {
          isPlayerTile,
          isCampTile,
          worldItems,
          camp: gameState?.camp,
        });
        const symbol = plant ? plant.speciesId[0].toUpperCase() : zoneSymbol;
        const recentTileEvent = gameState.recentDispersal?.byTile?.[`${worldX},${worldY}`] || null;
        const supportKey = `${worldX},${worldY}`;
        const speciesSupport = speciesSupportKeySet.has(supportKey);
        const selectedAnimalDensity = activeOverlayMode === 'animalDensity'
          ? getAnimalDensityAtTile(gameState, selectedAnimalSpeciesId, worldX, worldY)
          : null;
        const selectedFishDensity = activeOverlayMode === 'fishDensity'
          ? getFishDensityAtTile(gameState, selectedFishSpeciesId, worldX, worldY)
          : null;
        const bg = overlayColor(
          activeOverlayMode,
          tile,
          recentTileEvent,
          speciesSupport,
          selectedAnimalDensity,
          selectedFishDensity,
        );
        const sprite = plant
          ? getPlantSpriteFrame(plant.speciesId, plant.stageName)
          : (tile.deadLog ? getDeadLogSpriteFrame() : getRockSpriteFrame(tile.rockType));
        const hasOccupant = Boolean(plant || tile.deadLog || tile.rockType);
        const logMushroomSymbol = tile.deadLog
          ? ((tile.deadLog.fungi || [])
            .find((entry) => Number(entry?.yield_current_grams) > 0)
            ?.species_id?.[0]?.toUpperCase() || '')
          : '';
        const mushroomOverlaySymbol = logMushroomSymbol || (!plant && zoneSymbol ? zoneSymbol : '');
        const combinedOverlaySymbol = [mushroomOverlaySymbol, featureOverlaySymbol].filter(Boolean).join('');

        return (
          <div
            key={`${worldX}-${worldY}`}
            className={`tile tile-${rendererMode}`}
            style={{ background: bg }}
            title={tileTooltip(
              worldX,
              worldY,
              tile,
              plant,
              recentTileEvent,
              activeOverlayMode === 'speciesSupport' ? selectedSpeciesId : null,
              speciesSupport,
              hasOccupant,
              activeOverlayMode === 'animalDensity' ? selectedAnimalSpeciesId : null,
              selectedAnimalDensity,
              activeOverlayMode === 'fishDensity' ? selectedFishSpeciesId : null,
              selectedFishDensity,
            )}
          >
            {sprite ? (
              <span
                className="plant-sprite"
                style={spriteStyle(sprite, rendererLayout.tilePx, rendererLayout.spriteScaleMode)}
                aria-hidden="true"
              />
            ) : (
              <span className="plant-symbol">{symbol}</span>
            )}
            {combinedOverlaySymbol ? (
              <span className="mushroom-overlay-symbol">{combinedOverlaySymbol}</span>
            ) : null}
            {tileEntityTokens.length > 0 ? (
              <span className="tile-entity-token">{tileEntityTokens.slice(0, 2).join(' ')}</span>
            ) : null}
            {rendererLayout.showTileMeta ? (
              <span className="tile-meta">{hasOccupant ? '1' : '0'}</span>
            ) : null}
          </div>
        );
      }))}
    </div>
  );

  const renderIsometricPlayView = () => {
    const tiles = visibleIsoTiles
      .sort((a, b) => {
        const da = a.worldY + a.worldX;
        const db = b.worldY + b.worldX;
        if (da !== db) {
          return da - db;
        }
        return a.worldX - b.worldX;
      });

    const canvasWidth = windowSize.width;
    const canvasHeight = windowSize.height;
    const originX = Math.round(canvasWidth / 2);
    const originY = Math.round(canvasHeight / 2)
      + ISO_PLAY_TOP_HUD_CENTER_BIAS_PX
      + ISO_PLAY_VERTICAL_NUDGE_EXTRA_TILE_HEIGHTS * ISO_TILE_HEIGHT_PX
      + cameraAnchorElevationPx;

    return (
      <div className="isometric-play-stage" style={{ '--iso-canvas-width': `${canvasWidth}px`, '--iso-canvas-height': `${canvasHeight}px` }}>
        <div className="isometric-canvas" ref={isoCanvasRef}>
          {tiles.map(({ worldX, worldY, tile }) => {
            const localX = worldX - cameraX;
            const localY = worldY - cameraY;
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
            const isPlayerTile = Number(playerActor?.x) === worldX && Number(playerActor?.y) === worldY;
            const isCampTile = Number(gameState?.camp?.anchorX) === worldX && Number(gameState?.camp?.anchorY) === worldY;
            const tileEntityTokens = buildTileEntityTokens(tile, {
              isPlayerTile,
              isCampTile,
              worldItems,
              camp: gameState?.camp,
            });
            const isSelectedTile = selectedTileX === worldX && selectedTileY === worldY;
            const rockSprite = tile.rockType ? getRockSpriteFrame(tile.rockType) : null;
            const grassSprite = !tile.waterType ? getTerrainSpriteFrame('grass') : null;
            const dirtSprite = !tile.waterType ? getTerrainSpriteFrame('dirt') : null;
            const waterSprite = tile.waterType ? getTerrainSpriteFrame('water') : null;
            const iceSprite = tile.waterFrozen ? getTerrainSpriteFrame('ice') : null;
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
            const sideFillDepth = Math.ceil(sideFillDepthPx / ISO_TILE_HALF_HEIGHT_PX);
            const needsDirtUnderlay = Boolean(!tile.waterType && (!southTile || southTile.waterType));
            const deepWaterStyle = tile.waterType && tile.waterDepth === 'deep'
              ? { filter: 'hue-rotate(-18deg) saturate(1.35) brightness(0.82)' }
              : null;

            return (
              <div key={`${worldX}-${worldY}`} className="iso-tile-stack">
                {needsDirtUnderlay && dirtSprite ? (
                  <span
                    className="iso-layer iso-layer-underlay"
                    style={anchoredSpriteStyle(dirtSprite, ISO_BASE_SCALE, screenX, groundY + ISO_TILE_HALF_HEIGHT_PX)}
                  />
                ) : null}
                {!tile.waterType && dirtSprite
                  ? Array.from({ length: sideFillDepth }, (_, idx) => (
                    <span
                      key={`side-fill-${worldX}-${worldY}-${idx}`}
                      className="iso-layer iso-layer-underlay"
                      style={anchoredSpriteStyle(
                        dirtSprite,
                        ISO_BASE_SCALE,
                        screenX,
                        groundY + (ISO_TILE_HALF_HEIGHT_PX * (idx + 1)),
                      )}
                    />
                  ))
                  : null}
                {dirtSprite ? (
                  <span
                    className="iso-layer iso-layer-dirt"
                    style={anchoredSpriteStyle(dirtSprite, ISO_BASE_SCALE, screenX, groundY)}
                  />
                ) : null}
                {grassSprite ? (
                  <span
                    className="iso-layer iso-layer-grass"
                    style={anchoredSpriteStyle(grassSprite, ISO_BASE_SCALE, screenX, groundY)}
                  />
                ) : null}
                {waterSprite ? (
                  <span
                    className="iso-layer iso-layer-water"
                    style={anchoredSpriteStyle(
                      waterSprite,
                      ISO_BASE_SCALE,
                      screenX,
                      groundY + ISO_WATER_VERTICAL_OFFSET_PX,
                      deepWaterStyle,
                    )}
                  />
                ) : null}
                {iceSprite ? (
                  <span
                    className="iso-layer iso-layer-ice"
                    style={anchoredSpriteStyle(
                      iceSprite,
                      ISO_BASE_SCALE,
                      screenX,
                      groundY + ISO_WATER_VERTICAL_OFFSET_PX,
                    )}
                  />
                ) : null}
                {rockSprite ? (
                  <span
                    className="iso-layer iso-layer-rock"
                    style={anchoredSpriteStyle(
                      rockSprite,
                      ISO_BASE_SCALE,
                      screenX,
                      groundY - ISO_ROCK_STACK_OFFSET_PX,
                    )}
                  />
                ) : null}
                {occupantSprite ? (
                  <span
                    className="iso-layer iso-layer-occupant"
                    style={anchoredSpriteStyle(
                      occupantSprite,
                      plantOrLogScale,
                      screenX,
                      occupantAnchorY,
                      null,
                      deadLogSprite ? { anchorYOffsetPx: ISO_TILE_HEIGHT_PX } : null,
                    )}
                  />
                ) : null}
                {showAnchorDebug ? (
                  <span
                    className="iso-anchor-debug"
                    style={{ left: `${screenX}px`, top: `${occupantAnchorY}px` }}
                    title={`anchor ${worldX},${worldY}`}
                  />
                ) : null}
                {combinedOverlaySymbol ? (
                  <span
                    className="iso-mushroom-overlay"
                    style={{ left: `${screenX}px`, top: `${tileTopCenterY - 8 + ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX}px` }}
                  >
                    {combinedOverlaySymbol}
                  </span>
                ) : null}
                {tileEntityTokens.map((token, idx) => (
                  <span
                    key={`entity-token-${worldX}-${worldY}-${token}`}
                    className="iso-entity-token"
                    style={{
                      left: `${screenX}px`,
                      top: `${tileTopCenterY - 24 - (idx * 16) + ISO_TILE_ENTITY_TEXT_NUDGE_DOWN_PX}px`,
                    }}
                  >
                    {token}
                  </span>
                ))}
                <button
                  type="button"
                  className={`iso-tile-hitbox ${isSelectedTile ? 'selected' : ''}`}
                  style={{ left: `${screenX}px`, top: `${tileTopCenterY}px` }}
                  onClick={() => {
                    setSelectedGameTile({ x: worldX, y: worldY });
                    setTilePanelMode('context');
                    setTileContextMenu(null);
                    const playerX = Number(playerActor?.x);
                    const playerY = Number(playerActor?.y);
                    if (Number.isFinite(playerX) && Number.isFinite(playerY) && (playerX !== worldX || playerY !== worldY)) {
                      runTileQuickAction('move', worldX, worldY, tile);
                    } else {
                      setActionComposerStatus('Tile selected.');
                    }
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedGameTile({ x: worldX, y: worldY });
                    setTilePanelMode('context');
                    setTileContextMenu({
                      worldX,
                      worldY,
                      screenX,
                      groundY: tileTopCenterY,
                    });
                    setActionComposerStatus('Tile actions opened.');
                  }}
                  title={tileTooltip(worldX, worldY, tile, plant)}
                />
              </div>
            );
          })}
          {tileContextMenu && Number.isInteger(tileContextMenu.worldX) && Number.isInteger(tileContextMenu.worldY) ? (
            <div
              className="iso-context-menu"
              style={{ left: `${tileContextMenu.screenX + 20}px`, top: `${tileContextMenu.groundY - 18}px` }}
            >
              {availableContextActionEntries.length === 0 ? (
                <p className="iso-context-menu-empty">No available actions</p>
              ) : (
                availableContextActionEntries.map((entry, idx) => (
                  <button
                    key={`ctx-${entry.kind}-${idx}`}
                    type="button"
                    className="iso-context-menu-action"
                    onClick={() => runContextMenuAction(entry)}
                    title={`${entry.label} (${entry.tickCost}t)`}
                  >
                    {entry.label} ({entry.tickCost}t)
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  if (rendererMode === 'game') {
    return (
      <main className="app app-game-mode">
        <section className="game-stage">
          {renderIsometricPlayView()}
        </section>
        <GameModeChrome
          onSwitchToDebug={() => setRendererMode('observer')}
          onNewGameFromSettings={() => initializeFromSeed(true)}
          showAnchorDebug={showAnchorDebug}
          onToggleAnchorDebug={() => setShowAnchorDebug((prev) => !prev)}
          metrics={metrics}
          gameState={gameState}
          playerActor={playerActor}
          playerAtCamp={playerAtCamp}
          playerNatureSightDays={playerNatureSightDays}
          dayProgressPercent={dayProgressPercent}
          nightThresholdPercent={nightThresholdPercent}
          dayTick={dayTick}
          ticksPerDay={TICKS_PER_DAY}
          calendarLabel={calendarLabel}
          playerTickBudgetCurrent={playerTickBudgetCurrent}
          playerTickBudgetBase={playerTickBudgetBase}
          playerOverdraftTicks={playerOverdraftTicks}
          hasTickOverdraft={hasTickOverdraft}
          familyVitalGroups={familyVitalGroups}
          warningEntries={visibleWarningEntries}
          onAcknowledgeWarning={(warningId) => {
            setDismissedWarningIds((prev) => (prev.includes(warningId) ? prev : [...prev, warningId]));
          }}
          selectedTileX={selectedTileX}
          selectedTileY={selectedTileY}
          selectedTileEntity={selectedTileEntity}
          selectedTileWorldItems={selectedTileWorldItemEntries}
          tilePanelMode={tilePanelMode}
          selectedInspectData={selectedInspectData}
          onRunQuickAction={runQuickAction}
          isInventoryPanelOpen={isInventoryPanelOpen}
          isPauseMenuOpen={isPauseMenuOpen}
          onClosePauseMenu={() => setIsPauseMenuOpen(false)}
          actionComposerStatus={actionComposerStatus}
          playActionFeed={playActionFeed}
          playerCarryWeightKg={playerCarryWeightKg}
          playerCarryCapacityKg={playerCarryCapacityKg}
          selectedInventoryItemId={selectedInventoryItemId}
          setSelectedInventoryItemId={setSelectedInventoryItemId}
          playerInventoryStacks={playerInventoryEntries}
          inventoryQuickActionsByItemId={inventoryQuickActionsByItemId}
          selectedStockpileItemId={selectedStockpileItemId}
          setSelectedStockpileItemId={setSelectedStockpileItemId}
          campStockpileStacks={campStockpileEntries}
          stockpileQuickActionsByItemId={stockpileQuickActionsByItemId}
          playerEquipment={playerEquipment}
          equipmentSlots={EQUIPMENT_SLOTS}
          onUnequipSlot={(slot) => {
            submitPlayerAction('unequip_item', { equipmentSlot: slot });
          }}
          campDryingRackSlots={campDryingRackSlots}
          onDryingRackRemove={(slotIndex) => submitPlayerAction('camp_drying_rack_remove', { slotIndex, quantity: 1 })}
          selectedWorldItemId={selectedWorldItemId}
          setSelectedWorldItemId={setSelectedWorldItemId}
          isDebriefActive={isDebriefActive}
          onEndDayEnterDebrief={() => {
            if (!playerAtCamp) {
              window.alert('End Day requires being at camp.');
              return;
            }
            const hasRemainingTicks = Number(playerActor?.tickBudgetCurrent) > 0;
            if (hasRemainingTicks) {
              const confirmed = window.confirm('You still have ticks remaining. End Day and enter debrief anyway?');
              if (!confirmed) {
                return;
              }
            }
            setGameState((prev) => {
              const currentDayTick = Math.max(0, Math.floor(Number(prev?.dayTick) || 0));
              const ticksUntilDebrief = Math.max(0, NIGHT_TICK_THRESHOLD - currentDayTick);
              let next = prev;
              if (ticksUntilDebrief > 0) {
                next = advanceTick(next, { idleTicks: ticksUntilDebrief });
              }
              next = advanceTick(next, {
                actions: [
                  {
                    actionId: `ui-debrief-enter-${Date.now()}`,
                    actorId: 'player',
                    kind: 'debrief_enter',
                    payload: {},
                  },
                ],
              });
              return applyAutoUnlockGenerations(next);
            });
          }}
          selectedDebriefTab={selectedDebriefTab}
          onSelectDebriefTab={setDebriefTab}
          canBeginDay={canBeginDay}
          hasVisitedMealTab={hasVisitedMealTab}
          debriefSpoilageEntries={debriefSpoilageEntries}
          queueActiveTask={queueActiveTask}
          queuePendingTasks={queuePendingTasks}
          partnerTaskHistory={partnerTaskHistory}
          mealPlanIngredients={mealPlanIngredients}
          mealPlanPreview={mealPlanPreview}
          lastMealResult={lastMealResult}
          chosenVisionRewards={chosenVisionRewards}
          onBeginDay={() => {
            runQuickAction('debrief_exit');
          }}
          visionUsesThisSeason={visionUsesThisSeason}
          visionSelectionOptions={visionSelectionOptions}
          selectedVisionItemId={selectedVisionItemId}
          setSelectedVisionItemId={setSelectedVisionItemId}
          pendingVisionChoices={pendingVisionChoices}
          selectedVisionCategory={selectedVisionCategory}
          setSelectedVisionCategory={setSelectedVisionCategory}
          selectedNatureOverlay={selectedNatureOverlay}
          setSelectedNatureOverlay={setSelectedNatureOverlay}
          natureSightOverlayOptions={NATURE_SIGHT_OVERLAY_OPTIONS}
          visionNotifications={visionNotifications}
          visionRequest={visionRequest}
          medicineNotifications={medicineNotifications}
          medicineRequests={medicineRequests}
          onFocusConditionInstance={setSelectedConditionInstanceId}
          onAdministerCondition={(conditionInstanceId) => {
            if (conditionInstanceId) {
              submitPlayerAction('partner_medicine_administer', { conditionInstanceId });
              return;
            }
            submitPlayerAction('partner_medicine_administer', {});
          }}
        />
      </main>
    );
  }

  return (
    <main className="app">
      <header className="panel controls">
        <h1>10,000 BC — Phase 1 Vertical Slice</h1>
        <p>
          Deterministic map generation + <code>advanceDay</code> plant simulation +
          observer renderer.
        </p>

        <div className="control-row">
          <label htmlFor="seed">Seed</label>
          <input
            id="seed"
            value={seedInput}
            onChange={(event) => setSeedInput(event.target.value)}
          />
          <label htmlFor="map-width">W</label>
          <input
            id="map-width"
            value={mapWidthInput}
            onChange={(event) => setMapWidthInput(event.target.value)}
          />
          <label htmlFor="map-height">H</label>
          <input
            id="map-height"
            value={mapHeightInput}
            onChange={(event) => setMapHeightInput(event.target.value)}
          />
          <label htmlFor="pre-sim-days">Pre-sim days</label>
          <input
            id="pre-sim-days"
            value={preSimDaysInput}
            onChange={(event) => setPreSimDaysInput(event.target.value)}
          />
          <button type="button" onClick={() => initializeFromSeed(false)}>Start New Game</button>
          <button type="button" onClick={() => initializeFromSeed(true)}>Start New Game + Play</button>
        </div>

        <div className="control-row">
          <button type="button" onClick={() => runSteps(1)}>Step 1 Day</button>
          <button type="button" onClick={() => runSteps(40)}>Run 1 Year (40d)</button>
          <button type="button" onClick={() => runSteps(200)}>Run 5 Years</button>
          <button type="button" onClick={() => runSteps(1000)}>Run 25 Years</button>
          <button
            type="button"
            onClick={generateMushroomZones}
            disabled={!canGenerateMushroomZones(gameState)}
            title={canGenerateMushroomZones(gameState)
              ? 'Generate stable mushroom zones from current simulated ecosystem'
              : 'Requires stabilized ecosystem (10+ simulated years) and one-time generation'}
          >
            Generate Mushroom Zones
          </button>
          <span>
            Zones: {gameState.groundFungusZonesGenerated ? 'generated' : 'not generated'}
          </span>
          <span>
            Unlock: {Math.min(400, Number(gameState.totalDaysSimulated || 0))}/400 simulated days
          </span>
        </div>

        <div className="control-row">
          <button
            type="button"
            onClick={generateBeehiveTiles}
            disabled={!canGenerateBeehives(gameState)}
            title={canGenerateBeehives(gameState)
              ? 'Generate beehive feature tiles from living mature trees in stabilized ecosystem'
              : 'Requires stabilized ecosystem (10+ simulated years) and one-time generation'}
          >
            Generate Beehives
          </button>
          <span>
            Beehives: {gameState.beehivesGenerated ? 'generated' : 'not generated'}
          </span>
          <span>
            Unlock: {Math.min(BEEHIVE_UNLOCK_DAYS, Number(gameState.totalDaysSimulated || 0))}/{BEEHIVE_UNLOCK_DAYS} simulated days
          </span>
        </div>

        <div className="control-row">
          <button
            type="button"
            onClick={generateSquirrelCacheTiles}
            disabled={!canGenerateSquirrelCaches(gameState)}
            title={canGenerateSquirrelCaches(gameState)
              ? 'Generate squirrel cache feature tiles with 80/20 ground/dead-tree split in stabilized ecosystem'
              : 'Requires stabilized ecosystem (10+ simulated years) and one-time generation'}
          >
            Generate Squirrel Caches
          </button>
          <span>
            Caches: {gameState.squirrelCachesGenerated ? 'generated' : 'not generated'}
          </span>
          <span>
            Unlock: {Math.min(SQUIRREL_CACHE_UNLOCK_DAYS, Number(gameState.totalDaysSimulated || 0))}/{SQUIRREL_CACHE_UNLOCK_DAYS} simulated days
          </span>
        </div>

        <div className="control-row">
          <button
            type="button"
            onClick={generateFishDensity}
            disabled={!canGenerateFishPopulations(gameState)}
            title={canGenerateFishPopulations(gameState)
              ? 'Generate fish density on water tiles from water-body habitat compatibility'
              : 'Requires fish-population unlock and one-time generation'}
          >
            Generate Fish Populations
          </button>
          <span>
            Fish: {gameState.fishPopulationsGenerated ? 'generated' : 'not generated'}
          </span>
          <span>
            Unlock: {Math.min(FISH_POPULATION_UNLOCK_DAYS, Number(gameState.totalDaysSimulated || 0))}/{FISH_POPULATION_UNLOCK_DAYS} simulated days
          </span>
        </div>

        <div className="control-row">
          <button
            type="button"
            onClick={generateAnimalDensityZones}
            disabled={!canGenerateAnimalZones(gameState)}
            title={canGenerateAnimalZones(gameState)
              ? 'Generate per-tile animal density from nearby compatible plants in stabilized ecosystem'
              : 'Requires stabilized ecosystem (10+ simulated years) and one-time generation'}
          >
            Generate Animal Densities
          </button>
          <span>
            Densities: {gameState.animalZonesGenerated ? 'generated' : 'not generated'}
          </span>
          <span>
            Unlock: {Math.min(ANIMAL_ZONE_UNLOCK_DAYS, Number(gameState.totalDaysSimulated || 0))}/{ANIMAL_ZONE_UNLOCK_DAYS} simulated days
          </span>
        </div>

        <div className="control-row">
          <button type="button" onClick={() => panCamera(-5, 0)}>◀</button>
          <button type="button" onClick={() => panCamera(5, 0)}>▶</button>
          <button type="button" onClick={() => panCamera(0, -5)}>▲</button>
          <button type="button" onClick={() => panCamera(0, 5)}>▼</button>
          <span>
            Camera: ({cameraX}, {cameraY})
          </span>
        </div>

        <div className="control-row">
          <button type="button" onClick={downloadSnapshot}>Save Snapshot</button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>Load Snapshot</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleLoadSnapshot}
            style={{ display: 'none' }}
          />
          <span>{snapshotStatus}</span>
        </div>

        <div className="control-row">
          <button type="button" onClick={() => setRendererMode('game')}>Enter Play View</button>
        </div>

        <div className="control-row">
          <label htmlFor="overlay-mode">Overlay</label>
          <select
            id="overlay-mode"
            value={overlayMode}
            onChange={(event) => setOverlayMode(event.target.value)}
          >
            {OVERLAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {overlayMode === 'speciesSupport' ? (
          <div className="control-row">
            <label htmlFor="species-support-target">Species</label>
            <select
              id="species-support-target"
              value={selectedSpeciesId}
              onChange={(event) => setSelectedSpeciesId(event.target.value)}
            >
              {PLANT_CATALOG.map((species) => (
                <option key={species.id} value={species.id}>{species.id}</option>
              ))}
            </select>
            <span>
              Supported tiles: {speciesSupportKeySet.size}/{gameState.tiles.length}
            </span>
          </div>
        ) : null}

        {overlayMode === 'animalDensity' ? (
          <div className="control-row">
            <label htmlFor="animal-density-target">Animal</label>
            <select
              id="animal-density-target"
              value={selectedAnimalSpeciesId}
              onChange={(event) => setSelectedAnimalSpeciesId(event.target.value)}
            >
              {LAND_ANIMAL_SPECIES.map((animal) => (
                <option key={animal.id} value={animal.id}>{animal.id}</option>
              ))}
            </select>
          </div>
        ) : null}

        {overlayMode === 'fishDensity' ? (
          <div className="control-row">
            <label htmlFor="fish-density-target">Fish</label>
            <select
              id="fish-density-target"
              value={selectedFishSpeciesId}
              onChange={(event) => setSelectedFishSpeciesId(event.target.value)}
            >
              {FISH_SPECIES.map((fish) => (
                <option key={fish.id} value={fish.id}>{fish.id}</option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      <section className="panel metrics">
        <h2>Simulation Metrics</h2>
        <div className="metrics-grid">
          <span>Year</span><strong>{metrics.year}</strong>
          <span>Day of Year</span><strong>{metrics.dayOfYear}</strong>
          <span>Total Days Simulated</span><strong>{metrics.totalDaysSimulated}</strong>
          <span>Daily Temperature</span><strong>{metrics.dailyTemperatureF.toFixed(1)}°F ({metrics.dailyTemperatureBand})</strong>
          <span>Daily Wind</span><strong>{`x ${metrics.dailyWindVector.x.toFixed(2)}, y ${metrics.dailyWindVector.y.toFixed(2)} (${metrics.dailyWindVector.strengthLabel})`}</strong>
          <span>Total Living Plants</span><strong>{metrics.totalPlants}</strong>
          <span>Dormant Seeds</span><strong>{metrics.totalDormantSeeds}</strong>
        </div>

        <div className="species-breakdown">
          <h3>Species Counts</h3>
          <ul>
            {Object.entries(metrics.speciesCounts).map(([speciesId, count]) => (
              <li key={speciesId}>
                <span>{speciesId}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel observer">
        <h2>Observer View ({viewportWidth}×{viewportHeight} around camera)</h2>
        {renderTileGrid()}
        <p className="legend">
          Overlay: <strong>{OVERLAY_OPTIONS.find((option) => option.value === activeOverlayMode)?.label}</strong>.
          Water tiles stay blue. Land tiles hold at most one occupant (living plant, dead log, or rock). Living plants render from species life-stage atlases; dead logs render from the universal dead tree sprite; rock tiles render with stone half-cube sprites. Letter fallback indicates a present plant whose current stage has no above-ground renderable sprite.
        </p>
        <p className="legend">
          Mushroom letters: ground mushrooms use letter fallback when fruiting and visible; log mushroom letters render on top of dead log tiles when active log yield data exists.
        </p>
        {overlayMode === 'recentDispersal' ? (
          <p className="legend">
            Recent dispersal day {gameState.recentDispersal?.dayOfYear ?? '-'} totals: <strong>{recentDispersalSummary}</strong>.
          </p>
        ) : null}
        {overlayMode === 'speciesSupport' ? (
          <p className="legend">
            Species support map for <strong>{selectedSpeciesId || 'none'}</strong>: green = strict environmental support, red = strict reject, blue = water. Disturbance status is shown in tile tooltips for species that use <code>requires_disturbance</code>.
          </p>
        ) : null}
        {overlayMode === 'animalDensity' ? (
          <p className="legend">
            Animal density map for <strong>{selectedAnimalSpeciesId || 'none'}</strong>: greener tiles indicate
            higher inferred density from nearby compatible forage.
          </p>
        ) : null}
        {overlayMode === 'fishDensity' ? (
          <p className="legend">
            Fish density map for <strong>{selectedFishSpeciesId || 'none'}</strong>: brighter blue water tiles
            indicate higher modeled fish density by water-body habitat.
          </p>
        ) : null}
        {overlayMode === 'heightmap' ? (
          <p className="legend">
            Heightmap overlay: darker tiles are lower elevation, lighter tiles are higher elevation.
          </p>
        ) : null}
        {overlayMode === 'beehives' ? (
          <p className="legend">
            Beehive overlay: highlighted land tiles contain active beehive feature objects (B marker in view).
          </p>
        ) : null}
        {overlayMode === 'squirrelCaches' ? (
          <p className="legend">
            Squirrel cache overlay: highlighted tiles contain cache feature objects (C marker); caches are generated with an 80/20 ground/dead-tree split.
          </p>
        ) : null}
        <p className="legend">Drag the observer grid to pan quickly; arrow buttons still support fixed-step movement.</p>
      </section>
    </main>
  );
}

export default App;
