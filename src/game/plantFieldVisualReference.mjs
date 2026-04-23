import { PLANT_BY_ID } from './plantCatalog.mjs';

/**
 * Best-effort life stage id for "what this species looks like as an established plant in the field"
 * (debrief / partner request reference art). Not used for sim logic.
 */
export function representativeFieldPlantLifeStageId(speciesId) {
  const species = speciesId ? PLANT_BY_ID[speciesId] : null;
  const stages = Array.isArray(species?.lifeStages) ? species.lifeStages : [];
  const ids = stages.map((s) => s?.stage).filter((x) => typeof x === 'string' && x);
  if (ids.length === 0) {
    return null;
  }

  const rank = (id) => {
    const s = String(id);
    if (s === 'mature_vegetative' || s.includes('mature_vegetative')) return 100;
    if (s.includes('mature_') && !s.includes('dormant') && !s.includes('sapling')) return 90;
    if (s === 'second_year_vegetative') return 88;
    if (s.includes('second_year') && !s.includes('dormant') && !s.includes('seedling')) return 85;
    if (s.includes('flowering') || s.includes('fruiting') || s.includes('seed_set')) return 82;
    if (s.includes('first_year_vegetative')) return 70;
    if (s === 'sapling') return 40;
    if (s === 'seedling') return 20;
    if (s.includes('dormant')) return 5;
    return 60;
  };

  return [...ids].sort((a, b) => rank(b) - rank(a))[0];
}
