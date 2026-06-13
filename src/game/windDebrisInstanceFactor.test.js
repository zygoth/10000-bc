import { PLANT_BY_ID } from './plantCatalog.mjs';
import { windDebrisSubStageInstanceFactor } from './windDebrisInstanceFactor.mjs';

describe('windDebrisSubStageInstanceFactor', () => {
  const species = PLANT_BY_ID.quercus_alba;
  const leafSubStage = species?.parts
    ?.find((p) => p.name === 'leaf')
    ?.subStages
    ?.find((s) => s.id === 'fall_dry');

  it('scales with estimated remaining unit count (actions × units per action)', () => {
    expect(leafSubStage).toBeTruthy();
    const maturePlant = {
      speciesId: 'quercus_alba',
      stageName: 'mature_seed_set',
      age: 500,
      activeSubStages: [{ partName: 'leaf', subStageId: 'fall_dry' }],
    };
    const saplingPlant = {
      speciesId: 'quercus_alba',
      stageName: 'seedling',
      age: 30,
      activeSubStages: [{ partName: 'leaf', subStageId: 'fall_dry' }],
    };
    const matureEntry = maturePlant.activeSubStages[0];
    const saplingEntry = saplingPlant.activeSubStages[0];
    const matureFactor = windDebrisSubStageInstanceFactor(matureEntry, leafSubStage, species, maturePlant);
    const saplingFactor = windDebrisSubStageInstanceFactor(saplingEntry, leafSubStage, species, saplingPlant);
    expect(matureFactor).toBeGreaterThan(saplingFactor);
    expect(saplingFactor).toBeGreaterThan(0);
  });

  it('returns zero when the sub-stage is depleted', () => {
    expect(leafSubStage).toBeTruthy();
    const plant = {
      speciesId: 'quercus_alba',
      stageName: 'mature_seed_set',
      age: 500,
      activeSubStages: [{ partName: 'leaf', subStageId: 'fall_dry' }],
    };
    const entry = plant.activeSubStages[0];
    entry.remainingActions = 0;
    entry.remainingActionsGround = 0;
    entry.remainingActionsElevated = 0;
    entry.remainingActionsCanopy = 0;
    expect(windDebrisSubStageInstanceFactor(entry, leafSubStage, species, plant)).toBe(0);
  });
});
