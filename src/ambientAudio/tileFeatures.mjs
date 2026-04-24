function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Numeric / enum features for ambient population scoring (no legacy habitat tags).
 * @param {object} tile
 * @param {object} _state
 * @param {number} x
 * @param {number} y
 */
export function buildTileFeatureSnapshot(tile, _state, x, y) {
  const moisture = Number(tile?.moisture);
  const shade = Number(tile?.shade ?? tile?.baseShade ?? 0);
  const elevation = Number(tile?.elevation);
  const wt = tile?.waterType;
  const waterType = wt === 'pond' || wt === 'river' ? wt : 'land';
  const plantIds = Array.isArray(tile?.plantIds) ? tile.plantIds : [];
  const plantPresent = plantIds.length > 0;
  const deadLog = Boolean(tile?.deadLog);
  const rock = Boolean(tile?.rockType);

  return {
    x,
    y,
    moisture: Number.isFinite(moisture) ? clamp01(moisture) : 0,
    shade: Number.isFinite(shade) ? clamp01(shade) : 0,
    elevation: Number.isFinite(elevation) ? clamp01(elevation) : 0,
    waterType,
    /** Catalog `population_response` terms use snake_case feature keys. */
    water_type: waterType,
    plantPresent,
    plant_present: plantPresent,
    deadLog,
    dead_log: deadLog,
    rock,
  };
}
