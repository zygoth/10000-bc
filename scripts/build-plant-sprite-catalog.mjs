import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve('.');
const PLANTS_DIR = path.join(ROOT, 'data', 'plants');
const PUBLIC_SPRITES_DIR = path.join(ROOT, 'public', 'plant_sprites');
const DATA_ISOMETRIC_SPRITES_DIR = path.join(ROOT, 'data', 'isometric_sprites');
const PUBLIC_ISOMETRIC_SPRITES_DIR = path.join(ROOT, 'public', 'isometric_sprites');
const OUTPUT_FILE = path.join(ROOT, 'src', 'game', 'plantSpriteCatalog.source.mjs');
const SPRITE_ALPHA_CACHE_FILE = path.join(ROOT, '.cache', 'plant-sprite-alpha-cache.json');
const REQUIRED_ATLAS_BASENAME = 'spritesheet_rd_final';
const UNIVERSAL_DIR = path.join(PLANTS_DIR, 'universal');
const UNIVERSAL_DEAD_TREE_SPRITE = 'dead_tree.png';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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
    throw new Error('Unsupported interlaced PNG for sprite atlas decode');
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

function getOpaqueBottomByFrame(pngPath, textureFrames, cache) {
  const stat = fs.statSync(pngPath);
  const signature = `${stat.size}:${Math.floor(stat.mtimeMs)}`;
  const cached = cache.files?.[pngPath];

  if (cached?.signature === signature && cached?.frameOpaqueBottomByFilename) {
    return cached.frameOpaqueBottomByFilename;
  }

  const decoded = decodePngRgba(fs.readFileSync(pngPath));
  const frameOpaqueBottomByFilename = {};
  for (const frame of textureFrames) {
    if (frame.rotated === true) {
      throw new Error(`Unsupported rotated frame in atlas: ${frame.filename}`);
    }
    frameOpaqueBottomByFilename[frame.filename] = firstOpaqueFromBottom(decoded, frame);
  }

  cache.files[pngPath] = {
    signature,
    frameOpaqueBottomByFilename,
  };

  return frameOpaqueBottomByFilename;
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

function requireFinalAtlasPaths(plantDir, speciesId) {
  const jsonPath = path.join(plantDir, `${REQUIRED_ATLAS_BASENAME}.json`);
  const pngPath = path.join(plantDir, `${REQUIRED_ATLAS_BASENAME}.png`);

  if (!fs.existsSync(jsonPath) || !fs.existsSync(pngPath)) {
    throw new Error(
      `Missing required final atlas pair for ${speciesId}: ${REQUIRED_ATLAS_BASENAME}.json/.png`,
    );
  }

  return { jsonPath, pngPath };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizeFrame(frame, opaqueBottomInFrame = null) {
  const sourceW = frame.sourceSize?.w ?? frame.frame.w;
  const sourceH = frame.sourceSize?.h ?? frame.frame.h;
  const offsetX = frame.spriteSourceSize?.x ?? 0;
  const offsetY = frame.spriteSourceSize?.y ?? 0;

  return {
    x: frame.frame.x,
    y: frame.frame.y,
    w: frame.frame.w,
    h: frame.frame.h,
    sourceW,
    sourceH,
    offsetX,
    offsetY,
    anchorX: offsetX + (frame.frame.w / 2),
    anchorY: offsetY + ((opaqueBottomInFrame === null || opaqueBottomInFrame === undefined)
      ? frame.frame.h
      : (opaqueBottomInFrame + 1)),
  };
}

function readPngDimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function buildSpeciesSpriteEntry(plantDir, spriteAlphaCache) {
  const plant = readJson(path.join(plantDir, 'plant.json'));
  const speciesId = plant.id;

  const { jsonPath, pngPath } = requireFinalAtlasPaths(plantDir, speciesId);
  const atlas = readJson(jsonPath);
  const texture = atlas.textures?.[0];
  if (!texture || !Array.isArray(texture.frames)) {
    throw new Error(`Invalid atlas format for ${speciesId} (${REQUIRED_ATLAS_BASENAME})`);
  }

  const pngDimensions = readPngDimensions(pngPath);
  const logicalWidth = texture.size?.w;
  const logicalHeight = texture.size?.h;
  const scaleX = logicalWidth ? pngDimensions.width / logicalWidth : 1;
  const scaleY = logicalHeight ? pngDimensions.height / logicalHeight : 1;

  const frameByFilename = Object.fromEntries(texture.frames.map((frame) => [frame.filename, frame]));
  const opaqueBottomByFilename = getOpaqueBottomByFrame(pngPath, texture.frames, spriteAlphaCache);
  const lifeStageFrames = {};

  for (const lifeStage of plant.life_stages || []) {
    const filename = `${speciesId}_${lifeStage.stage}.png`;
    const frame = frameByFilename[filename];
    if (frame) {
      const normalized = normalizeFrame(frame, opaqueBottomByFilename[filename]);
      lifeStageFrames[lifeStage.stage] = {
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
    }
  }

  const publicSpritePath = path.join(PUBLIC_SPRITES_DIR, `${speciesId}.png`);
  fs.copyFileSync(pngPath, publicSpritePath);

  return {
    speciesId,
    imagePath: `/plant_sprites/${speciesId}.png`,
    atlasWidth: pngDimensions.width,
    atlasHeight: pngDimensions.height,
    lifeStageFrames,
  };
}

function main() {
  const spriteAlphaCache = loadSpriteAlphaCache();

  if (fs.existsSync(PUBLIC_SPRITES_DIR)) {
    fs.rmSync(PUBLIC_SPRITES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLIC_SPRITES_DIR, { recursive: true });

  const entries = listPlantDirectories()
    .map((plantDir) => buildSpeciesSpriteEntry(plantDir, spriteAlphaCache))
    .sort((a, b) => a.speciesId.localeCompare(b.speciesId));

  copyUniversalSprites();
  copyIsometricSprites();

  const catalog = Object.fromEntries(entries.map((entry) => [entry.speciesId, {
    imagePath: entry.imagePath,
    atlasWidth: entry.atlasWidth,
    atlasHeight: entry.atlasHeight,
    lifeStageFrames: entry.lifeStageFrames,
  }]));

  const output = `const PLANT_SPRITE_CATALOG_SOURCE = ${JSON.stringify(catalog, null, 2)};\n\nexport default PLANT_SPRITE_CATALOG_SOURCE;\n`;
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  saveSpriteAlphaCache(spriteAlphaCache);

  console.log(`Wrote sprite catalog for ${entries.length} species to ${OUTPUT_FILE}`);
}

main();
