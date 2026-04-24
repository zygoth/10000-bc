import { mulberry32 } from './simWorld.mjs';

export const MAGICICADA_SPECIES_ID = 'magicicada_septendecim';
export const MAGICICADA_EMERGENCE_MODULUS = 17;

/**
 * @param {number} seed
 * @returns {number} 0..MAGICICADA_EMERGENCE_MODULUS - 1
 */
export function deriveMagicicadaEmergenceOffset(seed) {
  const s = Math.floor(Number(seed)) || 0;
  const rng = mulberry32(s * 2654435761 + 0x9e3779b9);
  return Math.floor(rng() * MAGICICADA_EMERGENCE_MODULUS) % MAGICICADA_EMERGENCE_MODULUS;
}

/**
 * @param {object} state
 * @returns {number} 0..16
 */
export function resolveMagicicadaEmergenceOffset(state) {
  const raw = state?.magicicadaSeptendecimEmergenceOffset;
  if (Number.isInteger(raw) && raw >= 0 && raw < MAGICICADA_EMERGENCE_MODULUS) {
    return raw;
  }
  return deriveMagicicadaEmergenceOffset(state?.seed);
}

/**
 * @param {object} state
 * @returns {boolean}
 */
export function isMagicicadaEmergenceYear(state) {
  const year = Number(state?.year) || 1;
  const off = resolveMagicicadaEmergenceOffset(state);
  return (off + year) % MAGICICADA_EMERGENCE_MODULUS === 0;
}
