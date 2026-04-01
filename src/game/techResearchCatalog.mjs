/**
 * Tech forest: researchable unlock keys and per-run tick metadata (GDD §11.2).
 * Keep in sync with requiredUnlock on TOOL_RECIPES / CAMP_STATION_RECIPES in simActions.mjs.
 */

/** @type {string[]} */
export const TECH_RESEARCHABLE_UNLOCK_KEYS = [
  'unlock_station_drying_rack',
  'unlock_station_workbench',
  'unlock_station_thread_spinner',
  'unlock_station_hide_frame',
  'unlock_station_mortar_pestle',
  'unlock_station_sugar_boiling_station',
  'unlock_tool_axe',
  'unlock_tool_ladder',
  'unlock_tool_simple_snare',
  'unlock_tool_dead_fall_trap',
  'unlock_tool_basket',
  'unlock_tool_blickey',
  'unlock_tool_leaching_basket',
  'unlock_tool_shovel',
  'unlock_tool_hoe',
  'unlock_tool_fish_trap_weir',
  'unlock_tool_fishing_rod',
  'unlock_tool_auto_rod',
  'unlock_tool_wooden_platform',
  'unlock_tool_sled',
  'unlock_tool_waterskin',
  'unlock_tool_coat',
];

/** Prefer these as tree roots (ungated); remainder filled after shuffle (GDD §11.1). */
export const TECH_STARTER_ROOT_PREFERENCE = [
  'unlock_tool_hoe',
  'unlock_tool_basket',
  'unlock_tool_simple_snare',
];

const TECH_RESEARCH_META = {
  unlock_station_drying_rack: {
    label: 'Drying Rack',
    baseTicks: 250,
    maxVariance: 0.2,
    tags: ['food_processing'],
  },
  unlock_station_workbench: {
    label: 'Workbench',
    baseTicks: 350,
    maxVariance: 0.2,
    tags: ['materials_processing'],
  },
  unlock_station_thread_spinner: {
    label: 'Thread Spinner',
    baseTicks: 350,
    maxVariance: 0.25,
    tags: ['materials_processing'],
  },
  unlock_station_hide_frame: {
    label: 'Hide Frame',
    baseTicks: 200,
    maxVariance: 0.2,
    tags: ['materials_processing', 'clothing'],
  },
  unlock_station_mortar_pestle: {
    label: 'Mortar & Pestle',
    baseTicks: 140,
    maxVariance: 0.2,
    tags: ['food_processing', 'materials_processing'],
  },
  unlock_station_sugar_boiling_station: {
    label: 'Sugar Boiling Station',
    baseTicks: 400,
    maxVariance: 0.25,
    tags: ['food_processing'],
  },
  unlock_tool_axe: {
    label: 'Axe',
    baseTicks: 220,
    maxVariance: 0.2,
    tags: ['land_harvest'],
  },
  unlock_tool_ladder: {
    label: 'Ladder',
    baseTicks: 350,
    maxVariance: 0.25,
    tags: ['land_harvest'],
  },
  unlock_tool_simple_snare: {
    label: 'Simple Snare',
    baseTicks: 100,
    maxVariance: 0.2,
    tags: ['food_acquisition'],
  },
  unlock_tool_dead_fall_trap: {
    label: 'Dead-fall Trap',
    baseTicks: 120,
    maxVariance: 0.2,
    tags: ['food_acquisition'],
  },
  unlock_tool_basket: {
    label: 'Basket',
    baseTicks: 150,
    maxVariance: 0.25,
    tags: ['storage_transport'],
  },
  unlock_tool_blickey: {
    label: 'Blickey',
    baseTicks: 120,
    maxVariance: 0.3,
    tags: ['storage_transport'],
  },
  unlock_tool_leaching_basket: {
    label: 'Leaching Basket',
    baseTicks: 210,
    maxVariance: 0.25,
    tags: ['food_processing', 'storage_transport'],
  },
  unlock_tool_shovel: {
    label: 'Shovel',
    baseTicks: 200,
    maxVariance: 0.25,
    tags: ['land_harvest'],
  },
  unlock_tool_hoe: {
    label: 'Hoe',
    baseTicks: 80,
    maxVariance: 0.2,
    tags: ['land_harvest'],
  },
  unlock_tool_fish_trap_weir: {
    label: 'Fish Trap / Weir',
    baseTicks: 280,
    maxVariance: 0.3,
    tags: ['food_acquisition'],
  },
  unlock_tool_fishing_rod: {
    label: 'Fishing Rod',
    baseTicks: 220,
    maxVariance: 0.3,
    tags: ['food_acquisition'],
  },
  unlock_tool_auto_rod: {
    label: 'Auto-Rod',
    baseTicks: 200,
    maxVariance: 0.25,
    tags: ['food_acquisition'],
  },
  unlock_tool_wooden_platform: {
    label: 'Wooden Platform',
    baseTicks: 250,
    maxVariance: 0.25,
    tags: ['food_acquisition', 'land_harvest'],
  },
  unlock_tool_sled: {
    label: 'Sled',
    baseTicks: 400,
    maxVariance: 0.3,
    tags: ['storage_transport'],
  },
  unlock_tool_waterskin: {
    label: 'Waterskin',
    baseTicks: 150,
    maxVariance: 0.2,
    tags: ['storage_transport'],
  },
  unlock_tool_coat: {
    label: 'Coat',
    baseTicks: 200,
    maxVariance: 0.2,
    tags: ['clothing'],
  },
};

/** UI filter ids -> matches node if any tag hits */
export const TECH_FOREST_FILTER_GROUPS = [
  { id: 'all', label: 'All', tag: null },
  { id: 'food_acquisition', label: 'Food Acquisition', tag: 'food_acquisition' },
  { id: 'food_processing', label: 'Food Processing', tag: 'food_processing' },
  { id: 'storage_transport', label: 'Storage & Transport', tag: 'storage_transport' },
  { id: 'clothing', label: 'Clothing', tag: 'clothing' },
  { id: 'materials_processing', label: 'Materials', tag: 'materials_processing' },
  { id: 'land_harvest', label: 'Land & Harvest', tag: 'land_harvest' },
];

export const TECH_RESEARCH_TASK_KIND = 'tech_research';

const DEFAULT_BASE = 150;
const DEFAULT_VAR = 0.25;

export function getTechResearchMeta(unlockKey) {
  return TECH_RESEARCH_META[unlockKey] || {
    label: unlockKey.replace(/^unlock_(tool|station)_/, '').replace(/_/g, ' '),
    baseTicks: DEFAULT_BASE,
    maxVariance: DEFAULT_VAR,
    tags: [],
  };
}

/**
 * @param {() => number} rng 0..1
 * @param {number} baseTicks
 * @param {number} maxVariance
 */
export function rollResearchTicksForKey(rng, baseTicks, maxVariance) {
  const lo = -Math.max(0, maxVariance);
  const hi = Math.max(0, maxVariance);
  const roll = lo + (hi - lo) * rng();
  let ticks = baseTicks * (1 + roll);
  const floor = baseTicks * 0.5;
  const cap = baseTicks * 1.6;
  ticks = Math.max(floor, Math.min(cap, ticks));
  return Math.max(1, Math.round(ticks));
}

export function techResearchUnlockKeySet() {
  return new Set(TECH_RESEARCHABLE_UNLOCK_KEYS);
}
