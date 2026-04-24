/**
 * Ambient SFX can ship multiple files per catalog URL: `name.ogg`, `name_v1.ogg`, `name_v2.ogg`, …
 * `list-missing-sound-assets.mjs` writes which exist to `public/sounds/ambient/variant-manifest.json`.
 */

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} catalogUrl e.g. `/sounds/ambient/meleagris_gallopavo_gobble.ogg`
 * @param {string[]} diskFileNames basenames only (e.g. from readdir), typically `.ogg` / `.wav`
 * @returns {string[]} full URL paths under site root for files in this variant group, sorted (base then v1, v2, …)
 */
export function collectVariantUrlsForCatalogEntry(catalogUrl, diskFileNames) {
  if (typeof catalogUrl !== 'string' || !catalogUrl.startsWith('/sounds/')) {
    return [];
  }
  const lastSlash = catalogUrl.lastIndexOf('/');
  const name = lastSlash >= 0 ? catalogUrl.slice(lastSlash + 1) : catalogUrl;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  if (!ext) {
    return [];
  }
  const stem = name.slice(0, -ext.length);
  if (!stem) {
    return [];
  }
  const re = new RegExp(`^${escapeRegex(stem)}(_v\\d+)?${escapeRegex(ext)}$`);
  const matches = diskFileNames.filter((f) => re.test(f));
  if (matches.length === 0) {
    return [];
  }
  matches.sort((a, b) => {
    const am = /_v(\d+)(?=\.[^.]+$)/.exec(a);
    const bm = /_v(\d+)(?=\.[^.]+$)/.exec(b);
    if (!am && !bm) {
      return a.localeCompare(b);
    }
    if (!am) {
      return -1;
    }
    if (!bm) {
      return 1;
    }
    return Number(am[1]) - Number(bm[1]);
  });
  const dir = lastSlash >= 0 ? catalogUrl.slice(0, lastSlash) : '';
  return matches.map((f) => `${dir}/${f}`);
}

/**
 * @param {string[]} catalogUrls
 * @param {string[]} diskFileNames
 * @returns {Record<string, string[]>} logical catalog url -> non-empty list of existing variant urls
 */
export function buildAmbientVariantGroupMap(catalogUrls, diskFileNames) {
  /** @type {Record<string, string[]>} */
  const groups = {};
  const seen = new Set(catalogUrls);
  for (const url of seen) {
    const list = collectVariantUrlsForCatalogEntry(url, diskFileNames);
    if (list.length > 0) {
      groups[url] = list;
    }
  }
  return groups;
}

/**
 * @param {string} catalogUrl
 * @param {Record<string, string[]|undefined>} groups from manifest
 * @param {() => number} rng in [0,1)
 * @returns {string} physical url to load
 */
export function pickAmbientVariantUrl(catalogUrl, groups, rng) {
  const g = groups?.[catalogUrl];
  if (!Array.isArray(g) || g.length === 0) {
    return catalogUrl;
  }
  const u = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  const i = Math.floor(u * g.length);
  return g[Math.min(i, g.length - 1)];
}
