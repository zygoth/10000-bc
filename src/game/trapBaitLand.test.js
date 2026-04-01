import {
  landTrapBaitMultiplierForTargetSpecies,
  plantSpeciesEligibleForSimpleSnareBait,
  parseLandTrapBaitPlantSpeciesId,
  SIMPLE_SNARE_TARGET_SPECIES_ID,
} from './trapBaitLand.mjs';

describe('trapBaitLand (GDD §12.1)', () => {
  test('parses plant species from plant-part item id', () => {
    expect(parseLandTrapBaitPlantSpeciesId('daucus_carota:root:first_year')).toBe('daucus_carota');
    expect(parseLandTrapBaitPlantSpeciesId('earthworm')).toBeNull();
  });

  test('daucus_carota is eligible simple-snare bait (cottontail diet)', () => {
    expect(plantSpeciesEligibleForSimpleSnareBait('daucus_carota')).toBe(true);
  });

  test('catch multiplier is 1 + scent.strength when bait plant is in target diet', () => {
    const mult = landTrapBaitMultiplierForTargetSpecies(
      'daucus_carota:root:first_year',
      SIMPLE_SNARE_TARGET_SPECIES_ID,
    );
    expect(mult).toBeGreaterThan(1);
    expect(mult).toBe(1.6);
  });

  test('multiplier is 1 when bait plant is not in target diet', () => {
    expect(
      landTrapBaitMultiplierForTargetSpecies(
        'daucus_carota:root:first_year',
        'lepomis_macrochirus',
      ),
    ).toBe(1);
  });
});
