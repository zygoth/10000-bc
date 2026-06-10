import meleagrisGallopavo from './catalog/meleagris_gallopavo.json';
import magicicadaSeptendecim from './catalog/magicicada_septendecim.json';
import neotibicenCanicularis from './catalog/neotibicen_canicularis.json';
import pseudacrisCrucifer from './catalog/pseudacris_crucifer.json';
import campCampfireCrackle from './catalog/camp_campfire_crackle.json';
import bombusPennsylvanicusColony from './catalog/bombus_pennsylvanicus_colony.json';
import campWorkMaintenanceShuffle from './catalog/camp_work_maintenance_shuffle.json';
import turdusMigratorius from './catalog/turdus_migratorius.json';
import cardinalisCardinalis from './catalog/cardinalis_cardinalis.json';
import melospizaMelodia from './catalog/melospiza_melodia.json';
import agelaiusPhoeniceus from './catalog/agelaius_phoeniceus.json';
import passerinaCyanea from './catalog/passerina_cyanea.json';
import pipiloErythrophthalmus from './catalog/pipilo_erythrophthalmus.json';
import troglodytesAedon from './catalog/troglodytes_aedon.json';
import zenaidaMacroura from './catalog/zenaida_macroura.json';
import spinusTristis from './catalog/spinus_tristis.json';

/**
 * @typedef {object} AmbientCatalogEntry
 * @property {string} [shared_trapping_species_id] When the species is (or will be) trap-simulated, same id as
 *   `ANIMAL_CATALOG`; ambient weights should eventually use `getAnimalDensityAtTile` with this id. See
 *   `buildAmbientLayer.mjs` (module comment) — not wired today.
 */

/** @type {object[]} */
export const AMBIENT_CATALOG = [
  meleagrisGallopavo,
  magicicadaSeptendecim,
  neotibicenCanicularis,
  pseudacrisCrucifer,
  campCampfireCrackle,
  bombusPennsylvanicusColony,
  campWorkMaintenanceShuffle,
  turdusMigratorius,
  cardinalisCardinalis,
  melospizaMelodia,
  agelaiusPhoeniceus,
  passerinaCyanea,
  pipiloErythrophthalmus,
  troglodytesAedon,
  zenaidaMacroura,
  spinusTristis,
];

export function getAmbientEntriesByRole(role) {
  return AMBIENT_CATALOG.filter((e) => e?.audio_role === role);
}
