#!/usr/bin/env node
/**
 * Rasterize `data/sprite_sheets/camp/atlas.json` + merged .svg →
 * `public/sprite_sheets/camp.png` (full) + `camp_world.png` (world / iso catalog)
 * and generate `src/game/campSpriteCatalog.source.mjs` (entries use world UVs + texture).
 *
 * Frame `spriteId` must match manifest-style slugs: `camp_wigwam`, `station_<stationId>`.
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
const CAMP_SHEET_DIR = path.join(ROOT, 'data', 'sprite_sheets', 'camp');
const PUBLIC_SHEET_DIR = path.join(ROOT, 'public', 'sprite_sheets');
const CAMP_PNG_BASENAME = 'camp.png';
const CAMP_WORLD_PNG_BASENAME = 'camp_world.png';
const OUTPUT_CATALOG = path.join(ROOT, 'src', 'game', 'campSpriteCatalog.source.mjs');
const CAMP_ALPHA_CACHE = path.join(ROOT, '.cache', 'camp-sprite-alpha-cache.json');

const PUBLIC_WORLD_URL_PATH = '/sprite_sheets/camp_world.png';

function loadCampAlphaCache() {
  if (!fs.existsSync(CAMP_ALPHA_CACHE)) {
    return { files: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CAMP_ALPHA_CACHE, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { files: {} };
}

function saveCampAlphaCache(cache) {
  const dir = path.dirname(CAMP_ALPHA_CACHE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CAMP_ALPHA_CACHE, JSON.stringify(cache, null, 2), 'utf-8');
}

function writeEmptyCatalog(message) {
  if (message) {
    // eslint-disable-next-line no-console
    console.log(`[build-camp-sprite-catalog] ${message}`);
  }
  const out = 'const CAMP_SPRITE_CATALOG_SOURCE = {};\n\nexport default CAMP_SPRITE_CATALOG_SOURCE;\n';
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Wrote empty camp sprite catalog: ${OUTPUT_CATALOG}`);
}

async function main() {
  if (!fs.existsSync(CAMP_SHEET_DIR)) {
    writeEmptyCatalog(`No ${path.relative(ROOT, CAMP_SHEET_DIR)} — skipping camp sheet build.`);
    return;
  }

  const svgAtlas = readSvgAtlasIfPresent(CAMP_SHEET_DIR);
  if (!svgAtlas) {
    writeEmptyCatalog(
      `No valid ${SVG_ATLAS_JSON} (format SVG) in ${path.relative(ROOT, CAMP_SHEET_DIR)} — skipping.`,
    );
    return;
  }

  const texture = svgAtlas.json.textures[0];
  const frames = texture.frames || [];
  for (const f of frames) {
    if (typeof f?.spriteId !== 'string' || !f.spriteId) {
      throw new Error(
        `Camp SVG atlas requires every frame to have "spriteId" (got ${JSON.stringify(f)})`,
      );
    }
  }

  const svgFile = resolveMergedSvgFile(CAMP_SHEET_DIR, texture);
  if (!svgFile) {
    throw new Error(
      `Could not find merged .svg in ${CAMP_SHEET_DIR} for texture.image="${texture?.image || ''}"`,
    );
  }

  const logicalW = Number(texture.size?.w) || 0;
  const logicalH = Number(texture.size?.h) || 0;
  if (!logicalW || !logicalH) {
    throw new Error('Camp atlas: texture.size w/h required');
  }
  const first = frames[0];
  const cellW = Number(first?.frame?.w) || 0;
  if (!cellW) {
    throw new Error('Camp atlas: set frame.w on first frame for cell size');
  }

  if (!fs.existsSync(PUBLIC_SHEET_DIR)) {
    fs.mkdirSync(PUBLIC_SHEET_DIR, { recursive: true });
  }

  const spriteAlphaCache = loadCampAlphaCache();
  const pngPath = path.join(PUBLIC_SHEET_DIR, CAMP_PNG_BASENAME);
  const pngWorldPath = path.join(PUBLIC_SHEET_DIR, CAMP_WORLD_PNG_BASENAME);

  rasterizeMergedSheetLayer({
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
  saveCampAlphaCache(spriteAlphaCache);

  const bySpriteId = {};
  for (const f of worldLayer.rasterFrames) {
    const key = f.spriteId;
    if (typeof key !== 'string' || !key) {
      continue;
    }
    if (key.startsWith('camp_sheet_reserved_')) {
      continue;
    }
    bySpriteId[key] = catalogEntryFromRasterFrame(
      f,
      worldLayer.opaqueByKey,
      key,
      worldLayer.pngDimensions,
      worldLayer.rasterToDisplay,
      PUBLIC_WORLD_URL_PATH,
    );
  }

  const out = `const CAMP_SPRITE_CATALOG_SOURCE = ${JSON.stringify(bySpriteId, null, 2)};\n\nexport default CAMP_SPRITE_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `[build-camp-sprite-catalog] Wrote ${Object.keys(bySpriteId).length} camp frames → ${path.relative(ROOT, OUTPUT_CATALOG)}; catalog uses ${PUBLIC_WORLD_URL_PATH} (full: ${CAMP_PNG_BASENAME})`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
