import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
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
  getGroundFungusById,
  getMetrics,
  getTileAt,
  serializeGameState,
} from './game/simCore.mjs';
import {
  getDeadLogSpriteFrame,
  getPlantSpriteFrame,
  getRockSpriteFrame,
  getTerrainSpriteFrame,
} from './game/plantSpriteCatalog.mjs';
import { ANIMAL_CATALOG } from './game/animalCatalog.mjs';
import { PLANT_CATALOG, PLANT_BY_ID } from './game/plantCatalog.mjs';

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
const ISO_OCCUPANT_ANCHOR_OFFSET_PX = ISO_TILE_HALF_HEIGHT_PX;
const ISO_PLANT_CENTER_BUMP_PX = ISO_TILE_HALF_HEIGHT_PX;
const ISO_ELEVATION_LEVELS = 6;
const ISO_MAX_ELEVATION_OFFSET_PX = ISO_ELEVATION_LEVELS * ISO_TILE_HALF_HEIGHT_PX;

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

function drainageToIndex(drainage) {
  const idx = DRAINAGE_ORDER.indexOf(drainage);
  if (idx === -1) {
    return 0.5;
  }
  return idx / (DRAINAGE_ORDER.length - 1);
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

function anchoredSpriteStyle(sprite, scale, anchorX, anchorY, extra = null) {
  const sourceWidth = (sprite.frame.sourceW ?? sprite.frame.w) * scale;
  const sourceHeight = (sprite.frame.sourceH ?? sprite.frame.h) * scale;
  const offsetX = (sprite.frame.offsetX ?? 0) * scale;
  const offsetY = (sprite.frame.offsetY ?? 0) * scale;
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
    top: `${Math.round(anchorY - footAnchorY)}px`,
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
  const observerTileStepPx = RENDERER_LAYOUT.observer.tilePx + RENDERER_LAYOUT.observer.tileGapPx;
  const gameViewportWidth = Math.max(4, Math.floor((windowSize.width - 24) / ISO_TILE_WIDTH_PX) + 1);
  const gameViewportHeight = Math.max(4, Math.floor((windowSize.height - 24) / ISO_TILE_HEIGHT_PX) + 1);
  const viewportWidth = rendererMode === 'game'
    ? Math.min(gameState.width, gameViewportWidth)
    : OBSERVER_VIEWPORT_WIDTH;
  const viewportHeight = rendererMode === 'game'
    ? Math.min(gameState.height, gameViewportHeight)
    : OBSERVER_VIEWPORT_HEIGHT;

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
    const originY = ISO_TILE_HALF_HEIGHT_PX;
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
  }, [cameraX, cameraY, gameState, rendererMode, windowSize.height, windowSize.width]);

  const initializeFromSeed = () => {
    const parsed = Number.parseInt(seedInput, 10);
    const safeSeed = Number.isFinite(parsed) ? parsed : 10000;
    const parsedWidth = Number.parseInt(mapWidthInput, 10);
    const parsedHeight = Number.parseInt(mapHeightInput, 10);
    const safeWidth = Number.isFinite(parsedWidth) ? parsedWidth : 80;
    const safeHeight = Number.isFinite(parsedHeight) ? parsedHeight : 80;

    const nextState = applyAutoUnlockGenerations(createInitialGameState(safeSeed, { width: safeWidth, height: safeHeight }));
    setGameState(nextState);
    setCameraX(Math.max(0, Math.floor((nextState.width - viewportWidth) / 2)));
    setCameraY(Math.max(0, Math.floor((nextState.height - viewportHeight) / 2)));
  };

  const runSteps = (steps) => {
    setGameState((prev) => applyAutoUnlockGenerations(advanceDay(prev, steps)));
  };

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
  }, [panCamera, rendererMode]);

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
          : (tile.squirrelCache ? 'C' : '');
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
    const originY = ISO_TILE_HALF_HEIGHT_PX;

    return (
      <div className="isometric-play-stage" style={{ '--iso-canvas-width': `${canvasWidth}px`, '--iso-canvas-height': `${canvasHeight}px` }}>
        <div className="isometric-canvas">
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
            const occupantAnchorY = plant
              ? (groundY - ISO_OCCUPANT_ANCHOR_OFFSET_PX - ISO_PLANT_CENTER_BUMP_PX)
              : (groundY - ISO_OCCUPANT_ANCHOR_OFFSET_PX);
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
              : (tile.squirrelCache ? 'C' : '');
            const combinedOverlaySymbol = [mushroomOverlaySymbol, featureOverlaySymbol].filter(Boolean).join('');
            const rockSprite = tile.rockType ? getRockSpriteFrame(tile.rockType) : null;
            const grassSprite = !tile.waterType ? getTerrainSpriteFrame('grass') : null;
            const dirtSprite = !tile.waterType ? getTerrainSpriteFrame('dirt') : null;
            const waterSprite = tile.waterType ? getTerrainSpriteFrame('water') : null;
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
                    )}
                  />
                ) : null}
                {combinedOverlaySymbol ? (
                  <span className="iso-mushroom-overlay" style={{ left: `${screenX}px`, top: `${groundY - 22}px` }}>
                    {combinedOverlaySymbol}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (rendererMode === 'game') {
    return (
      <main className="app app-game-mode">
        <button
          type="button"
          className="game-mode-toggle"
          onClick={() => setRendererMode('observer')}
        >
          Switch to Debug View
        </button>
        <section className="game-stage">
          {renderIsometricPlayView()}
        </section>
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
          <button type="button" onClick={initializeFromSeed}>Generate Map</button>
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
