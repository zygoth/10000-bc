#!/usr/bin/env node
/**
 * Rasterize `data/sprite_sheets/crafting_intermediates/atlas.json` + merged .svg
 * → `public/sprite_sheets/crafting_intermediates.png` + `crafting_intermediates_world.png`
 * and generate `src/game/craftingIntermediateSpriteCatalog.source.mjs` (catalog uses full-res for inventory).
 *
 * Frame `spriteId` must match item catalog `id` (e.g. `cordage`, `dried_hide`, `tree_sugar`).
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
const SHEET_DIR = path.join(ROOT, 'data', 'sprite_sheets', 'crafting_intermediates');
const PUBLIC_SHEET_DIR = path.join(ROOT, 'public', 'sprite_sheets');
const PNG_BASENAME = 'crafting_intermediates.png';
const PNG_WORLD_BASENAME = 'crafting_intermediates_world.png';
const OUTPUT_CATALOG = path.join(ROOT, 'src', 'game', 'craftingIntermediateSpriteCatalog.source.mjs');
const ALPHA_CACHE = path.join(ROOT, '.cache', 'crafting-intermediate-sprite-alpha-cache.json');

const PUBLIC_URL_PATH = '/sprite_sheets/crafting_intermediates.png';

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

function writeEmptyCatalog(message) {
  if (message) {
    // eslint-disable-next-line no-console
    console.log(`[build-crafting-intermediate-sprite-catalog] ${message}`);
  }
  const out =
    'const CRAFTING_INTERMEDIATE_SPRITE_CATALOG_SOURCE = {};\n\nexport default CRAFTING_INTERMEDIATE_SPRITE_CATALOG_SOURCE;\n';
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Wrote empty crafting intermediate sprite catalog: ${OUTPUT_CATALOG}`);
}

async function main() {
  if (!fs.existsSync(SHEET_DIR)) {
    writeEmptyCatalog(`No ${path.relative(ROOT, SHEET_DIR)} — skipping crafting intermediate sheet build.`);
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
        `Crafting intermediates SVG atlas requires every frame to have "spriteId" (got ${JSON.stringify(f)})`,
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
    throw new Error('Crafting intermediates atlas: texture.size w/h required');
  }
  const first = frames[0];
  const cellW = Number(first?.frame?.w) || 0;
  if (!cellW) {
    throw new Error('Crafting intermediates atlas: set frame.w on first frame for cell size');
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
    const itemId = f.spriteId;
    if (typeof itemId !== 'string' || !itemId) {
      continue;
    }
    if (itemId.startsWith('ci_sheet_reserved_')) {
      continue;
    }
    byItemId[itemId] = catalogEntryFromRasterFrame(
      f,
      fullLayer.opaqueByKey,
      itemId,
      fullLayer.pngDimensions,
      fullLayer.rasterToDisplay,
      PUBLIC_URL_PATH,
    );
  }

  const out = `const CRAFTING_INTERMEDIATE_SPRITE_CATALOG_SOURCE = ${JSON.stringify(byItemId, null, 2)};\n\nexport default CRAFTING_INTERMEDIATE_SPRITE_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `[build-crafting-intermediate-sprite-catalog] Wrote ${Object.keys(byItemId).length} frames → ${path.relative(ROOT, OUTPUT_CATALOG)} and ${PUBLIC_URL_PATH} (+ world ${PNG_WORLD_BASENAME})`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
