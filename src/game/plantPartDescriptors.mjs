import { PLANT_BY_ID } from './plantCatalog.mjs';

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

function toTitleCase(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
