/**
 * SVG atlas probing — keep in sync with `readSvgAtlasIfPresent` / `resolveMergedSvgFile`
 * in `scripts/build-plant-sprite-catalog.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SVG_ATLAS_JSON = 'atlas.json';
export const LEGACY_ATLAS_BASENAME = 'spritesheet_rd_final';

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function readSvgAtlasIfPresent(plantDir) {
  const p = path.join(plantDir, SVG_ATLAS_JSON);
  if (!fs.existsSync(p)) {
    return null;
  }
  const json = readJson(p);
  const t0 = json.textures?.[0];
  if (String(t0?.format).toUpperCase() !== 'SVG' || !Array.isArray(t0?.frames) || t0.frames.length === 0) {
    return null;
  }
  return { path: p, json, texture: t0 };
}

export function resolveMergedSvgFile(plantDir, texture) {
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

export function hasLegacyAtlas(plantDir) {
  const jsonPath = path.join(plantDir, `${LEGACY_ATLAS_BASENAME}.json`);
  const pngPath = path.join(plantDir, `${LEGACY_ATLAS_BASENAME}.png`);
  return fs.existsSync(jsonPath) && fs.existsSync(pngPath);
}

/**
 * @param {string} plantDir
 * @returns {{ exists: boolean, format: string | null, frameCount: number }}
 */
export function describeAtlasJsonFile(plantDir) {
  const p = path.join(plantDir, SVG_ATLAS_JSON);
  if (!fs.existsSync(p)) {
    return { exists: false, format: null, frameCount: 0 };
  }
  try {
    const raw = readJson(p);
    const t0 = raw.textures?.[0];
    const format = t0?.format != null ? String(t0.format) : null;
    const frames = Array.isArray(t0?.frames) ? t0.frames : [];
    return { exists: true, format, frameCount: frames.length };
  } catch {
    return { exists: true, format: null, frameCount: 0, parseError: true };
  }
}
