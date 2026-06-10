#!/usr/bin/env node
/**
 * Rasterize `data/sprite_sheets/ground_fungus/atlas.json` + merged .svg →
 * `public/sprite_sheets/ground_fungus.png` (inventory) + `ground_fungus_world.png` (zone / iso)
 * and generate `src/game/groundFungusSpriteCatalog.source.mjs`.
 *
 * `spriteId` `ground_fungus_<speciesId>_fruiting_body` → item id `ground_fungus:<speciesId>:fruiting_body`
 * `spriteId` `<speciesId>_zone_tile` → zone rendering keyed by `speciesId`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSvgAtlasIfPresent, resolveMergedSvgFile, SVG_ATLAS_JSON } from './lib/plantSvgAtlasProbe.mjs';
import {
  SVG_RASTER_CELL_PX,
  SVG_RASTER_CELL_PX_WORLD,
  catalogEntryFromRasterFrame,
  rasterizeMergedSheetLayer,
} from './lib/svgSheetRaster.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SHEET_DIR = path.join(ROOT, 'data', 'sprite_sheets', 'ground_fungus');
const PUBLIC_SHEET_DIR = path.join(ROOT, 'public', 'sprite_sheets');
const PNG_BASENAME = 'ground_fungus.png';
const PNG_WORLD_BASENAME = 'ground_fungus_world.png';
const OUTPUT_CATALOG = path.join(ROOT, 'src', 'game', 'groundFungusSpriteCatalog.source.mjs');
const ALPHA_CACHE = path.join(ROOT, '.cache', 'ground-fungus-sprite-alpha-cache.json');
const PUBLIC_URL_PATH = '/sprite_sheets/ground_fungus.png';
const PUBLIC_WORLD_URL_PATH = '/sprite_sheets/ground_fungus_world.png';

function loadAlphaCache() {
  if (!fs.existsSync(ALPHA_CACHE)) {
    return { files: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(ALPHA_CACHE, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { files: {} };
}

function saveAlphaCache(cache) {
  const dir = path.dirname(ALPHA_CACHE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ALPHA_CACHE, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * `ground_fungus_agaricus_campestris_fruiting_body` → `ground_fungus:agaricus_campestris:fruiting_body`
 * @param {string} spriteId
 * @returns {string | null}
 */
function spriteIdToInventoryItemId(spriteId) {
  if (typeof spriteId !== 'string' || !spriteId.startsWith('ground_fungus_') || !spriteId.endsWith('_fruiting_body')) {
    return null;
  }
  const inner = spriteId.slice('ground_fungus_'.length, -'_fruiting_body'.length);
  if (!inner) {
    return null;
  }
  return `ground_fungus:${inner}:fruiting_body`;
}

/**
 * `agaricus_campestris_zone_tile` → `agaricus_campestris`
 * @param {string} spriteId
 * @returns {string | null}
 */
function spriteIdToZoneTileSpeciesId(spriteId) {
  if (typeof spriteId !== 'string' || !spriteId.endsWith('_zone_tile')) {
    return null;
  }
  const speciesId = spriteId.replace(/_zone_tile$/, '');
  return speciesId || null;
}

function writeEmptyCatalog(message) {
  if (message) {
    // eslint-disable-next-line no-console
    console.log(`[build-ground-fungus-sprite-catalog] ${message}`);
  }
  const out = `${[
    'export const GROUND_FUNGUS_INVENTORY_SPRITE_CATALOG_SOURCE = {};',
    'export const GROUND_FUNGUS_ZONE_TILE_SPRITE_CATALOG_SOURCE = {};',
  ].join('\n')}\n`;
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Wrote empty ground fungus sprite catalog: ${OUTPUT_CATALOG}`);
}

async function main() {
  if (!fs.existsSync(SHEET_DIR)) {
    writeEmptyCatalog(`No ${path.relative(ROOT, SHEET_DIR)} — skipping.`);
    return;
  }

  const svgAtlas = readSvgAtlasIfPresent(SHEET_DIR);
  if (!svgAtlas) {
    writeEmptyCatalog(
      `No valid ${SVG_ATLAS_JSON} (format SVG) in ${path.relative(ROOT, SHEET_DIR)} — skipping.`,
    );
    return;
  }

  const texture = svgAtlas.json.textures[0];
  const frames = texture.frames || [];
  for (const f of frames) {
    if (typeof f?.spriteId !== 'string' || !f.spriteId) {
      throw new Error(
        `Ground fungus SVG atlas requires every frame to have "spriteId" (got ${JSON.stringify(f)})`,
      );
    }
  }

  const svgFile = resolveMergedSvgFile(SHEET_DIR, texture);
  if (!svgFile) {
    throw new Error(
      `Could not find merged .svg in ${SHEET_DIR} for texture.image="${texture?.image || ''}"`,
    );
  }

  const logicalW = Number(texture.size?.w) || 0;
  const logicalH = Number(texture.size?.h) || 0;
  if (!logicalW || !logicalH) {
    throw new Error('Ground fungus atlas: texture.size w/h required');
  }
  const first = frames[0];
  const cellW = Number(first?.frame?.w) || 0;
  if (!cellW) {
    throw new Error('Ground fungus atlas: set frame.w on first frame for cell size');
  }

  if (!fs.existsSync(PUBLIC_SHEET_DIR)) {
    fs.mkdirSync(PUBLIC_SHEET_DIR, { recursive: true });
  }

  const spriteAlphaCache = loadAlphaCache();
  const pngPath = path.join(PUBLIC_SHEET_DIR, PNG_BASENAME);
  const pngWorldPath = path.join(PUBLIC_SHEET_DIR, PNG_WORLD_BASENAME);

  const fullLayer = rasterizeMergedSheetLayer({
    svgFile,
    logicalW,
    logicalH,
    frames,
    cellW,
    cellPx: SVG_RASTER_CELL_PX,
    pngPath,
    alphaCache: spriteAlphaCache,
  });
  const worldLayer = rasterizeMergedSheetLayer({
    svgFile,
    logicalW,
    logicalH,
    frames,
    cellW,
    cellPx: SVG_RASTER_CELL_PX_WORLD,
    pngPath: pngWorldPath,
    alphaCache: spriteAlphaCache,
  });
  saveAlphaCache(spriteAlphaCache);

  const byInventoryItemId = {};
  const byZoneTileSpecies = {};

  for (const f of fullLayer.rasterFrames) {
    const key = f.spriteId;
    const itemId = spriteIdToInventoryItemId(key);
    if (itemId) {
      byInventoryItemId[itemId] = catalogEntryFromRasterFrame(
        f,
        fullLayer.opaqueByKey,
        key,
        fullLayer.pngDimensions,
        fullLayer.rasterToDisplay,
        PUBLIC_URL_PATH,
      );
    }
  }

  for (const f of worldLayer.rasterFrames) {
    const key = f.spriteId;
    const zSpecies = spriteIdToZoneTileSpeciesId(key);
    if (zSpecies) {
      byZoneTileSpecies[zSpecies] = catalogEntryFromRasterFrame(
        f,
        worldLayer.opaqueByKey,
        key,
        worldLayer.pngDimensions,
        worldLayer.rasterToDisplay,
        PUBLIC_WORLD_URL_PATH,
      );
    }
  }

  for (const f of fullLayer.rasterFrames) {
    const key = f.spriteId;
    if (!spriteIdToInventoryItemId(key) && !spriteIdToZoneTileSpeciesId(key)) {
      // eslint-disable-next-line no-console
      console.warn(`[build-ground-fungus-sprite-catalog] skip unclassified spriteId: ${key}`);
    }
  }

  const out = `export const GROUND_FUNGUS_INVENTORY_SPRITE_CATALOG_SOURCE = ${JSON.stringify(
    byInventoryItemId,
    null,
    2,
  )};\n\nexport const GROUND_FUNGUS_ZONE_TILE_SPRITE_CATALOG_SOURCE = ${JSON.stringify(
    byZoneTileSpecies,
    null,
    2,
  )};\n`;
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `[build-ground-fungus-sprite-catalog] Wrote ${Object.keys(byInventoryItemId).length} inventory + `
      + `${Object.keys(byZoneTileSpecies).length} zone-tile → ${path.relative(ROOT, OUTPUT_CATALOG)} and ${PUBLIC_URL_PATH} + ${PUBLIC_WORLD_URL_PATH}`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
