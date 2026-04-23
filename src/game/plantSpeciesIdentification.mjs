/**
 * Whether the player has formally identified this plant species (research / field ID).
 * Mirrors collections written in sim and read in UI (see `advanceTick/actionEffects` identification).
 */
export function isPlantSpeciesIdentifiedInState(state, speciesId) {
  if (!state || typeof speciesId !== 'string' || !speciesId) {
    return false;
  }
  const collections = [
    state?.identifiedPlantSpeciesIds,
    state?.camp?.identifiedPlantSpeciesIds,
    state?.camp?.identifiedSpeciesIds,
    state?.camp?.research?.identifiedSpeciesIds,
  ];
  return collections.some((collection) => Array.isArray(collection) && collection.includes(speciesId));
}
