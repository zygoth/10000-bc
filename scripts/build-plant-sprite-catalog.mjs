import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import { Jimp } from 'jimp';
import { lifeStageSizeVisualScaleMultiplier } from '../src/game/plantPatchLayout.mjs';

const ROOT = path.resolve('.');
const PLANTS_DIR = path.join(ROOT, 'data', 'plants');
const PUBLIC_SPRITES_DIR = path.join(ROOT, 'public', 'plant_sprites');
/** Shipped merged SVGs for inspect-mode zoom (one file per SVG-source species). */
const PUBLIC_PLANT_SVG_DIR = path.join(ROOT, 'public', 'plant_sprites_svg');
const DATA_ISOMETRIC_SPRITES_DIR = path.join(ROOT, 'data', 'isometric_sprites');
const PUBLIC_ISOMETRIC_SPRITES_DIR = path.join(ROOT, 'public', 'isometric_sprites');
const OUTPUT_FILE = path.join(ROOT, 'src', 'game', 'plantSpriteCatalog.source.mjs');
const SPRITE_ALPHA_CACHE_FILE = path.join(ROOT, '.cache', 'plant-sprite-alpha-cache.json');
const LEGACY_ATLAS_BASENAME = 'spritesheet_rd_final';
const SVG_ATLAS_JSON = 'atlas.json';
/**
 * SVG pipeline: how many pixels wide each grid cell is in the shipped PNG.
 * High value = more detail; GPU + linear filter downscales to display.
 */
const SVG_RASTER_CELL_PX = 256;
/**
 * Logical on-screen "design" cell size in catalog units (matches legacy 64). Texture rects stay at SVG_RASTER_CELL_PX; sourceW/H stay at this.
 */
const DISPLAY_TEXTURE_CELL_PX = 64;
const UNIVERSAL_DIR = path.join(PLANTS_DIR, 'universal');
const UNIVERSAL_DEAD_TREE_SPRITE = 'dead_tree.png';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
/** All SVG life-stage rasters (resized by visual scale) are packed into one of these files. */
const LIFE_STAGES_ATLAS_BASENAME = 'plant_life_stages';
const LIFE_STAGES_CELL_PAD = 2;
/** Per dimension; if a page is full, another `plant_life_stages_N.png` is created. */
const MAX_LIFE_STAGES_ATLAS_PX = 4096;
/** Main merged sheet: one grid cell in the PNG = this many texture pixels; used for part / non-packed rects. */
const RASTER_TO_DISPLAY_FOR_MAIN_SHEET = SVG_RASTER_CELL_PX / DISPLAY_TEXTURE_CELL_PX;

function loadSpriteAlphaCache() {
  if (!fs.existsSync(SPRITE_ALPHA_CACHE_FILE)) {
    return { files: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(SPRITE_ALPHA_CACHE_FILE, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
      return parsed;
    }
  } catch {
    // Ignore invalid cache; a clean cache will be re-generated.
  }

  return { files: {} };
}

function saveSpriteAlphaCache(cache) {
  const dir = path.dirname(SPRITE_ALPHA_CACHE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SPRITE_ALPHA_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

function decodePngRgba(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature for sprite atlas decode');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks = [];

  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkData = bytes.subarray(dataStart, dataEnd);
    offset = dataEnd + 4;

    if (type === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      interlaceMethod = chunkData[12];
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height) {
    throw new Error('PNG atlas decode failed: missing IHDR');
  }
  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}; expected 8`);
  }
  if (interlaceMethod !== 0) {
    throw new Error('Unsupported interlaced PNG for sprite atlas');
  }
  if (colorType !== 6 && colorType !== 2) {
    throw new Error(`Unsupported PNG color type ${colorType}; expected RGBA or RGB`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const raw = Buffer.alloc(height * stride);
  let src = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[src++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const current = inflated[src++];
      const left = x >= bytesPerPixel ? raw[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[rowStart + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[rowStart + x - stride - bytesPerPixel] : 0;

      let value;
      switch (filterType) {
        case 0:
          value = current;
          break;
        case 1:
          value = (current + left) & 255;
          break;
        case 2:
          value = (current + up) & 255;
          break;
        case 3:
          value = (current + Math.floor((left + up) / 2)) & 255;
          break;
        case 4:
          value = (current + paethPredictor(left, up, upLeft)) & 255;
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filterType}`);
      }

      raw[rowStart + x] = value;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  if (colorType === 6) {
    for (let i = 0; i < raw.length; i += 4) {
      rgba[i] = raw[i];
      rgba[i + 1] = raw[i + 1];
      rgba[i + 2] = raw[i + 2];
      rgba[i + 3] = raw[i + 3];
    }
  } else {
    for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
      rgba[j] = raw[i];
      rgba[j + 1] = raw[i + 1];
      rgba[j + 2] = raw[i + 2];
      rgba[j + 3] = 255;
    }
  }

  return { width, height, rgba };
}

function atlasFrameRectsToRasterSpace(frames, logicalW, logicalH, pngW, pngH) {
  const rx = pngW / logicalW;
  const ry = pngH / logicalH;
  return frames.map((f) => {
    const fr = f?.frame;
    if (!fr) {
      return f;
    }
    const nw = Math.max(1, Math.round(fr.w * rx));
    const nh = Math.max(1, Math.round(fr.h * ry));
    const ss = f?.spriteSourceSize;
    const src = f?.sourceSize;
    return {
      ...f,
      // Keep trim metadata in texture pixel space so runtime anchor math (sourceW/sourceH) matches w/h.
      sourceSize: src
        ? { w: Math.max(1, Math.round((src.w ?? fr.w) * rx)), h: Math.max(1, Math.round((src.h ?? fr.h) * ry)) }
        : { w: nw, h: nh },
      spriteSourceSize: ss
        ? {
          x: Math.round((ss.x ?? 0) * rx),
          y: Math.round((ss.y ?? 0) * ry),
          w: Math.max(1, Math.round((ss.w ?? fr.w) * rx)),
          h: Math.max(1, Math.round((ss.h ?? fr.h) * ry)),
        }
        : { x: 0, y: 0, w: nw, h: nh },
      frame: {
        ...fr,
        x: Math.round(fr.x * rx),
        y: Math.round(fr.y * ry),
        w: nw,
        h: nh,
      },
    };
  });
}

function firstOpaqueFromBottom(decoded, frame, alphaThreshold = 1) {
  const x0 = Math.max(0, Math.floor(frame.frame.x));
  const y0 = Math.max(0, Math.floor(frame.frame.y));
  const w = Math.max(0, Math.floor(frame.frame.w));
  const h = Math.max(0, Math.floor(frame.frame.h));
  const x1 = Math.min(decoded.width, x0 + w);
  const y1 = Math.min(decoded.height, y0 + h);

  for (let y = y1 - 1; y >= y0; y -= 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = ((y * decoded.width) + x) * 4;
      if (decoded.rgba[idx + 3] >= alphaThreshold) {
        return y - y0;
      }
    }
  }

  return h > 0 ? h - 1 : 0;
}

function frameKey(frame) {
  if (typeof frame?.spriteId === 'string' && frame.spriteId) {
    return frame.spriteId;
  }
  if (typeof frame?.filename === 'string' && frame.filename) {
    return frame.filename;
  }
  return '';
}

/**
 * Opaque bottom per frame key (spriteId preferred, else filename) — supports merged SVG atlases
 * where every row shares the same `filename` but has distinct `spriteId`.
 */
function getOpaqueBottomByFrameKey(pngPath, textureFrames, cache) {
  const stat = fs.statSync(pngPath);
  const frameSignature = textureFrames
    .map((frame) => {
      const key = frameKey(frame);
      const rect = frame?.frame || {};
      return `${key}:${rect.x || 0},${rect.y || 0},${rect.w || 0},${rect.h || 0}`;
    })
    .sort()
    .join('|');
  const signature = `${stat.size}:${Math.floor(stat.mtimeMs)}:${frameSignature}`;
  const cached = cache.files?.[pngPath];

  if (cached?.signature === signature && cached?.frameOpaqueBottomByKey) {
    return cached.frameOpaqueBottomByKey;
  }

  const decoded = decodePngRgba(fs.readFileSync(pngPath));
  const frameOpaqueBottomByKey = {};
  for (const frame of textureFrames) {
    if (frame.rotated === true) {
      const k = frameKey(frame) || 'unknown';
      throw new Error(`Unsupported rotated frame in atlas: ${k}`);
    }
    const key = frameKey(frame);
    if (!key) {
      throw new Error('Atlas frame missing spriteId and filename');
    }
    frameOpaqueBottomByKey[key] = firstOpaqueFromBottom(decoded, frame);
  }

  cache.files[pngPath] = {
    signature,
    frameOpaqueBottomByKey,
  };

  return frameOpaqueBottomByKey;
}

/* Legacy: one row per distinct filename in the merged PNG */
function legacyUniqueFilenameFrames(frames) {
  const seen = new Set();
  const out = [];
  for (const frame of frames) {
    const filename = typeof frame?.filename === 'string' ? frame.filename : '';
    if (!filename || seen.has(filename)) {
      continue;
    }
    seen.add(filename);
    out.push(frame);
  }
  return out;
}

function listPlantDirectories() {
  return fs
    .readdirSync(PLANTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PLANTS_DIR, entry.name))
    .filter((dirPath) => fs.existsSync(path.join(dirPath, 'plant.json')));
}

function copyUniversalSprites() {
  const deadTreeSourcePath = path.join(UNIVERSAL_DIR, UNIVERSAL_DEAD_TREE_SPRITE);
  if (!fs.existsSync(deadTreeSourcePath)) {
    throw new Error(`Missing required universal sprite: ${deadTreeSourcePath}`);
  }

  const deadTreeTargetPath = path.join(PUBLIC_SPRITES_DIR, UNIVERSAL_DEAD_TREE_SPRITE);
  fs.copyFileSync(deadTreeSourcePath, deadTreeTargetPath);
}

function copyIsometricSprites() {
  if (!fs.existsSync(DATA_ISOMETRIC_SPRITES_DIR)) {
    throw new Error(`Missing isometric sprite source directory: ${DATA_ISOMETRIC_SPRITES_DIR}`);
  }

  if (fs.existsSync(PUBLIC_ISOMETRIC_SPRITES_DIR)) {
    fs.rmSync(PUBLIC_ISOMETRIC_SPRITES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLIC_ISOMETRIC_SPRITES_DIR, { recursive: true });

  const entries = fs.readdirSync(DATA_ISOMETRIC_SPRITES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile());

  for (const entry of entries) {
    const sourcePath = path.join(DATA_ISOMETRIC_SPRITES_DIR, entry.name);
    const targetPath = path.join(PUBLIC_ISOMETRIC_SPRITES_DIR, entry.name);
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Inventory / UI resolves part frames with `getPlantPartSpriteFrame`, which must use the same
 * texture as the merged raster that generated these UVs. Mirror per-frame `imagePath` and atlas
 * dimensions from life stages (see `getPlantSpriteFrame`).
 */
function stampPartSubStageFramesWithMainTexture(
  partSubStageFrames,
  mainImagePath,
  mainAtlasW,
  mainAtlasH,
) {
  if (!partSubStageFrames || typeof partSubStageFrames !== 'object') {
    return partSubStageFrames;
  }
  const out = {};
  for (const [partName, subMap] of Object.entries(partSubStageFrames)) {
    if (!subMap || typeof subMap !== 'object') {
      out[partName] = subMap;
      continue;
    }
    out[partName] = {};
    for (const [subId, fr] of Object.entries(subMap)) {
      if (!fr || typeof fr !== 'object') {
        out[partName][subId] = fr;
        continue;
      }
      out[partName][subId] = {
        ...fr,
        imagePath: fr.imagePath || mainImagePath,
        atlasWidth: fr.atlasWidth ?? mainAtlasW,
        atlasHeight: fr.atlasHeight ?? mainAtlasH,
      };
    }
  }
  return out;
}

function readSvgAtlasIfPresent(plantDir) {
  const p = path.join(plantDir, SVG_ATLAS_JSON);
  if (!fs.existsSync(p)) {
    return null;
  }
  const json = readJson(p);
  const t0 = json.textures?.[0];
  if (String(t0?.format).toUpperCase() !== 'SVG' || !Array.isArray(t0?.frames) || t0.frames.length === 0) {
    return null;
  }
  return { path: p, json };
}

function resolveMergedSvgFile(plantDir, texture) {
  const imageBase = typeof texture?.image === 'string' ? texture.image : '';
  const fromDir = (name) => path.join(plantDir, name);
  if (imageBase) {
    const direct = fromDir(`${imageBase}.svg`);
    if (fs.existsSync(direct)) {
      return direct;
    }
  }
  const byFrames = texture.frames
    .map((f) => (typeof f?.filename === 'string' ? f.filename : ''))
    .filter(Boolean);
  for (const fn of byFrames) {
    const candidate = fromDir(path.basename(fn));
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  if (imageBase) {
    const allSvg = fs.readdirSync(plantDir).filter((f) => f.toLowerCase().endsWith('.svg'));
    const hit = allSvg.find((f) => f.replace(/\.svg$/i, '').includes(imageBase) || imageBase.includes(f.replace(/\.svg$/i, '')));
    if (hit) {
      return fromDir(hit);
    }
  }
  const allSvg2 = fs.readdirSync(plantDir).filter((f) => f.toLowerCase().endsWith('.svg'));
  if (allSvg2.length === 1) {
    return fromDir(allSvg2[0]);
  }
  if (allSvg2.length > 0) {
    return fromDir(allSvg2[0]);
  }
  return null;
}

/**
 * Rasterize merged sheet SVG to PNG (resvg; fits to target width, preserves aspect).
 * @returns {Buffer}
 */
function rasterizeSvgToPng(svgPath, outWidth) {
  const w = Math.max(1, Math.round(outWidth));
  const svgText = fs.readFileSync(svgPath, 'utf-8');
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: w },
    background: 'transparent',
  });
  return resvg.render().asPng();
}

/**
 * Manual post-generation flag on `plant.json` life_stages entries: when true, life-stage
 * anchorY is the frame vertical center (overhead rosettes etc.) instead of bottom-of-opaque.
 * Not used by the AI pipeline; authors add it under the matching `stage` object.
 */
function normalizeFrame(frame, opaqueBottomInFrame = null, options = null) {
  const centerAnchored = options?.centerAnchored === true;
  const sourceW = frame.sourceSize?.w ?? frame.frame.w;
  const sourceH = frame.sourceSize?.h ?? frame.frame.h;
  const offsetX = frame.spriteSourceSize?.x ?? 0;
  const offsetY = frame.spriteSourceSize?.y ?? 0;
  const fh = frame.frame.h;
  const bottomAnchorY = offsetY + ((opaqueBottomInFrame === null || opaqueBottomInFrame === undefined)
    ? fh
    : (opaqueBottomInFrame + 1));
  const anchorY = centerAnchored
    ? offsetY + Math.round(fh / 2)
    : bottomAnchorY;

  const out = {
    x: frame.frame.x,
    y: frame.frame.y,
    w: frame.frame.w,
    h: fh,
    sourceW,
    sourceH,
    offsetX,
    offsetY,
    anchorX: offsetX + (frame.frame.w / 2),
    anchorY,
  };
  if (centerAnchored) {
    out.centerAnchored = true;
  }
  return out;
}

function scaledCatalogFrame(normalized, scaleX, scaleY) {
  const scaled = {
    x: Math.round(normalized.x * scaleX),
    y: Math.round(normalized.y * scaleY),
    w: Math.round(normalized.w * scaleX),
    h: Math.round(normalized.h * scaleY),
    sourceW: Math.round(normalized.sourceW * scaleX),
    sourceH: Math.round(normalized.sourceH * scaleY),
    offsetX: Math.round(normalized.offsetX * scaleX),
    offsetY: Math.round(normalized.offsetY * scaleY),
    anchorX: Math.round(normalized.anchorX * scaleX),
    anchorY: Math.round(normalized.anchorY * scaleY),
  };
  if (normalized.centerAnchored === true) {
    scaled.centerAnchored = true;
  }
  return scaled;
}

function readPngDimensionsFromBufferOrPath(bufOrPath) {
  const bytes = typeof bufOrPath === 'string' ? fs.readFileSync(bufOrPath) : bufOrPath;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function requireLegacyAtlasPaths(plantDir, speciesId) {
  const jsonPath = path.join(plantDir, `${LEGACY_ATLAS_BASENAME}.json`);
  const pngPath = path.join(plantDir, `${LEGACY_ATLAS_BASENAME}.png`);
  if (!fs.existsSync(jsonPath) || !fs.existsSync(pngPath)) {
    throw new Error(
      `Missing final atlas for ${speciesId}: need ${SVG_ATLAS_JSON} (format SVG) or ${LEGACY_ATLAS_BASENAME}.json/.png`,
    );
  }
  return { jsonPath, pngPath };
}

/** Keep high-res w/h/x/y for sampling; put anchors/trim in DISPLAY_TEXTURE_CELL_PX space (matches legacy 64 and on-screen size). */
function svgCatalogFrameToDisplayUnits(entry, rasterToDisplayRatio) {
  return {
    ...entry,
    sourceW: DISPLAY_TEXTURE_CELL_PX,
    sourceH: DISPLAY_TEXTURE_CELL_PX,
    offsetX: Math.round((entry.offsetX || 0) / rasterToDisplayRatio),
    offsetY: Math.round((entry.offsetY || 0) / rasterToDisplayRatio),
    anchorX: Math.round((entry.anchorX || 0) / rasterToDisplayRatio),
    anchorY: Math.round((entry.anchorY || 0) / rasterToDisplayRatio),
  };
}

function maxLifeStageSizeFromPlantJson(plant) {
  let m = 1;
  for (const ls of plant.life_stages || []) {
    const s = Number(ls?.size);
    if (Number.isFinite(s)) {
      m = Math.max(m, Math.round(s));
    }
  }
  return m;
}

/**
 * @typedef {{ speciesId: string, stage: string, spriteId: string, mainPngPath: string, crop: {x:number,y:number,w:number,h:number}, targetPx: number, sortKey: string, centerAnchored?: boolean }} LifeStagePackItem
 * @param {LifeStagePackItem[]} items
 * @param {number} maxW
 * @param {number} maxH
 * @param {number} pad
 * @returns {Array<{ placements: Array<LifeStagePackItem & {x:number, y:number}>, width: number, height: number }>}
 */
function packLifeStageItemsToPages(items, maxW, maxH, pad) {
  const capW = maxW - 2 * pad;
  const capH = maxH - 2 * pad;
  for (const it of items) {
    if (it.targetPx > capW || it.targetPx > capH) {
      throw new Error(
        `Life stage pack: ${it.spriteId} targetPx ${it.targetPx} exceeds max page cell (${capW}×${capH} usable in ${maxW}×${maxH}).`,
      );
    }
  }
  const sorted = [...items].sort((a, b) => {
    if (b.targetPx !== a.targetPx) {
      return b.targetPx - a.targetPx;
    }
    return a.sortKey.localeCompare(b.sortKey);
  });

  const pages = [];
  let placements = [];
  let x = pad;
  let y = pad;
  let rowH = 0;
  function finishPage() {
    if (placements.length === 0) {
      return;
    }
    let w = pad;
    let h = pad;
    for (const p of placements) {
      w = Math.max(w, p.x + p.targetPx);
      h = Math.max(h, p.y + p.targetPx);
    }
    w += pad;
    h += pad;
    pages.push({ placements, width: w, height: h });
    placements = [];
    x = pad;
    y = pad;
    rowH = 0;
  }

  for (const item of sorted) {
    const w = item.targetPx;
    const h = item.targetPx;
    place: for (;;) {
      if (x + w + pad > maxW) {
        y += rowH + (rowH > 0 ? pad : 0);
        x = pad;
        rowH = 0;
      }
      if (y + h + pad > maxH) {
        finishPage();
        continue place;
      }
      placements.push({ ...item, x, y });
      rowH = Math.max(rowH, h);
      x += w + pad;
      break;
    }
  }
  finishPage();
  return pages;
}

/**
 * Rasterize packed life stages and fill {@link outLookup} with catalog entries keyed by `speciesId::stage`.
 * @param {any} outLookup Map
 */
async function renderAndCatalogLifeStagePages(packItems, spriteAlphaCache, publicSpritesDir, outLookup) {
  if (packItems.length === 0) {
    return;
  }
  const pages = packLifeStageItemsToPages(
    packItems,
    MAX_LIFE_STAGES_ATLAS_PX,
    MAX_LIFE_STAGES_ATLAS_PX,
    LIFE_STAGES_CELL_PAD,
  );
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const { width, height, placements } = page;
    const jimp = new Jimp({ width, height, color: 0x00000000 });
    for (const pl of placements) {
      const src = await Jimp.read(pl.mainPngPath);
      const cell = src.crop({ x: pl.crop.x, y: pl.crop.y, w: pl.crop.w, h: pl.crop.h });
      await cell.resize({ w: pl.targetPx, h: pl.targetPx });
      jimp.composite(cell, pl.x, pl.y);
    }
    const fname = `${LIFE_STAGES_ATLAS_BASENAME}_${pageIndex}.png`;
    const outP = path.join(publicSpritesDir, fname);
    await jimp.write(outP);

    const imagePath = `/plant_sprites/${fname}`;
    const scanFrames = placements.map((pl) => ({
      spriteId: pl.spriteId,
      frame: { x: pl.x, y: pl.y, w: pl.targetPx, h: pl.targetPx },
    }));
    const opaques = getOpaqueBottomByFrameKey(outP, scanFrames, spriteAlphaCache);

    for (const pl of placements) {
      const op = opaques[pl.spriteId];
      const synthetic = {
        sourceSize: { w: pl.targetPx, h: pl.targetPx },
        spriteSourceSize: { x: 0, y: 0, w: pl.targetPx, h: pl.targetPx },
        frame: { x: pl.x, y: pl.y, w: pl.targetPx, h: pl.targetPx },
      };
      const normalized = normalizeFrame(synthetic, op, { centerAnchored: pl.centerAnchored === true });
      const toDisplay = svgCatalogFrameToDisplayUnits(
        scaledCatalogFrame(normalized, 1, 1),
        pl.targetPx / DISPLAY_TEXTURE_CELL_PX,
      );
      outLookup.set(`${pl.speciesId}::${pl.stage}`, {
        ...toDisplay,
        imagePath,
        atlasWidth: width,
        atlasHeight: height,
      });
    }
  }
}

/**
 * Logical viewBox rects on the merged SVG sheet for browser inspect (life stages + parts).
 */
function buildInspectSvgCatalog(speciesId, plant, atlasFrames) {
  const bySpriteId = Object.fromEntries(atlasFrames.map((f) => [f.spriteId, f]));
  const rectFromSpriteId = (spriteId) => {
    const fr = bySpriteId[spriteId]?.frame;
    if (!fr) {
      return null;
    }
    return { x: fr.x, y: fr.y, w: fr.w, h: fr.h };
  };
  const lifeStageFrames = {};
  for (const lifeStage of plant.life_stages || []) {
    const stage = lifeStage.stage;
    const r = rectFromSpriteId(`${speciesId}_${stage}`);
    if (r) {
      lifeStageFrames[stage] = r;
    }
  }
  const partSubStageFrames = {};
  for (const part of plant.parts || []) {
    const partName = part?.name;
    if (!partName) {
      continue;
    }
    for (const subStage of part.sub_stages || part.subStages || []) {
      const subId = subStage?.id;
      if (!subId) {
        continue;
      }
      const specific = `${speciesId}_${partName}_${subId}`;
      const generic = `${speciesId}_${partName}`;
      const r = rectFromSpriteId(specific) || rectFromSpriteId(generic);
      if (!r) {
        continue;
      }
      if (!partSubStageFrames[partName]) {
        partSubStageFrames[partName] = {};
      }
      partSubStageFrames[partName][subId] = r;
    }
  }
  return { lifeStageFrames, partSubStageFrames };
}

/**
 * Merged-SVG + atlas.json: rasterize to PNG, index frames by spriteId, anchors from PNG.
 */
async function buildFromSvgSource(plantDir, atlas, spriteAlphaCache) {
  const plant = readJson(path.join(plantDir, 'plant.json'));
  const speciesId = plant.id;
  const texture = atlas.textures[0];
  const frames = texture.frames;
  for (const f of frames) {
    if (typeof f.spriteId !== 'string' || !f.spriteId) {
      throw new Error(
        `SVG atlas in ${plantDir} requires every frame to have a non-empty "spriteId" (got ${JSON.stringify(f)})`,
      );
    }
  }
  const svgFile = resolveMergedSvgFile(plantDir, texture);
  if (!svgFile) {
    throw new Error(
      `Could not find merged .svg in ${plantDir} for image "${texture.image || ''}". Add the merged sheet SVG to this folder.`,
    );
  }

  const logicalW = Number(texture.size?.w) || Number(atlas.meta?.viewBox?.w);
  const logicalH = Number(texture.size?.h) || Number(atlas.meta?.viewBox?.h);
  if (!logicalW || !logicalH) {
    throw new Error(`SVG atlas for ${speciesId} missing texture.size (or meta.viewBox) w/h`);
  }

  const first = frames[0];
  const cellW = Number(first?.frame?.w) || 0;
  if (!cellW) {
    throw new Error(
      `SVG atlas for ${speciesId}: set frame.w on atlas frames (for raster cell size)`,
    );
  }

  fs.mkdirSync(PUBLIC_PLANT_SVG_DIR, { recursive: true });
  fs.copyFileSync(svgFile, path.join(PUBLIC_PLANT_SVG_DIR, `${speciesId}.svg`));
  const inspectSvgParts = buildInspectSvgCatalog(speciesId, plant, frames);
  const inspectSvg = {
    imagePath: `/plant_sprites_svg/${speciesId}.svg`,
    viewBoxW: logicalW,
    viewBoxH: logicalH,
    lifeStageFrames: inspectSvgParts.lifeStageFrames,
    partSubStageFrames: inspectSvgParts.partSubStageFrames,
  };

  // One grid cell = SVG_RASTER_CELL_PX in the output PNG; catalog uses DISPLAY_TEXTURE_CELL_PX for sourceW/H.
  const targetRasterWidth = Math.max(1, Math.round((logicalW * SVG_RASTER_CELL_PX) / cellW));

  const pngBuffer = rasterizeSvgToPng(svgFile, targetRasterWidth);
  const pngPathInPublic = path.join(PUBLIC_SPRITES_DIR, `${speciesId}.png`);
  fs.writeFileSync(pngPathInPublic, pngBuffer);

  const pngDimensions = readPngDimensionsFromBufferOrPath(pngBuffer);
  // Frame rects in atlas.json are in logical (e.g. 0–2560) space; the PNG is ~320px. Alpha + anchors
  // must use raster-space rects that match the shipped texture, or scans read wrong pixels.
  const rasterFrames = atlasFrameRectsToRasterSpace(
    frames,
    logicalW,
    logicalH,
    pngDimensions.width,
    pngDimensions.height,
  );
  const opaqueByKey = getOpaqueBottomByFrameKey(pngPathInPublic, rasterFrames, spriteAlphaCache);
  const rasterBySpriteId = Object.fromEntries(rasterFrames.map((f) => [f.spriteId, f]));
  const maxSize = maxLifeStageSizeFromPlantJson(plant);
  const visLarge = lifeStageSizeVisualScaleMultiplier(maxSize);
  const lifeStageCapPx = MAX_LIFE_STAGES_ATLAS_PX - 2 * LIFE_STAGES_CELL_PAD;
  const lifeStagePackItems = [];
  for (const lifeStage of plant.life_stages || []) {
    const id = `${speciesId}_${lifeStage.stage}`;
    const rFr = rasterBySpriteId[id];
    if (!rFr?.frame) {
      continue;
    }
    const sizeRow = (plant.life_stages || []).find((l) => l.stage === lifeStage.stage);
    const stageSize = Math.max(1, Math.round(Number(sizeRow?.size) || 1));
    const visSmall = lifeStageSizeVisualScaleMultiplier(stageSize);
    const targetPx = Math.max(
      48,
      Math.min(lifeStageCapPx, Math.round(SVG_RASTER_CELL_PX * (visSmall / (visLarge || 1)))),
    );
    const { x, y, w, h } = rFr.frame;
    lifeStagePackItems.push({
      speciesId,
      stage: lifeStage.stage,
      spriteId: id,
      mainPngPath: pngPathInPublic,
      crop: { x, y, w, h },
      targetPx,
      sortKey: `${speciesId}::${lifeStage.stage}`,
      centerAnchored: lifeStage.center_anchored_sprite === true,
    });
  }
  if (lifeStagePackItems.length === 0) {
    throw new Error(
      `SVG build for ${speciesId}: no life stage pack items (check plant.json life_stages vs atlas spriteIds)`,
    );
  }

  const partSubStageFrames = {};
  for (const part of plant.parts || []) {
    const partName = part?.name;
    if (!partName) {
      continue;
    }
    for (const subStage of part.sub_stages || part.subStages || []) {
      const subId = subStage?.id;
      if (!subId) {
        continue;
      }
      const specific = `${speciesId}_${partName}_${subId}`;
      const generic = `${speciesId}_${partName}`;
      const rFr = rasterBySpriteId[specific] || rasterBySpriteId[generic];
      if (!rFr) {
        continue;
      }
      const useKey = rasterBySpriteId[specific] ? specific : generic;
      const op = opaqueByKey[useKey];
      if (!partSubStageFrames[partName]) {
        partSubStageFrames[partName] = {};
      }
      partSubStageFrames[partName][subId] = scaledCatalogFrame(
        normalizeFrame(rFr, op),
        1,
        1,
      );
    }
  }

  for (const partName of Object.keys(partSubStageFrames)) {
    for (const subId of Object.keys(partSubStageFrames[partName])) {
      partSubStageFrames[partName][subId] = svgCatalogFrameToDisplayUnits(
        partSubStageFrames[partName][subId],
        RASTER_TO_DISPLAY_FOR_MAIN_SHEET,
      );
    }
  }

  return {
    kind: 'svg',
    speciesId,
    imagePath: `/plant_sprites/${speciesId}.png`,
    atlasWidth: pngDimensions.width,
    atlasHeight: pngDimensions.height,
    partSubStageFrames,
    textureFilter: 'linear',
    lifeStagePackItems,
    inspectSvg,
  };
}

function buildFromLegacyPng(plantDir, spriteAlphaCache) {
  const plant = readJson(path.join(plantDir, 'plant.json'));
  const speciesId = plant.id;
  const { jsonPath, pngPath } = requireLegacyAtlasPaths(plantDir, speciesId);
  const atlas = readJson(jsonPath);
  const texture = atlas.textures?.[0];
  if (!texture || !Array.isArray(texture.frames)) {
    throw new Error(`Invalid atlas format for ${speciesId} (${LEGACY_ATLAS_BASENAME})`);
  }
  const uniqueFrames = legacyUniqueFilenameFrames(texture.frames);

  const pngDimensions = readPngDimensionsFromBufferOrPath(pngPath);
  const logicalWidth = texture.size?.w;
  const logicalHeight = texture.size?.h;
  const scaleX = logicalWidth ? pngDimensions.width / logicalWidth : 1;
  const scaleY = logicalHeight ? pngDimensions.height / logicalHeight : 1;

  const frameByFilename = Object.fromEntries(uniqueFrames.map((frame) => [frame.filename, frame]));
  const opaqueBottomByKey = getOpaqueBottomByFrameKey(pngPath, uniqueFrames, spriteAlphaCache);
  const lifeStageFrames = {};

  for (const lifeStage of plant.life_stages || []) {
    const filename = `${speciesId}_${lifeStage.stage}.png`;
    const frame = frameByFilename[filename];
    if (frame) {
      const k = frameKey(frame);
      const normalized = normalizeFrame(frame, opaqueBottomByKey[k], {
        centerAnchored: lifeStage.center_anchored_sprite === true,
      });
      lifeStageFrames[lifeStage.stage] = scaledCatalogFrame(normalized, scaleX, scaleY);
    }
  }

  const partSubStageFrames = {};
  for (const part of plant.parts || []) {
    const partName = part?.name;
    if (!partName) {
      continue;
    }
    for (const subStage of part.sub_stages || part.subStages || []) {
      const subId = subStage?.id;
      if (!subId) {
        continue;
      }
      const specificFile = `${speciesId}_${partName}_${subId}.png`;
      const genericFile = `${speciesId}_${partName}.png`;
      const frame = frameByFilename[specificFile] || frameByFilename[genericFile];
      if (!frame) {
        continue;
      }
      const usedFile = frameByFilename[specificFile] ? specificFile : genericFile;
      const k = frameKey(frame);
      const normalized = normalizeFrame(frame, opaqueBottomByKey[k]);
      if (!partSubStageFrames[partName]) {
        partSubStageFrames[partName] = {};
      }
      partSubStageFrames[partName][subId] = scaledCatalogFrame(normalized, scaleX, scaleY);
    }
  }

  const publicSpritePath = path.join(PUBLIC_SPRITES_DIR, `${speciesId}.png`);
  fs.copyFileSync(pngPath, publicSpritePath);

  const mainImagePath = `/plant_sprites/${speciesId}.png`;
  const w = pngDimensions.width;
  const h = pngDimensions.height;

  return {
    speciesId,
    imagePath: mainImagePath,
    atlasWidth: w,
    atlasHeight: h,
    lifeStageFrames,
    partSubStageFrames: stampPartSubStageFramesWithMainTexture(
      partSubStageFrames,
      mainImagePath,
      w,
      h,
    ),
    textureFilter: 'nearest',
  };
}

async function buildSpeciesSpriteEntry(plantDir, spriteAlphaCache) {
  const svg = readSvgAtlasIfPresent(plantDir);
  if (svg) {
    return buildFromSvgSource(plantDir, svg.json, spriteAlphaCache);
  }
  return { kind: 'legacy', entry: buildFromLegacyPng(plantDir, spriteAlphaCache) };
}

async function main() {
  const spriteAlphaCache = loadSpriteAlphaCache();

  if (fs.existsSync(PUBLIC_SPRITES_DIR)) {
    fs.rmSync(PUBLIC_SPRITES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLIC_SPRITES_DIR, { recursive: true });

  if (fs.existsSync(PUBLIC_PLANT_SVG_DIR)) {
    fs.rmSync(PUBLIC_PLANT_SVG_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLIC_PLANT_SVG_DIR, { recursive: true });

  const dirs = listPlantDirectories();
  const results = await Promise.all(
    dirs.map((plantDir) => buildSpeciesSpriteEntry(plantDir, spriteAlphaCache)),
  );
  const legacy = results
    .filter((r) => r.kind === 'legacy')
    .map((r) => r.entry);
  const svgInters = results.filter((r) => r.kind === 'svg');
  const packItems = [];
  for (const m of svgInters) {
    for (const it of m.lifeStagePackItems) {
      packItems.push(it);
    }
  }
  const lifeStageLookup = new Map();
  await renderAndCatalogLifeStagePages(
    packItems,
    spriteAlphaCache,
    PUBLIC_SPRITES_DIR,
    lifeStageLookup,
  );
  const svgEntries = svgInters.map((m) => {
    const lifeStageFrames = {};
    for (const p of m.lifeStagePackItems) {
      const e = lifeStageLookup.get(`${p.speciesId}::${p.stage}`);
      if (!e) {
        throw new Error(`Missing packed life stage catalog for ${p.speciesId}::${p.stage}`);
      }
      lifeStageFrames[p.stage] = e;
    }
    return {
      speciesId: m.speciesId,
      imagePath: m.imagePath,
      atlasWidth: m.atlasWidth,
      atlasHeight: m.atlasHeight,
      lifeStageFrames,
      partSubStageFrames: stampPartSubStageFramesWithMainTexture(
        m.partSubStageFrames,
        m.imagePath,
        m.atlasWidth,
        m.atlasHeight,
      ),
      textureFilter: m.textureFilter,
      inspectSvg: m.inspectSvg,
    };
  });
  const entries = [...legacy, ...svgEntries].sort((a, b) => a.speciesId.localeCompare(b.speciesId));

  copyUniversalSprites();
  copyIsometricSprites();

  const catalog = Object.fromEntries(entries.map((e) => [e.speciesId, {
    imagePath: e.imagePath,
    atlasWidth: e.atlasWidth,
    atlasHeight: e.atlasHeight,
    lifeStageFrames: e.lifeStageFrames,
    partSubStageFrames: e.partSubStageFrames,
    textureFilter: e.textureFilter || 'nearest',
    inspectSvg: e.inspectSvg ?? null,
  }]));

  const output = `const PLANT_SPRITE_CATALOG_SOURCE = ${JSON.stringify(catalog, null, 2)};\n\nexport default PLANT_SPRITE_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  saveSpriteAlphaCache(spriteAlphaCache);

  console.log(`Wrote sprite catalog for ${entries.length} species to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
