/**
 * Optional stack metadata from extractors uses `null` when a field is absent.
 * `Number(null) === 0` would incorrectly treat that as "zero days until rot".
 */
export function coerceOptionalMetaNumber(raw) {
  return raw == null ? Number.NaN : Number(raw);
}
