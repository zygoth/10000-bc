import { minChebyshevToPlantSpecies } from './plantProximity.mjs';

describe('minChebyshevToPlantSpecies', () => {
  test('returns null when no plant in range', () => {
    const state = {
      width: 3,
      height: 3,
      tiles: Array(9).fill(null).map((_, i) => ({
        x: i % 3,
        y: Math.floor(i / 3),
        plantIds: [],
        moisture: 0.5,
        shade: 0,
        waterType: null,
        elevation: 0.5,
      })),
      plants: {},
    };
    expect(minChebyshevToPlantSpecies(state, 1, 1, ['x'], 2)).toBe(null);
  });

  test('finds nearest distance', () => {
    const state = {
      width: 5,
      height: 1,
      tiles: [0, 1, 2, 3, 4].map((x) => ({
        x,
        y: 0,
        plantIds: x === 4 ? ['p'] : [],
        moisture: 0.5,
        shade: 0,
        waterType: null,
        elevation: 0.5,
      })),
      plants: { p: { speciesId: 's1' } },
    };
    expect(minChebyshevToPlantSpecies(state, 0, 0, ['s1'], 5)).toBe(4);
    expect(minChebyshevToPlantSpecies(state, 0, 0, ['s1'], 2)).toBe(null);
  });
});
