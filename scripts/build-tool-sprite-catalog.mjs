#!/usr/bin/env node
/**
 * Rasterize `data/sprite_sheets/tools/atlas.json` + merged .svg → `public/sprite_sheets/tools.png`
 * + `tools_world.png` (world LOD; catalog uses full-res for inventory only).
 *
 * Layout: drop (or symlink) `atlas.json` + merged `*.svg` under `data/sprite_sheets/tools/`.
 * Frame `spriteId` must be `tool_<item_suffix>` → maps to item id `tool:<item_suffix>`.
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
const TOOLS_SHEET_DIR = path.join(ROOT, 'data', 'sprite_sheets', 'tools');
const PUBLIC_TOOL_DIR = path.join(ROOT, 'public', 'sprite_sheets');
const TOOL_PNG_BASENAME = 'tools.png';
const TOOL_WORLD_PNG_BASENAME = 'tools_world.png';
const OUTPUT_CATALOG = path.join(ROOT, 'src', 'game', 'toolSpriteCatalog.source.mjs');
const TOOL_ALPHA_CACHE = path.join(ROOT, '.cache', 'tool-sprite-alpha-cache.json');

const PUBLIC_URL_PATH = '/sprite_sheets/tools.png';

function loadToolAlphaCache() {
  if (!fs.existsSync(TOOL_ALPHA_CACHE)) {
    return { files: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(TOOL_ALPHA_CACHE, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { files: {} };
}

function saveToolAlphaCache(cache) {
  const dir = path.dirname(TOOL_ALPHA_CACHE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TOOL_ALPHA_CACHE, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * `tool_axe` → `tool:axe`, `tool_bone_hook` → `tool:bone_hook`
 */
function spriteIdToItemId(spriteId) {
  if (typeof spriteId !== 'string' || !spriteId.startsWith('tool_')) {
    return null;
  }
  return `tool:${spriteId.slice(5)}`;
}

function writeEmptyCatalog(message) {
  if (message) {
    // eslint-disable-next-line no-console
    console.log(`[build-tool-sprite-catalog] ${message}`);
  }
  const out = 'const TOOL_SPRITE_CATALOG_SOURCE = {};\n\nexport default TOOL_SPRITE_CATALOG_SOURCE;\n';
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Wrote empty tool sprite catalog: ${OUTPUT_CATALOG}`);
}

async function main() {
  if (!fs.existsSync(TOOLS_SHEET_DIR)) {
    writeEmptyCatalog(`No ${path.relative(ROOT, TOOLS_SHEET_DIR)} — skipping tool sheet build.`);
    return;
  }

  const svgAtlas = readSvgAtlasIfPresent(TOOLS_SHEET_DIR);
  if (!svgAtlas) {
    writeEmptyCatalog(
      `No valid ${SVG_ATLAS_JSON} (format SVG) in ${path.relative(ROOT, TOOLS_SHEET_DIR)} — skipping.`,
    );
    return;
  }

  const texture = svgAtlas.json.textures[0];
  const frames = texture.frames || [];
  for (const f of frames) {
    if (typeof f?.spriteId !== 'string' || !f.spriteId) {
      throw new Error(
        `Tools SVG atlas requires every frame to have "spriteId" (got ${JSON.stringify(f)})`,
      );
    }
  }

  const svgFile = resolveMergedSvgFile(TOOLS_SHEET_DIR, texture);
  if (!svgFile) {
    throw new Error(
      `Could not find merged .svg in ${TOOLS_SHEET_DIR} for texture.image="${texture?.image || ''}"`,
    );
  }

  const logicalW = Number(texture.size?.w) || 0;
  const logicalH = Number(texture.size?.h) || 0;
  if (!logicalW || !logicalH) {
    throw new Error('Tools atlas: texture.size w/h required');
  }
  const first = frames[0];
  const cellW = Number(first?.frame?.w) || 0;
  if (!cellW) {
    throw new Error('Tools atlas: set frame.w on first frame for cell size');
  }

  if (!fs.existsSync(PUBLIC_TOOL_DIR)) {
    fs.mkdirSync(PUBLIC_TOOL_DIR, { recursive: true });
  }

  const spriteAlphaCache = loadToolAlphaCache();
  const pngPath = path.join(PUBLIC_TOOL_DIR, TOOL_PNG_BASENAME);
  const pngWorldPath = path.join(PUBLIC_TOOL_DIR, TOOL_WORLD_PNG_BASENAME);

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
  saveToolAlphaCache(spriteAlphaCache);

  const byItemId = {};
  for (const f of fullLayer.rasterFrames) {
    const key = f.spriteId;
    const itemId = spriteIdToItemId(key);
    if (!itemId) {
      // eslint-disable-next-line no-console
      console.warn(`[build-tool-sprite-catalog] skip frame spriteId (expected tool_*): ${key}`);
      continue;
    }
    byItemId[itemId] = catalogEntryFromRasterFrame(
      f,
      fullLayer.opaqueByKey,
      key,
      fullLayer.pngDimensions,
      fullLayer.rasterToDisplay,
      PUBLIC_URL_PATH,
    );
  }

  const out = `const TOOL_SPRITE_CATALOG_SOURCE = ${JSON.stringify(byItemId, null, 2)};\n\nexport default TOOL_SPRITE_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_CATALOG, out, 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `[build-tool-sprite-catalog] Wrote ${Object.keys(byItemId).length} tool icons → ${path.relative(ROOT, OUTPUT_CATALOG)} and ${PUBLIC_URL_PATH} (+ world ${TOOL_WORLD_PNG_BASENAME})`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
