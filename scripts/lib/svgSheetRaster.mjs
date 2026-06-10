/**
 * Shared merged-SVG → PNG + frame math for tool sheets and (optionally) plant builds.
 * Keep in sync with `build-plant-sprite-catalog.mjs` (same formulas).
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export const SVG_RASTER_CELL_PX = 256;
/** Merged-SVG isometric / world draw: 2× oversample vs 64px logical (vs 4× for `SVG_RASTER_CELL_PX`). */
export const SVG_RASTER_CELL_PX_WORLD = 128;
export const DISPLAY_TEXTURE_CELL_PX = 64;
export const RASTER_TO_DISPLAY_FOR_MAIN_SHEET = SVG_RASTER_CELL_PX / DISPLAY_TEXTURE_CELL_PX;
export const RASTER_TO_DISPLAY_FOR_WORLD_SHEET = SVG_RASTER_CELL_PX_WORLD / DISPLAY_TEXTURE_CELL_PX;

/**
 * Texture pixels per logical 64px display cell (e.g. 256 → 4, 128 → 2).
 * @param {number} cellPx
 */
export function rasterToDisplayRatioForCell(cellPx) {
  return cellPx / DISPLAY_TEXTURE_CELL_PX;
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

export function decodePngRgba(bytes) {
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

export function atlasFrameRectsToRasterSpace(frames, logicalW, logicalH, pngW, pngH) {
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

export function frameKey(frame) {
  if (typeof frame?.spriteId === 'string' && frame.spriteId) {
    return frame.spriteId;
  }
  if (typeof frame?.filename === 'string' && frame.filename) {
    return frame.filename;
  }
  return '';
}

export function getOpaqueBottomByFrameKey(pngPath, textureFrames, cache) {
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

/**
 * @returns {Buffer}
 */
export function rasterizeSvgToPng(svgPath, outWidth) {
  const w = Math.max(1, Math.round(outWidth));
  const svgText = fs.readFileSync(svgPath, 'utf-8');
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: w },
    background: 'transparent',
  });
  return resvg.render().asPng();
}

export function readPngDimensionsFromBufferOrPath(bufOrPath) {
  const bytes = typeof bufOrPath === 'string' ? fs.readFileSync(bufOrPath) : bufOrPath;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

export function normalizeFrame(frame, opaqueBottomInFrame = null) {
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

export function scaledCatalogFrame(normalized, scaleX, scaleY) {
  return {
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

export function svgCatalogFrameToDisplayUnits(entry, rasterToDisplayRatio) {
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

/**
 * Write one raster of a merged sprite sheet, scan alpha for foot anchors, return data for catalog UVs.
 *
 * @param {object} opts
 * @param {string} opts.svgFile
 * @param {number} opts.logicalW
 * @param {number} opts.logicalH
 * @param {Array} opts.frames
 * @param {number} opts.cellW
 * @param {number} opts.cellPx
 * @param {string} opts.pngPath
 * @param {object} opts.alphaCache
 */
export function rasterizeMergedSheetLayer({
  svgFile, logicalW, logicalH, frames, cellW, cellPx, pngPath, alphaCache,
}) {
  const targetRasterWidth = Math.max(1, Math.round((logicalW * cellPx) / cellW));
  const pngBuffer = rasterizeSvgToPng(svgFile, targetRasterWidth);
  fs.writeFileSync(pngPath, pngBuffer);
  const pngDimensions = readPngDimensionsFromBufferOrPath(pngBuffer);
  const rasterFrames = atlasFrameRectsToRasterSpace(
    frames,
    logicalW,
    logicalH,
    pngDimensions.width,
    pngDimensions.height,
  );
  const opaqueByKey = getOpaqueBottomByFrameKey(pngPath, rasterFrames, alphaCache);
  const rasterToDisplay = rasterToDisplayRatioForCell(cellPx);
  return {
    pngBuffer,
    pngDimensions,
    rasterFrames,
    opaqueByKey,
    rasterToDisplay,
  };
}

/**
 * @param {object} f — one entry from `rasterFrames`
 * @param {Record<string, number | undefined>} opaqueByKey
 * @param {string} key — spriteId
 * @param {{ width: number, height: number }} pngDimensions
 * @param {number} rasterToDisplay
 * @param {string} publicUrlPath
 */
export function catalogEntryFromRasterFrame(f, opaqueByKey, key, pngDimensions, rasterToDisplay, publicUrlPath) {
  const op = opaqueByKey[key];
  const normalized = normalizeFrame(f, op);
  const display = svgCatalogFrameToDisplayUnits(
    scaledCatalogFrame(normalized, 1, 1),
    rasterToDisplay,
  );
  return {
    imagePath: publicUrlPath,
    atlasWidth: pngDimensions.width,
    atlasHeight: pngDimensions.height,
    frame: {
      x: display.x,
      y: display.y,
      w: display.w,
      h: display.h,
      sourceW: display.sourceW,
      sourceH: display.sourceH,
      offsetX: display.offsetX,
      offsetY: display.offsetY,
      anchorX: display.anchorX,
      anchorY: display.anchorY,
    },
    textureFilter: 'linear',
  };
}
