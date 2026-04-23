import { PLANT_BY_ID } from './plantCatalog.mjs';
import { isPlantSpeciesIdentifiedInState } from './plantSpeciesIdentification.mjs';

/** Player-facing label when a harvested plant part belongs to a species not yet identified. */
export const UNIDENTIFIED_PLANT_DISPLAY_NAME = 'Unidentified plant';

export function parsePlantPartItemId(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }
  const segments = itemId.split(':');
  if (segments.length !== 3) {
    return null;
  }
  const [speciesId, partName, subStageId] = segments;
  if (!speciesId || !partName || !subStageId) {
    return null;
  }

  const species = PLANT_BY_ID[speciesId] || null;
  const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
  const subStage = (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
  if (!species || !part || !subStage) {
    return null;
  }

  return {
    itemId,
    speciesId,
    speciesName: typeof species.name === 'string' ? species.name : speciesId,
    partName,
    partLabel: toTitleCase(partName),
    subStageId,
    subStageLabel: toTitleCase(subStageId),
    part,
    subStage,
    species,
  };
}

export function formatPlantPartLabel(descriptor, options = {}) {
  if (!descriptor) {
    return '';
  }
  const includeSubStage = options.includeSubStage !== false;
  const partLabel = descriptor.partLabel || toTitleCase(descriptor.partName || '');
  if (!includeSubStage) {
    return `${descriptor.speciesName} (${partLabel})`;
  }
  const subStageLabel = descriptor.subStageLabel || toTitleCase(descriptor.subStageId || '');
  return `${descriptor.speciesName} (${partLabel} - ${subStageLabel})`;
}

/**
 * Same shape as {@link formatPlantPartLabel} but hides species: "Unidentified plant (Part - Sub-stage)".
 */
export function unidentifiedPlantPartDisplayLabel(descriptor, options = {}) {
  if (!descriptor) {
    return UNIDENTIFIED_PLANT_DISPLAY_NAME;
  }
  const includeSubStage = options.includeSubStage !== false;
  const partLabel = descriptor.partLabel || toTitleCase(descriptor.partName || '');
  if (!includeSubStage) {
    return `${UNIDENTIFIED_PLANT_DISPLAY_NAME} (${partLabel})`;
  }
  const subStageLabel = descriptor.subStageLabel || toTitleCase(descriptor.subStageId || '');
  return `${UNIDENTIFIED_PLANT_DISPLAY_NAME} (${partLabel} - ${subStageLabel})`;
}

/**
 * Label for tooltips/menus/inventory when the player should not see the real species name yet.
 * Pass `gameState` from runtime UI; omit in tests or dev-only tools that need raw catalog names.
 */
export function formatPlantPartLabelForPlayer(gameState, descriptor, options = {}) {
  if (!descriptor) {
    return '';
  }
  if (gameState && !isPlantSpeciesIdentifiedInState(gameState, descriptor.speciesId)) {
    return unidentifiedPlantPartDisplayLabel(descriptor, options);
  }
  return formatPlantPartLabel(descriptor, options);
}

/**
 * Display name for inventory-like rows: catalog item, unidentified plant part, or composed plant part label.
 */
export function resolveHarvestedPlantItemDisplayName(item, plantPartDescriptor, gameState, fallbackItemId) {
  if (plantPartDescriptor && gameState && !isPlantSpeciesIdentifiedInState(gameState, plantPartDescriptor.speciesId)) {
    return unidentifiedPlantPartDisplayLabel(plantPartDescriptor, { includeSubStage: true });
  }
  if (item && typeof item.name === 'string' && item.name) {
    return item.name;
  }
  if (plantPartDescriptor) {
    return `${plantPartDescriptor.speciesName} ${plantPartDescriptor.partLabel}`;
  }
  return typeof fallbackItemId === 'string' ? fallbackItemId : '';
}

function toTitleCase(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
