function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeRateRange(raw) {
  if (Array.isArray(raw) && raw.length === 2) {
    const min = Math.max(0, Number(raw[0]) || 0);
    const max = Math.max(0, Number(raw[1]) || 0);
    return [Math.min(min, max), Math.max(min, max)];
  }
  return [0, 0];
}

/**
 * @param {unknown} raw
 */
export function normalizeWindDebris(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const behavior = raw.behavior === 'float' ? 'float' : raw.behavior === 'fall' ? 'fall' : null;
  if (!behavior) {
    return null;
  }
  const [rateMin, rateMax] = normalizeRateRange(raw.spawn_rate_per_minute);
  const minWind = clamp01(raw.min_wind_strength);
  const mass = Math.max(0.05, Number(raw.mass) || 1);
  const windDrag = clamp01(raw.wind_drag);
  const visualPart = typeof raw.visual_part === 'string' && raw.visual_part ? raw.visual_part : null;
  const visualSubStageId = typeof raw.visual_sub_stage === 'string' && raw.visual_sub_stage
    ? raw.visual_sub_stage
    : null;
  return {
    behavior,
    mass,
    windDrag,
    terminalFallSpeed: Math.max(8, Number(raw.terminal_fall_speed) || 48),
    riseSpeed: Math.max(0, Number(raw.rise_speed) || 12),
    spawnRatePerMinute: [rateMin, rateMax],
    minWindStrength: minWind,
    visualPart,
    visualSubStageId,
  };
}

/**
 * @param {{ spawnRatePerMinute: [number, number], minWindStrength: number }} config
 * @param {number} windStrength
 * @param {number} [localMultiplier]
 */
export function debrisSpawnRatePerMinute(config, windStrength, localMultiplier = 1) {
  const strength = clamp01(windStrength);
  if (strength < config.minWindStrength) {
    return 0;
  }
  const [min, max] = config.spawnRatePerMinute;
  const t = (strength - config.minWindStrength) / Math.max(0.001, 1 - config.minWindStrength);
  const base = min + (max - min) * t;
  return base * Math.max(0, Number(localMultiplier) || 0);
}
