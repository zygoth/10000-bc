#!/usr/bin/env node
/**
 * Missing sprite / art pipeline report for asset generation and migration tracking.
 *
 * Run from repo root:
 *   npm run sprites:missing
 *
 * Writes: temp/missing-sprites-report.json (includes authoringIntegration: drop paths + npm refresh for gen-AI workflows)
 * See: docs/sprite_missing_report.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeAtlasJsonFile,
  hasLegacyAtlas,
  readJson,
  readSvgAtlasIfPresent,
  resolveMergedSvgFile,
  SVG_ATLAS_JSON,
} from './lib/plantSvgAtlasProbe.mjs';
import { ANIMAL_CATALOG } from '../src/game/animalCatalog.mjs';
import { ITEM_CATALOG } from '../src/game/itemCatalog.mjs';
import { resolveInventoryItemSpriteFrame } from '../src/game/inventoryItemSpriteResolve.mjs';
import { GROUND_FUNGUS_CATALOG } from '../src/game/groundFungusCatalog.mjs';
import {
  getDeadLogSpriteFrame,
  getRockSpriteFrame,
  getTerrainSpriteFrame,
} from '../src/game/plantSpriteCatalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const PLANTS_DIR = path.join(repoRoot, 'data', 'plants');
const DATA_ISOMETRIC_SPRITES_DIR = path.join(repoRoot, 'data', 'isometric_sprites');
const PUBLIC_ROOT = path.join(repoRoot, 'public');
const TEMP_DIR = path.join(repoRoot, 'temp');
const OUT_REPORT = path.join(TEMP_DIR, 'missing-sprites-report.json');
const MANIFEST_PATH = path.join(repoRoot, 'src', 'spriteAssetManifest.json');
const UNIVERSAL_DIR = path.join(PLANTS_DIR, 'universal');
const UNIVERSAL_DEAD_TREE_SPRITE = 'dead_tree.png';

/** Catalog-only debug items — no dedicated sprites; use real item art or HUD text in tests. */
const DEBUG_ITEM_PREFIX = 'debug:';
const WATERSKIN_ITEM_RE = /^tool:waterskin/;
/** Inventory icon still needed; placed appearance tracked under `worldEntitySpriteQueue` tile_feature rows. */
const PLACEABLE_TOOL_TILE_FEATURE = [
  { inventoryItemId: 'tool:leaching_basket', tileFeatureManifestId: 'feature.leaching_basket' },
  { inventoryItemId: 'tool:fish_trap_weir', tileFeatureManifestId: 'trap.fish_trap_weir' },
];

/** Sheets not in world manifest — plants, terrain PNG pipeline, fungus. */
const EXTENDED_SPRITE_SHEETS = {
  species_plants: {
    label: 'Species plants (per-folder SVG)',
    description: 'Each species has its own data/plants/<species_id>/atlas.json + merged SVG — not one global atlas.',
    authoringPathHint: 'data/plants/<species_id>/',
    atlasAuthoringHint: 'Same as juglans_nigra: atlas.json format SVG + one merged .svg per species.',
  },
  terrain: {
    label: 'Terrain and iso base',
    description: 'Half-cubes, water, ice, rocks, dead-tree raster under public/isometric_sprites and data/isometric_sprites.',
    authoringPathHint: 'data/isometric_sprites/',
    atlasAuthoringHint: 'Future: optional merged SVG atlas for terrain; today PNG source → public copy.',
  },
  ground_fungus: {
    label: 'Ground fungus',
    description:
      'Per species: (1) inventory/HUD for `ground_fungus:<species_id>:fruiting_body` and (2) a distinct zone / iso tile overlay for the fruiting tile — two frames in one merged atlas (or split sheets; see row `kind`).',
    authoringPathHint: 'data/sprite_sheets/ground_fungus/',
    atlasAuthoringHint:
      'Suggested `spriteId`s: item slug from inventory id (colons → underscores) for HUD; `<species_id>_zone_tile` for the on-map zone sprite.',
  },
  animal_derived: {
    label: 'Animal carcasses & parts (per species)',
    description:
      'Inventory item IDs are `${speciesId}:carcass`, `${speciesId}:fish_carcass` (fish), and `${speciesId}:${partId}` from each species parts[] — not listed in itemCatalog.mjs.',
    authoringPathHint: 'data/sprite_sheets/animal_parts/',
    atlasAuthoringHint:
      'One crafting_intermediates-style atlas, or per-clade sheets; suggestedAtlasSpriteId = speciesId_partId with colons → underscores.',
  },
};

function inventoryCategoryToSpriteSheet(category) {
  if (category === 'tool') {
    return 'tools';
  }
  if (category === 'food' || category === 'intermediate') {
    return 'crafting_intermediates';
  }
  return 'crafting_intermediates';
}

function suggestedAtlasSpriteIdFromItemId(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }
  return itemId.replace(/:/g, '_');
}

/**
 * Match inventory UI: same as {@link resolveInventoryItemSpriteFrame} (plant parts, tools, animal sheet, crafting).
 */
function itemCatalogItemHasInventorySprite(itemId) {
  return Boolean(resolveInventoryItemSpriteFrame(itemId));
}

function suggestedAtlasSpriteIdFromManifestId(manifestId) {
  if (typeof manifestId !== 'string' || !manifestId) {
    return null;
  }
  return manifestId.replace(/\./g, '_');
}

function groundFungusFruitingBodyItemId(speciesId) {
  return `ground_fungus:${speciesId}:fruiting_body`;
}

function suggestedGroundFungusZoneTileSpriteId(speciesId) {
  return `${speciesId}_zone_tile`;
}

function buildGroundFungusAtlasIdSet(groundFungusAuthoringDir) {
  const svg = readSvgAtlasIfPresent(groundFungusAuthoringDir);
  if (!svg) {
    return null;
  }
  return new Set(
    svg.texture.frames
      .map((fr) => (typeof fr?.spriteId === 'string' ? fr.spriteId : ''))
      .filter(Boolean),
  );
}

function groundFungusInventorySpriteSatisfied(itemId, atlasIdSet) {
  if (resolveInventoryItemSpriteFrame(itemId)) {
    return true;
  }
  const sid = suggestedAtlasSpriteIdFromItemId(itemId);
  if (atlasIdSet && sid && atlasIdSet.has(sid)) {
    return true;
  }
  return false;
}

function groundFungusTileSpriteSatisfied(speciesId, atlasIdSet) {
  const sid = suggestedGroundFungusZoneTileSpriteId(speciesId);
  return Boolean(atlasIdSet && atlasIdSet.has(sid));
}

/**
 * Runtime inventory IDs from animals — `${speciesId}:carcass` / `:fish_carcass` and each `parts[].id` — omitted from itemCatalog.mjs.
 */
function collectAnimalDerivedInventoryRows() {
  const rows = [];
  for (const animal of ANIMAL_CATALOG) {
    const speciesId = animal.id;
    const isFish = animal.animalClass === 'fish';
    for (const part of animal.parts || []) {
      const partId = typeof part?.id === 'string' ? part.id : '';
      if (!partId) {
        continue;
      }
      rows.push({
        itemId: `${speciesId}:${partId}`,
        speciesId,
        animalItemKind: 'part',
        partId,
        animalClass: animal.animalClass ?? null,
      });
    }
    if (isFish) {
      rows.push({
        itemId: `${speciesId}:fish_carcass`,
        speciesId,
        animalItemKind: 'fish_carcass',
        partId: null,
        animalClass: animal.animalClass ?? null,
      });
    } else {
      rows.push({
        itemId: `${speciesId}:carcass`,
        speciesId,
        animalItemKind: 'carcass',
        partId: null,
        animalClass: animal.animalClass ?? null,
      });
    }
  }
  return rows;
}

function mergeSpriteSheetRegistry(manifestSheets) {
  return { ...(manifestSheets || {}), ...EXTENDED_SPRITE_SHEETS };
}

/**
 * Tells image/model pipelines (and humans) where to place outputs so a follow-up `npm` step can integrate them.
 * @param {string} absoluteRepositoryRoot - Resolved project root; sprite gen may run in another working directory and must copy here.
 */
function buildAuthoringIntegrationBlock(registry, absoluteRepositoryRoot) {
  const absRoot = path.resolve(absoluteRepositoryRoot);

  function joinRepoRelative(repoRelativePath) {
    const rel = String(repoRelativePath).replace(/^\//, '').replace(/\\+/g, '/');
    if (!rel) {
      return absRoot;
    }
    return path.join(absRoot, ...rel.split('/').filter(Boolean));
  }

  const dropPaths = Object.entries(registry || {})
    .map(([id, meta]) => {
      const raw = meta?.authoringPathHint;
      const dropPath = typeof raw === 'string' ? raw.replace(/\/$/, '') : null;
      if (!dropPath) {
        return null;
      }
      return {
        spriteSheet: id,
        label: meta.label || id,
        dropPath,
        dropPathAbsolute: joinRepoRelative(dropPath),
        details: meta.atlasAuthoringHint || meta.description || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.spriteSheet.localeCompare(b.spriteSheet));

  return {
    repositoryRootPath: absRoot,
    forGenerationAi: [
      'Sprite tools often run in a different folder from this game repo. `repositoryRootPath` is the **absolute path to the root of this project** — copy generated `atlas.json` and the merged `.svg` into `dropPath` under that root, or use `dropPathAbsolute` as the full destination directory.',
      'When finished generating a merged SVG sheet: write `atlas.json` (TexturePacker-style, `textures[0].format: "SVG"`) and the single merged `.svg` into the `dropPath` (relative to the repo) for the `spriteSheet` you are working on, or the matching `dropPathAbsolute`. Do not use only `temp/` for the final handoff.',
      'Per-species plant art: `data/plants/<species_id>/` (same `atlas.json` + merged `.svg` as `juglans_nigra`).',
      'Category / inventory atlases: under `data/sprite_sheets/<id>/` (e.g. `tools`, `crafting_intermediates`, `actors`, `placeables`). The game does not read `temp/` for these pipelines.',
      'After files are in place, run a refresh command **from `repositoryRootPath`** so `public/` PNGs and generated `src/game/*.source.mjs` update (see `refreshCommands`).',
      'World manifest entries with a fixed `expectedPath` in `src/spriteAssetManifest.json`: place the final raster (or the path your pipeline uses) to match that path under this repo’s `public/`, as declared.',
    ],
    requiredFiles: [
      'atlas.json',
      'One merged .svg referenced by the atlas (`textures[0].image` and/or per-frame `filename` fields, depending on your exporter).',
    ],
    dropPaths,
    refreshCommands: {
      runFrom: absRoot,
      toolSpritesOnly: 'npm run tool-sprites:build',
      craftingIntermediateSpritesOnly: 'npm run crafting-intermediate-sprites:build',
      allCatalogsIncludingPlantsAndTools: 'npm run catalog:build',
      startDevServerAlsoRebuildsToolSheet:
        'npm start (runs `prestart` → tool, camp, and crafting_intermediates sheet builds before the React app)',
    },
  };
}

function makeSheetAggregation(registry, sheetId) {
  const meta = registry[sheetId] || {};
  const hint = typeof meta.authoringPathHint === 'string' ? meta.authoringPathHint : '';
  return {
    spriteSheet: sheetId,
    label: meta.label ?? sheetId,
    description: meta.description ?? null,
    authoringPathHint: hint || null,
    atlasAuthoringHint: meta.atlasAuthoringHint ?? null,
    suggestedAtlasJsonPath: hint ? `${hint}atlas.json` : null,
    suggestedMergedSvgGlob: hint ? `${hint}*.svg` : null,
    rows: [],
  };
}

function validateManifestSpriteSheets(manifest) {
  const reg = manifest.spriteSheets || {};
  const ids = Object.keys(reg);
  if (ids.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[sprites:missing] spriteAssetManifest.json has no spriteSheets registry (expected v2).');
    return;
  }
  for (const entry of manifest.entries || []) {
    const sid = entry.spriteSheet;
    if (!sid || !reg[sid]) {
      // eslint-disable-next-line no-console
      console.warn(`[sprites:missing] manifest entry ${entry.id} missing or unknown spriteSheet: ${sid}`);
    }
  }
}

function relPosix(absPath) {
  if (typeof absPath !== 'string' || !absPath) {
    return absPath;
  }
  const r = path.relative(repoRoot, absPath);
  return r.split(path.sep).join('/');
}

function listPlantDirectories() {
  if (!fs.existsSync(PLANTS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(PLANTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PLANTS_DIR, entry.name))
    .filter((dirPath) => fs.existsSync(path.join(dirPath, 'plant.json')));
}

function publicFileExists(urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) {
    return false;
  }
  const diskPath = path.join(PUBLIC_ROOT, urlPath.replace(/^\//, ''));
  return fs.existsSync(diskPath);
}

function dataIsometricBasename(urlPath) {
  if (typeof urlPath !== 'string') {
    return null;
  }
  const base = path.basename(urlPath);
  return base || null;
}

function classifyPlantSpecies(plantDir, speciesId) {
  const atlasMeta = describeAtlasJsonFile(plantDir);
  const svg = readSvgAtlasIfPresent(plantDir);

  if (svg) {
    const t0 = svg.texture;
    const badFrames = t0.frames.filter((f) => !f?.spriteId || String(f.spriteId).trim() === '');
    if (badFrames.length > 0) {
      return {
        speciesId,
        status: 'missing_sprite_ids',
        atlasJsonPath: relPosix(svg.path),
        mergedSvgPath: null,
        legacyAtlas: hasLegacyAtlas(plantDir),
        framesWithoutSpriteId: badFrames.length,
      };
    }
    const merged = resolveMergedSvgFile(plantDir, t0);
    if (!merged) {
      return {
        speciesId,
        status: 'missing_merged_svg',
        atlasJsonPath: relPosix(svg.path),
        mergedSvgPath: null,
        legacyAtlas: hasLegacyAtlas(plantDir),
      };
    }

    let spriteListCoverage = null;
    const spriteListPath = path.join(plantDir, 'sprite_list.json');
    if (fs.existsSync(spriteListPath)) {
      try {
        const list = readJson(spriteListPath);
        const expectedIds = Array.isArray(list)
          ? list.map((e) => e?.id).filter((id) => typeof id === 'string' && id)
          : [];
        const atlasIds = new Set(
          t0.frames.map((f) => f?.spriteId).filter((id) => typeof id === 'string' && id),
        );
        const missingInAtlas = expectedIds.filter((id) => !atlasIds.has(id));
        spriteListCoverage = {
          spriteListPath: relPosix(spriteListPath),
          expectedCount: expectedIds.length,
          missingInAtlas,
        };
      } catch {
        spriteListCoverage = { spriteListPath: relPosix(spriteListPath), error: 'parse_failed' };
      }
    }

    return {
      speciesId,
      status: 'ok',
      atlasJsonPath: relPosix(svg.path),
      mergedSvgPath: relPosix(merged),
      legacyAtlas: hasLegacyAtlas(plantDir),
      spriteListCoverage,
    };
  }

  if (atlasMeta.exists && atlasMeta.parseError) {
    return {
      speciesId,
      status: 'invalid_svg_atlas',
      detail: 'atlas.json exists but failed to parse',
      legacyAtlas: hasLegacyAtlas(plantDir),
    };
  }

  if (atlasMeta.exists && atlasMeta.format && String(atlasMeta.format).toUpperCase() !== 'SVG') {
    return {
      speciesId,
      status: 'invalid_svg_atlas',
      detail: `atlas.json format is "${atlasMeta.format}", expected SVG`,
      frameCount: atlasMeta.frameCount,
      legacyAtlas: hasLegacyAtlas(plantDir),
      atlasJsonPath: relPosix(path.join(plantDir, SVG_ATLAS_JSON)),
    };
  }

  if (atlasMeta.exists && atlasMeta.frameCount === 0) {
    return {
      speciesId,
      status: 'invalid_svg_atlas',
      detail: 'atlas.json has no frames',
      legacyAtlas: hasLegacyAtlas(plantDir),
      atlasJsonPath: relPosix(path.join(plantDir, SVG_ATLAS_JSON)),
    };
  }

  if (hasLegacyAtlas(plantDir)) {
    return {
      speciesId,
      status: 'legacy_png_only',
      legacyAtlas: true,
      atlasJsonPath: atlasMeta.exists ? relPosix(path.join(plantDir, SVG_ATLAS_JSON)) : null,
    };
  }

  return {
    speciesId,
    status: 'no_atlas_no_legacy',
    legacyAtlas: false,
  };
}

function buildTileAndRockRefs() {
  const refs = [];
  const dead = getDeadLogSpriteFrame();
  if (dead?.imagePath) {
    refs.push({ kind: 'dead_log', key: 'dead_tree', imagePath: dead.imagePath });
  }
  for (const key of ['grass', 'dirt', 'water', 'ice']) {
    const s = getTerrainSpriteFrame(key);
    if (s?.imagePath) {
      refs.push({ kind: 'terrain', key, imagePath: s.imagePath });
    }
  }
  for (const key of ['glacial_erratic', 'flint_cobble_scatter']) {
    const s = getRockSpriteFrame(key);
    if (s?.imagePath) {
      refs.push({ kind: 'rock', key, imagePath: s.imagePath });
    }
  }
  return refs;
}

function loadWorldManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { version: 0, entries: [], error: 'manifest_missing' };
  }
  try {
    return readJson(MANIFEST_PATH);
  } catch {
    return { version: 0, entries: [], error: 'manifest_parse_failed' };
  }
}

function main() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const plantDirs = listPlantDirectories();
  const plantSpeciesSvg = [];

  for (const plantDir of plantDirs) {
    let speciesId = path.basename(plantDir);
    try {
      const plant = readJson(path.join(plantDir, 'plant.json'));
      if (plant?.id) {
        speciesId = plant.id;
      }
    } catch {
      // keep basename
    }
    plantSpeciesSvg.push(classifyPlantSpecies(plantDir, speciesId));
  }

  const universalRows = [];
  const deadPngPath = path.join(UNIVERSAL_DIR, UNIVERSAL_DEAD_TREE_SPRITE);
  const universalSvg = fs.existsSync(UNIVERSAL_DIR) ? readSvgAtlasIfPresent(UNIVERSAL_DIR) : null;
  if (fs.existsSync(UNIVERSAL_DIR)) {
    const merged = universalSvg ? resolveMergedSvgFile(UNIVERSAL_DIR, universalSvg.texture) : null;
    let status = 'no_svg_pipeline';
    if (universalSvg && merged) {
      status = 'ok';
    } else if (universalSvg && !merged) {
      status = 'missing_merged_svg';
    } else if (fs.existsSync(deadPngPath)) {
      status = 'legacy_png_only';
    }
    universalRows.push({
      id: 'universal.dead_log',
      deadTreePngPath: relPosix(deadPngPath),
      deadTreePngExists: fs.existsSync(deadPngPath),
      svgAtlasPath: relPosix(path.join(UNIVERSAL_DIR, SVG_ATLAS_JSON)),
      svgAtlasExists: fs.existsSync(path.join(UNIVERSAL_DIR, SVG_ATLAS_JSON)),
      mergedSvgPath: merged ? relPosix(merged) : null,
      status,
      notes: 'Target: SVG + atlas.json like species; legacy dead_tree.png until then.',
    });
  } else {
    universalRows.push({
      id: 'universal.dead_log',
      status: 'universal_dir_missing',
      deadTreePngPath: relPosix(deadPngPath),
    });
  }

  const isometricOrTileArt = buildTileAndRockRefs().map((ref) => {
    const base = dataIsometricBasename(ref.imagePath);
    const dataPath = base ? path.join(DATA_ISOMETRIC_SPRITES_DIR, base) : null;
    return {
      ...ref,
      publicExists: publicFileExists(ref.imagePath),
      dataIsometricPath: dataPath ? relPosix(dataPath) : null,
      dataIsometricExists: dataPath ? fs.existsSync(dataPath) : false,
      svgMigrationNote: 'Terrain/rocks still PNG pipeline (data/isometric_sprites → public); SVG migration TBD.',
    };
  });

  const GROUND_FUNGUS_SHEET_DIR = path.join(repoRoot, 'data', 'sprite_sheets', 'ground_fungus');
  const groundFungusAtlasIdSet = buildGroundFungusAtlasIdSet(GROUND_FUNGUS_SHEET_DIR);

  const groundFungus = GROUND_FUNGUS_CATALOG.map((f) => {
    const inventoryItemId = groundFungusFruitingBodyItemId(f.id);
    const invOk = groundFungusInventorySpriteSatisfied(inventoryItemId, groundFungusAtlasIdSet);
    const tileOk = groundFungusTileSpriteSatisfied(f.id, groundFungusAtlasIdSet);
    return {
      id: f.id,
      commonName: f.commonName || null,
      latinName: f.latinName || null,
      inventory: {
        itemId: inventoryItemId,
        hasSprite: invOk,
        suggestedAtlasSpriteId: suggestedAtlasSpriteIdFromItemId(inventoryItemId),
      },
      tile: {
        hasSprite: tileOk,
        suggestedAtlasSpriteId: suggestedGroundFungusZoneTileSpriteId(f.id),
        notes: 'On-tile zone / fruiting overlay (distinct from inventory icon).',
      },
    };
  });

  let inventoryDebugItemsSkipped = 0;
  const rawNoPlantPartSprite = [];
  for (const item of ITEM_CATALOG) {
    if (item.id.startsWith(DEBUG_ITEM_PREFIX)) {
      inventoryDebugItemsSkipped += 1;
      continue;
    }
    if (!itemCatalogItemHasInventorySprite(item.id)) {
      rawNoPlantPartSprite.push(item);
    }
  }

  const waterskinItems = rawNoPlantPartSprite.filter((i) => WATERSKIN_ITEM_RE.test(i.id));
  const placeableToolItems = rawNoPlantPartSprite.filter((i) => PLACEABLE_TOOL_TILE_FEATURE.some(
    (p) => p.inventoryItemId === i.id,
  ));

  const inventoryArtBuckets = [];

  if (waterskinItems.length > 0) {
    inventoryArtBuckets.push({
      id: 'waterskin',
      spriteSheet: 'tools',
      suggestedAtlasSpriteIds: ['tool_waterskin_empty', 'tool_waterskin_full'],
      artNeeded: ['empty', 'full'],
      notes:
        'Only two visuals: empty vs filled. Water source (river/pond/safe) is sim-only and is not shown on the sprite.',
      coversItemIds: waterskinItems.map((i) => i.id).sort(),
    });
  }

  const placeableEntries = PLACEABLE_TOOL_TILE_FEATURE
    .map(({ inventoryItemId, tileFeatureManifestId }) => {
      const row = rawNoPlantPartSprite.find((i) => i.id === inventoryItemId);
      if (!row) {
        return null;
      }
      return {
        inventoryItemId,
        name: row.name,
        tileFeatureManifestId,
        notes:
          'Inventory (and ground drop) can use the tool icon; active placement uses the tile_feature row in the manifest.',
      };
    })
    .filter(Boolean);

  if (placeableEntries.length > 0) {
    inventoryArtBuckets.push({
      id: 'placeable_tools_inventory_plus_tile_feature',
      spriteSheetInventory: 'tools',
      spriteSheetTile: 'placeables',
      entries: placeableEntries,
    });
  }

  const inventoryItemsWithoutSprite = rawNoPlantPartSprite
    .filter((i) => !WATERSKIN_ITEM_RE.test(i.id))
    .filter((i) => !PLACEABLE_TOOL_TILE_FEATURE.some((p) => p.inventoryItemId === i.id))
    .map((item) => {
      const spriteSheet = inventoryCategoryToSpriteSheet(item.category);
      return {
        itemId: item.id,
        name: item.name,
        category: item.category,
        spriteSheet,
        suggestedAtlasSpriteId: suggestedAtlasSpriteIdFromItemId(item.id),
        compileIntoAtlas: spriteSheet,
      };
    });

  const animalDerivedInventoryAll = collectAnimalDerivedInventoryRows().map((r) => ({
    ...r,
    hasInventorySprite: Boolean(resolveInventoryItemSpriteFrame(r.itemId)),
  }));
  const animalDerivedMissingSprite = animalDerivedInventoryAll.filter((r) => !r.hasInventorySprite);

  const manifest = loadWorldManifest();
  validateManifestSpriteSheets(manifest);

  const worldEntitySpriteQueue = (manifest.entries || []).map((entry) => {
    const expectedPath = typeof entry.expectedPath === 'string' ? entry.expectedPath : null;
    const url = expectedPath && expectedPath.startsWith('/') ? expectedPath : null;
    const spriteSheet = entry.spriteSheet;
    return {
      ...entry,
      publicExists: url ? publicFileExists(url) : null,
      status: !expectedPath
        ? 'path_not_declared'
        : publicFileExists(expectedPath)
          ? 'ok'
          : 'missing_file',
      suggestedAtlasSpriteId: suggestedAtlasSpriteIdFromManifestId(entry.id),
      compileIntoAtlas: typeof spriteSheet === 'string' ? spriteSheet : null,
    };
  });

  const spriteSheetRegistry = mergeSpriteSheetRegistry(manifest.spriteSheets);
  const missingArtBySpriteSheet = {};
  for (const sheetId of Object.keys(spriteSheetRegistry)) {
    missingArtBySpriteSheet[sheetId] = makeSheetAggregation(spriteSheetRegistry, sheetId);
  }

  function pushSheetRow(sheetId, row) {
    if (!missingArtBySpriteSheet[sheetId]) {
      missingArtBySpriteSheet[sheetId] = makeSheetAggregation(spriteSheetRegistry, sheetId);
    }
    missingArtBySpriteSheet[sheetId].rows.push(row);
  }

  for (const entry of worldEntitySpriteQueue) {
    const sid = entry.spriteSheet;
    if (typeof sid !== 'string') {
      continue;
    }
    pushSheetRow(sid, {
      kind: 'world_manifest',
      manifestId: entry.id,
      category: entry.category,
      stationId: entry.stationId ?? null,
      itemId: entry.itemId ?? null,
      worldPlacement: entry.worldPlacement ?? null,
      status: entry.status,
      suggestedAtlasSpriteId: entry.suggestedAtlasSpriteId,
      compileIntoAtlas: sid,
      notes: entry.notes ?? null,
    });
  }

  for (const row of inventoryItemsWithoutSprite) {
    pushSheetRow(row.spriteSheet, {
      kind: 'inventory_item',
      itemId: row.itemId,
      name: row.name,
      itemCatalogCategory: row.category,
      suggestedAtlasSpriteId: row.suggestedAtlasSpriteId,
      compileIntoAtlas: row.spriteSheet,
    });
  }

  if (inventoryArtBuckets.length > 0) {
    for (const bucket of inventoryArtBuckets) {
      if (bucket.id === 'waterskin' && bucket.spriteSheet) {
        pushSheetRow(bucket.spriteSheet, {
          kind: 'inventory_bucket',
          bucketId: bucket.id,
          spriteSheet: bucket.spriteSheet,
          artNeeded: bucket.artNeeded,
          suggestedAtlasSpriteIds: bucket.suggestedAtlasSpriteIds,
          coversItemIds: bucket.coversItemIds,
          compileIntoAtlas: bucket.spriteSheet,
          notes: bucket.notes,
        });
      }
      if (bucket.id === 'placeable_tools_inventory_plus_tile_feature') {
        for (const e of bucket.entries || []) {
          pushSheetRow(bucket.spriteSheetInventory, {
            kind: 'inventory_placeable_tool_icon',
            bucketId: bucket.id,
            itemId: e.inventoryItemId,
            name: e.name,
            tileFeatureManifestId: e.tileFeatureManifestId,
            suggestedAtlasSpriteId: suggestedAtlasSpriteIdFromItemId(e.inventoryItemId),
            compileIntoAtlas: bucket.spriteSheetInventory,
            notes: e.notes,
          });
          pushSheetRow(bucket.spriteSheetTile, {
            kind: 'tile_feature_placeable',
            bucketId: bucket.id,
            itemId: e.inventoryItemId,
            tileFeatureManifestId: e.tileFeatureManifestId,
            suggestedAtlasSpriteId: suggestedAtlasSpriteIdFromManifestId(e.tileFeatureManifestId),
            compileIntoAtlas: bucket.spriteSheetTile,
            notes: 'On-tile / active placement sprite.',
          });
        }
      }
    }
  }

  for (const p of plantSpeciesSvg) {
    if (p.status === 'ok') {
      continue;
    }
    pushSheetRow('species_plants', {
      kind: 'species_plant_svg',
      speciesId: p.speciesId,
      status: p.status,
      suggestedAtlasSpriteId: p.speciesId,
      compileIntoAtlas: 'species_plants',
      atlasJsonPath: p.atlasJsonPath ?? null,
      mergedSvgPath: p.mergedSvgPath ?? null,
      notes: 'Author in data/plants/<species_id>/; one atlas per species.',
    });
  }

  for (const u of universalRows) {
    pushSheetRow('terrain', {
      kind: 'universal_dead_log',
      id: u.id,
      status: u.status,
      suggestedAtlasSpriteId: 'universal_dead_tree',
      compileIntoAtlas: 'terrain',
      deadTreePngPath: u.deadTreePngPath ?? null,
      notes: u.notes ?? null,
    });
  }

  for (const t of isometricOrTileArt) {
    pushSheetRow('terrain', {
      kind: 'isometric_tile',
      terrainKind: t.kind,
      key: t.key,
      imagePath: t.imagePath,
      publicExists: t.publicExists,
      dataIsometricPath: t.dataIsometricPath,
      suggestedAtlasSpriteId: `${t.kind}_${t.key}`.replace(/[^a-z0-9_]/gi, '_'),
      compileIntoAtlas: 'terrain',
    });
  }

  for (const f of groundFungus) {
    if (!f.inventory.hasSprite) {
      pushSheetRow('ground_fungus', {
        kind: 'ground_fungus_inventory',
        speciesId: f.id,
        commonName: f.commonName,
        itemId: f.inventory.itemId,
        suggestedAtlasSpriteId: f.inventory.suggestedAtlasSpriteId,
        compileIntoAtlas: 'ground_fungus',
        notes: 'Inventory / HUD / ground drop; parallel to `log_fungus:<species_id>:fruiting_body`.',
      });
    }
    if (!f.tile.hasSprite) {
      pushSheetRow('ground_fungus', {
        kind: 'ground_fungus_zone_tile',
        speciesId: f.id,
        commonName: f.commonName,
        suggestedAtlasSpriteId: f.tile.suggestedAtlasSpriteId,
        compileIntoAtlas: 'ground_fungus',
        notes: f.tile.notes,
      });
    }
  }

  for (const r of animalDerivedMissingSprite) {
    pushSheetRow('animal_derived', {
      kind: 'animal_item',
      itemId: r.itemId,
      speciesId: r.speciesId,
      animalItemKind: r.animalItemKind,
      partId: r.partId,
      animalClass: r.animalClass,
      suggestedAtlasSpriteId: suggestedAtlasSpriteIdFromItemId(r.itemId),
      compileIntoAtlas: 'animal_derived',
      notes:
        r.animalItemKind === 'carcass' || r.animalItemKind === 'fish_carcass'
          ? 'Whole carcass before butchering; fish use :fish_carcass.'
          : 'Butchered part; meat/hide/etc. from species parts[].',
    });
  }

  const missingArtBySpriteSheetFiltered = Object.fromEntries(
    Object.entries(missingArtBySpriteSheet).filter(([, v]) => v.rows.length > 0),
  );

  const summary = {
    plantSpeciesTotal: plantSpeciesSvg.length,
    plantSpeciesOk: plantSpeciesSvg.filter((r) => r.status === 'ok').length,
    plantSpeciesLegacyOrMissingSvg: plantSpeciesSvg.filter((r) => r.status !== 'ok').length,
    inventoryDebugItemsSkipped,
    inventoryItemsWithoutSprite: inventoryItemsWithoutSprite.length,
    inventoryArtBuckets: inventoryArtBuckets.length,
    groundFungusSpecies: groundFungus.length,
    groundFungusMissingInventorySprite: groundFungus.filter((r) => !r.inventory.hasSprite).length,
    groundFungusMissingZoneTileSprite: groundFungus.filter((r) => !r.tile.hasSprite).length,
    worldManifestEntries: worldEntitySpriteQueue.length,
    worldManifestMissingFiles: worldEntitySpriteQueue.filter((r) => r.status === 'missing_file').length,
    worldManifestPathNotDeclared: worldEntitySpriteQueue.filter((r) => r.status === 'path_not_declared').length,
    spriteSheetCount: Object.keys(spriteSheetRegistry).length,
    spriteSheetsWithRows: Object.keys(missingArtBySpriteSheetFiltered).length,
    animalDerivedInventoryItemIds: animalDerivedInventoryAll.length,
    animalDerivedInventoryMissingSprite: animalDerivedMissingSprite.length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    authoringIntegration: buildAuthoringIntegrationBlock(spriteSheetRegistry, repoRoot),
    atlasCompilation: {
      pipeline:
        'Non-plant UI/world: author standalone SVGs per cell, pack to one merged SVG + TexturePacker-style atlas.json with format SVG (see data/plants/juglans_nigra/atlas.json).',
      perSheet: 'Use authoringPathHint on each spriteSheet; suggestedAtlasJsonPath / suggestedMergedSvgGlob are conventions.',
      speciesPlants: 'Each species keeps data/plants/<species_id>/atlas.json — not merged into global category atlases.',
      missingArtBySpriteSheet: missingArtBySpriteSheetFiltered,
    },
    spriteSheetRegistry,
    plantSpeciesSvg,
    universalAssets: universalRows,
    isometricOrTileArt,
    groundFungus,
    inventoryArtBuckets,
    inventoryItemsWithoutSprite,
    animalDerivedInventory: animalDerivedInventoryAll,
    worldEntitySpriteQueue,
    manifestSource: path.relative(repoRoot, MANIFEST_PATH).replace(/\\/g, '/'),
  };

  fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2), 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${OUT_REPORT}`);
  // eslint-disable-next-line no-console
  console.log(
    `Plants: ${summary.plantSpeciesOk}/${summary.plantSpeciesTotal} SVG pipeline OK; `
      + `${summary.plantSpeciesLegacyOrMissingSvg} legacy or incomplete.`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Inventory rows (excl. debug + bucketed waterskin/placeable tools): ${summary.inventoryItemsWithoutSprite}; `
      + `buckets: ${summary.inventoryArtBuckets}; debug catalog items skipped: ${summary.inventoryDebugItemsSkipped}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Ground fungus: ${summary.groundFungusSpecies} species; `
      + `${summary.groundFungusMissingInventorySprite} missing inventory sprite; `
      + `${summary.groundFungusMissingZoneTileSprite} missing zone tile sprite.`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Animal inventory item IDs (carcass + parts): ${summary.animalDerivedInventoryItemIds} total, `
      + `${summary.animalDerivedInventoryMissingSprite} missing HUD sprite (see animal_derived in missingArtBySpriteSheet).`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `World manifest: ${summary.worldManifestPathNotDeclared} entries without expectedPath; `
      + `${summary.worldManifestMissingFiles} declared paths missing on disk.`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Atlas compile hints: ${summary.spriteSheetsWithRows} sprite sheets with pending rows (see atlasCompilation.missingArtBySpriteSheet).`,
  );
}

main();
