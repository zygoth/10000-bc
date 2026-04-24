import {
  deriveMagicicadaEmergenceOffset,
  isMagicicadaEmergenceYear,
  MAGICICADA_EMERGENCE_MODULUS,
  resolveMagicicadaEmergenceOffset,
} from './magicicadaEmergence.mjs';

describe('deriveMagicicadaEmergenceOffset', () => {
  test('is deterministic for a seed and in 0..modulus-1', () => {
    const a = deriveMagicicadaEmergenceOffset(424242);
    const b = deriveMagicicadaEmergenceOffset(424242);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(MAGICICADA_EMERGENCE_MODULUS);
  });
});

describe('resolveMagicicadaEmergenceOffset', () => {
  test('uses stored offset when valid', () => {
    expect(
      resolveMagicicadaEmergenceOffset({
        seed: 1,
        magicicadaSeptendecimEmergenceOffset: 7,
        year: 1,
      }),
    ).toBe(7);
  });

  test('derives from seed when missing or invalid', () => {
    const s = 999001;
    expect(
      resolveMagicicadaEmergenceOffset({ seed: s, year: 1 }),
    ).toBe(deriveMagicicadaEmergenceOffset(s));
  });
});

describe('isMagicicadaEmergenceYear', () => {
  test('(offset + year) % 17 === 0', () => {
    const state = (year, off) => ({
      year,
      seed: 1,
      magicicadaSeptendecimEmergenceOffset: off,
    });
    expect(isMagicicadaEmergenceYear(state(17, 0))).toBe(true);
    expect(isMagicicadaEmergenceYear(state(16, 0))).toBe(false);
    expect(isMagicicadaEmergenceYear(state(1, 16))).toBe(true);
  });
});
