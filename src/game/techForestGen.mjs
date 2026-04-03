import { mulberry32 } from './simWorld.mjs';
import {
  TECH_RESEARCHABLE_UNLOCK_KEYS,
  TECH_STARTER_ROOT_PREFERENCE,
  getTechResearchMeta,
  rollResearchTicksForKey,
} from './techResearchCatalog.mjs';

const FOREST_VERSION = 1;

function shuffleWithRng(array, rng) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @param {number} seed
 * @param {{ forestDepth?: number }} [options]
 */
export function generateTechForest(seed, options = {}) {
  const depth = Number.isInteger(options.forestDepth) && options.forestDepth >= 1
    ? Math.min(4, options.forestDepth)
    : 3;

  const keys = [...TECH_RESEARCHABLE_UNLOCK_KEYS].sort((a, b) => a.localeCompare(b));
  const n = keys.length;
  const numTrees = Math.ceil(n / depth);

  const rng = mulberry32((Number(seed) || 0) * 9301 + 49297 + 233280);

  const starters = TECH_STARTER_ROOT_PREFERENCE.filter((k) => keys.includes(k));
  const nonStarters = keys.filter((k) => !starters.includes(k));
  const startersShuffled = shuffleWithRng(starters, rng);
  const nonStartersShuffled = shuffleWithRng(nonStarters, rng);
  const priorityOrder = [...startersShuffled, ...nonStartersShuffled];

  const roots = priorityOrder.slice(0, numTrees);
  const chainKeys = priorityOrder.slice(numTrees);

  const lengths = [];
  {
    const base = Math.floor(n / numTrees);
    const extra = n % numTrees;
    for (let i = 0; i < numTrees; i += 1) {
      lengths.push(base + (i < extra ? 1 : 0));
    }
  }

  const trees = [];
  const byUnlockKey = Object.create(null);

  let chainPtr = 0;
  for (let t = 0; t < numTrees; t += 1) {
    const len = lengths[t];
    const chain = [];
    if (len === 0) {
      trees.push({ id: t, nodes: chain });
      continue;
    }

    const rootKey = roots[t];
    const meta0 = getTechResearchMeta(rootKey);
    const ticks0 = rollResearchTicksForKey(rng, meta0.baseTicks, meta0.maxVariance);
    chain.push({
      unlockKey: rootKey,
      parentUnlockKey: null,
      depth: 0,
      researchTicks: ticks0,
    });
    byUnlockKey[rootKey] = { treeId: t, depth: 0, parentUnlockKey: null, researchTicks: ticks0 };

    for (let d = 1; d < len; d += 1) {
      const parent = chain[d - 1];
      const k = chainKeys[chainPtr];
      chainPtr += 1;
      const meta = getTechResearchMeta(k);
      const researchTicks = rollResearchTicksForKey(rng, meta.baseTicks, meta.maxVariance);
      chain.push({
        unlockKey: k,
        parentUnlockKey: parent.unlockKey,
        depth: d,
        researchTicks,
      });
      byUnlockKey[k] = {
        treeId: t,
        depth: d,
        parentUnlockKey: parent.unlockKey,
        researchTicks,
      };
    }
    trees.push({ id: t, nodes: chain });
  }

  return {
    version: FOREST_VERSION,
    depth,
    trees,
    byUnlockKey,
  };
}

/** @param {ReturnType<typeof generateTechForest>} forest */
export function getTechForestNode(forest, unlockKey) {
  if (!forest?.byUnlockKey || typeof unlockKey !== 'string') {
    return null;
  }
  return forest.byUnlockKey[unlockKey] || null;
}

/**
 * First key on the path from `fromUnlockKey` through parents whose `techUnlocks` is not true.
 * Returns null when `fromUnlockKey` and every forest ancestor to the root are `techUnlocks === true`.
 *
 * Used to gate **new** tech research on descendants: a vision may set a deep `techUnlocks` entry
 * without earlier chain links; children must not become queueable until the full chain is filled.
 *
 * @param {ReturnType<typeof generateTechForest>} forest
 * @param {Record<string, boolean>|null|undefined} techUnlocks
 * @param {string} fromUnlockKey
 * @returns {string|null}
 */
export function getTechForestStrictPrerequisiteBlocker(forest, techUnlocks, fromUnlockKey) {
  if (typeof fromUnlockKey !== 'string' || !fromUnlockKey) {
    return null;
  }
  if (!forest?.byUnlockKey?.[fromUnlockKey]) {
    return fromUnlockKey;
  }
  let current = fromUnlockKey;
  while (current) {
    if (techUnlocks?.[current] !== true) {
      return current;
    }
    const node = forest.byUnlockKey[current];
    if (!node?.parentUnlockKey) {
      return null;
    }
    current = node.parentUnlockKey;
  }
  return null;
}

/**
 * Why a forest child node cannot queue research yet (strict chain vs vision-only parent).
 * @typedef {{ blockerKey: string, reason: 'strict' | 'vision_parent' }} TechForestChildResearchBlocker
 */

/**
 * Gate for researching a node whose forest parent is `parentUnlockKey`.
 * After strict `techUnlocks` chain from parent is satisfied, a parent granted only by vision
 * still blocks children until partner camp research completes on that parent (`techUnlockPartnerResearch`).
 *
 * @param {ReturnType<typeof generateTechForest>} forest
 * @param {Record<string, boolean>|null|undefined} techUnlocks
 * @param {string} parentUnlockKey
 * @param {Record<string, boolean>|null|undefined} visionGranted
 * @param {Record<string, boolean>|null|undefined} partnerResearched
 * @returns {TechForestChildResearchBlocker|null}
 */
export function getTechForestChildResearchBlocker(
  forest,
  techUnlocks,
  parentUnlockKey,
  visionGranted,
  partnerResearched,
) {
  if (typeof parentUnlockKey !== 'string' || !parentUnlockKey) {
    return null;
  }
  const strict = getTechForestStrictPrerequisiteBlocker(forest, techUnlocks, parentUnlockKey);
  if (strict) {
    return { blockerKey: strict, reason: 'strict' };
  }
  if (
    visionGranted?.[parentUnlockKey] === true
    && partnerResearched?.[parentUnlockKey] !== true
  ) {
    return { blockerKey: parentUnlockKey, reason: 'vision_parent' };
  }
  return null;
}

/**
 * True when this key counts as fully unlocked in the tech forest UI.
 * Normal case: researched and every forest ancestor is also researched.
 * Also true when this exact key was granted by a vision (no prereq research required for display)
 * or completed via partner tech research (ticks spent), even if an earlier chain link is still locked.
 *
 * @param {{ visionGranted?: Record<string, boolean>, partnerResearched?: Record<string, boolean> }|null} [displaySources]
 */
export function isTechResearchDisplayComplete(forest, techUnlocks, unlockKey, displaySources = null) {
  if (typeof unlockKey !== 'string' || !unlockKey || techUnlocks?.[unlockKey] !== true) {
    return false;
  }
  if (displaySources?.visionGranted?.[unlockKey] === true) {
    return true;
  }
  if (displaySources?.partnerResearched?.[unlockKey] === true) {
    return true;
  }
  let current = unlockKey;
  while (current) {
    const node = forest?.byUnlockKey?.[current];
    if (!node) {
      return false;
    }
    if (!node.parentUnlockKey) {
      return true;
    }
    if (techUnlocks?.[node.parentUnlockKey] !== true) {
      return false;
    }
    current = node.parentUnlockKey;
  }
  return true;
}

/**
 * Fresh run: all research keys false (nothing pre-researched).
 * @param {ReturnType<typeof generateTechForest>} forest
 */
export function initialTechUnlocksAllLocked(forest) {
  const out = Object.create(null);
  for (const key of TECH_RESEARCHABLE_UNLOCK_KEYS) {
    if (forest?.byUnlockKey?.[key]) {
      out[key] = false;
    }
  }
  return out;
}

/**
 * Merge loaded save keys with forest; missing keys default false.
 * @param {ReturnType<typeof generateTechForest>} forest
 * @param {Record<string, boolean>|null|undefined} existing
 */
export function mergeTechUnlocksFromSave(forest, existing) {
  const out = initialTechUnlocksAllLocked(forest);
  if (!existing || typeof existing !== 'object') {
    return out;
  }
  for (const key of Object.keys(out)) {
    if (existing[key] === true) {
      out[key] = true;
    }
  }
  return out;
}

/**
 * Legacy snapshot: had no tech system — treat all research as already unlocked.
 */
export function techUnlocksAllTrueForLegacy(forest) {
  const out = Object.create(null);
  for (const key of TECH_RESEARCHABLE_UNLOCK_KEYS) {
    if (forest?.byUnlockKey?.[key]) {
      out[key] = true;
    }
  }
  return out;
}

function saveHasAnyResearchUnlockKey(techUnlocks) {
  if (!techUnlocks || typeof techUnlocks !== 'object') {
    return false;
  }
  return TECH_RESEARCHABLE_UNLOCK_KEYS.some((k) => (
    Object.prototype.hasOwnProperty.call(techUnlocks, k)
  ));
}

/**
 * Mutates candidate load state: ensures techForest + techUnlocks align.
 * Legacy saves (no forest, no per-key unlocks) get all research unlocked.
 * @param {Record<string, unknown>} candidate
 */
export function ensureTechForestOnLoad(candidate) {
  const seed = Number(candidate?.seed) || 10000;
  const existingForest = candidate?.techForest && Array.isArray(candidate.techForest.trees);
  if (!existingForest) {
    const forest = generateTechForest(seed);
    candidate.techForest = forest;
    if (!saveHasAnyResearchUnlockKey(candidate.techUnlocks)) {
      candidate.techUnlocks = techUnlocksAllTrueForLegacy(forest);
    } else {
      candidate.techUnlocks = mergeTechUnlocksFromSave(forest, candidate.techUnlocks);
    }
    if (!candidate.techUnlockVisionGranted || typeof candidate.techUnlockVisionGranted !== 'object') {
      candidate.techUnlockVisionGranted = {};
    }
    if (!candidate.techUnlockPartnerResearch || typeof candidate.techUnlockPartnerResearch !== 'object') {
      candidate.techUnlockPartnerResearch = {};
    }
    return;
  }
  candidate.techUnlocks = mergeTechUnlocksFromSave(candidate.techForest, candidate.techUnlocks);
  if (!candidate.techUnlockVisionGranted || typeof candidate.techUnlockVisionGranted !== 'object') {
    candidate.techUnlockVisionGranted = {};
  }
  if (!candidate.techUnlockPartnerResearch || typeof candidate.techUnlockPartnerResearch !== 'object') {
    candidate.techUnlockPartnerResearch = {};
  }
}
