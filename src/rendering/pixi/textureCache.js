import { Assets, Rectangle, Texture } from 'pixi.js';

const fullTexturePromises = new Map();
const subTextureCache = new Map();

export function publicAssetUrl(imagePath) {
  const base = typeof process !== 'undefined' && process.env.PUBLIC_URL ? process.env.PUBLIC_URL : '';
  const p = typeof imagePath === 'string' && imagePath.startsWith('/') ? imagePath : `/${imagePath || ''}`;
  return `${base}${p}`;
}

function frameCacheKey(sprite) {
  const { imagePath, frame } = sprite;
  return `${imagePath}@${frame.x},${frame.y},${frame.w},${frame.h}`;
}

export function configureTextureNearest(texture) {
  configureTextureSampling(texture, 'nearest');
}

/** @param {'nearest'|'linear'} mode */
export function configureTextureSampling(texture, mode) {
  if (texture?.source) {
    const f = mode === 'linear' ? 'linear' : 'nearest';
    texture.source.style.magFilter = f;
    texture.source.style.minFilter = f;
  }
}

/**
 * @param {object} sprite — shape from plantSpriteCatalog (imagePath, atlasWidth, atlasHeight, frame)
 * @returns {Promise<Texture>}
 */
export async function getSubTextureForSprite(sprite) {
  if (!sprite?.imagePath || !sprite?.frame) {
    return Texture.WHITE;
  }
  const key = frameCacheKey(sprite);
  if (subTextureCache.has(key)) {
    return subTextureCache.get(key);
  }
  const url = publicAssetUrl(sprite.imagePath);
  let basePromise = fullTexturePromises.get(url);
  if (!basePromise) {
    basePromise = Assets.load(url);
    fullTexturePromises.set(url, basePromise);
  }
  const base = await basePromise;
  const filterMode = sprite.textureFilter === 'linear' ? 'linear' : 'nearest';
  configureTextureSampling(base, filterMode);
  const { x, y, w, h } = sprite.frame;
  const sub = new Texture({
    source: base.source,
    frame: new Rectangle(x, y, w, h),
  });
  configureTextureSampling(sub, filterMode);
  subTextureCache.set(key, sub);
  return sub;
}
