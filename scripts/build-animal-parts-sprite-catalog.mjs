#!/usr/bin/env node
/**
 * Rasterize `data/sprite_sheets/animal_parts/atlas.json` + merged .svg
 * → `public/sprite_sheets/animal_parts.png` + `animal_parts_world.png`
 * and generate `src/game/animalPartsSpriteCatalog.source.mjs`.
 *
 * Frame `spriteId` must be `speciesId_partId` (underscores) matching inventory item
 * `speciesId:partId` (e.g. `catostomus_commersonii_meat` → `catostomus_commersonii:meat`).
 * Species id is resolved as the longest matching prefix from `data/animals/<id>/animal.json` files.
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
const SHEET_DIR = path.join(ROOT, 'data', 'sprite_sheets', 'animal_parts');
const ANIMALS_DIR = path.join(ROOT, 'data', 'animals');
const PUBLIC_SHEET_DIR = path.join(ROOT, 'public', 'sprite_sheets');
const PNG_BASENAME = 'animal_parts.png';
const PNG_WORLD_BASENAME = 'animal_parts_world.png';
const OUTPUT_CATALOG = path.join(ROOT, 'src', 'game', 'animalPartsSpriteCatalog.source.mjs');
const ALPHA_CACHE = path.join(ROOT, '.cache', 'animal-parts-sprite-alpha-cache.json');

const PUBLIC_URL_PATH = '/sprite_sheets/animal_parts.png';

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

function listAnimalSpeciesIds() {
  if (!fs.existsSync(ANIMALS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(ANIMALS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(ANIMALS_DIR, e.name, 'animal.json')))
    .map((e) => e.name)
    .sort((a, b) => b.length - a.length);
}

/**
 * @param {string} spriteId
 * @param {string[]} speciesIdsLongestFirst
 * @returns {string | null} item id "species:part" or null
 */
function spriteIdToAnimalPartItemId(spriteId, speciesIdsLongestFirst) {
  if (typeof spriteId !== 'string' || !spriteId) {
    return null;
  }
  for (const speciesId of speciesIdsLongestFirst) {
    const withUnderscore = `${speciesId}_`;
    if (spriteId.startsWith(withUnderscore)) {
      const partId = spriteId.slice(withUnderscore.length);
      if (partId) {
        return `${speciesId}:${partId}`;
      }
    }
  }
  return null;
}

function writeEmptyCatalog(message) {
  if (message) {
    // eslint-disable-next-line no-console
    console.log(`[build-animal-parts-sprite-catalog] ${message}`);
  }
  const out =
    'const ANIMAL_PARTS_SPRITE_CATALOG_SOURCE = {};\n\nexport default ANIMAL_PARTS_SPRITE_CATALOG_SOURCE;\n';
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Wrote empty animal parts sprite catalog: ${OUTPUT_CATALOG}`);
}

async function main() {
  if (!fs.existsSync(SHEET_DIR)) {
    writeEmptyCatalog(`No ${path.relative(ROOT, SHEET_DIR)} — skipping animal parts sheet build.`);
    return;
  }

  const svgAtlas = readSvgAtlasIfPresent(SHEET_DIR);
  if (!svgAtlas) {
    writeEmptyCatalog(
      `No valid ${SVG_ATLAS_JSON} (format SVG) in ${path.relative(ROOT, SHEET_DIR)} — skipping.`,
    );
    return;
  }

  const speciesIds = listAnimalSpeciesIds();
  if (speciesIds.length === 0) {
    writeEmptyCatalog(`No species under ${path.relative(ROOT, ANIMALS_DIR)} — skipping.`);
    return;
  }

  const texture = svgAtlas.json.textures[0];
  const frames = texture.frames || [];
  for (const f of frames) {
    if (typeof f?.spriteId !== 'string' || !f.spriteId) {
      throw new Error(
        `Animal parts SVG atlas requires every frame to have "spriteId" (got ${JSON.stringify(f)})`,
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
    throw new Error('Animal parts atlas: texture.size w/h required');
  }
  const first = frames[0];
  const cellW = Number(first?.frame?.w) || 0;
  if (!cellW) {
    throw new Error('Animal parts atlas: set frame.w on first frame for cell size');
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
  rasterizeMergedSheetLayer({
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

  const byItemId = {};
  for (const f of fullLayer.rasterFrames) {
    const spriteId = f.spriteId;
    const itemId = spriteIdToAnimalPartItemId(spriteId, speciesIds);
    if (!itemId) {
      // eslint-disable-next-line no-console
      console.warn(
        `[build-animal-parts-sprite-catalog] skip frame: cannot map spriteId to species:part (longest known species prefix) — ${spriteId}`,
      );
      continue;
    }
    if (itemId.startsWith('ap_sheet_reserved_')) {
      continue;
    }
    byItemId[itemId] = catalogEntryFromRasterFrame(
      f,
      fullLayer.opaqueByKey,
      spriteId,
      fullLayer.pngDimensions,
      fullLayer.rasterToDisplay,
      PUBLIC_URL_PATH,
    );
  }

  const out = `const ANIMAL_PARTS_SPRITE_CATALOG_SOURCE = ${JSON.stringify(byItemId, null, 2)};\n\nexport default ANIMAL_PARTS_SPRITE_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `[build-animal-parts-sprite-catalog] Wrote ${Object.keys(byItemId).length} frames → ${path.relative(ROOT, OUTPUT_CATALOG)} and ${PUBLIC_URL_PATH} (+ world ${PNG_WORLD_BASENAME})`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
