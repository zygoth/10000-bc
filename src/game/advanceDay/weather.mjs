import { getSeason } from '../plantCatalog.mjs';
import { mulberry32 } from '../simWorld.mjs';

const YEAR_LENGTH_DAYS = 40;
const TEMPERATURE_MIN_F = 15;
const TEMPERATURE_MAX_F = 88;
const TEMPERATURE_VARIANCE_MIN_F = -6;
const TEMPERATURE_VARIANCE_MAX_F = 6;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeDayOfYear(dayOfYear) {
  const value = Number(dayOfYear);
  if (!Number.isFinite(value)) {
    return 1;
  }
  const normalized = Math.floor(value);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > YEAR_LENGTH_DAYS) {
    return YEAR_LENGTH_DAYS;
  }
  return normalized;
}

function normalizeAngleRadians(radians) {
  const value = Number(radians);
  if (!Number.isFinite(value)) {
    return 0;
  }
  const fullTurn = Math.PI * 2;
  const normalized = value % fullTurn;
  return normalized < 0 ? normalized + fullTurn : normalized;
}

function temperatureBandFromFahrenheit(temperatureF) {
  if (temperatureF < 25) {
    return 'freezing';
  }
  if (temperatureF <= 40) {
    return 'cold';
  }
  if (temperatureF <= 55) {
    return 'cool';
  }
  if (temperatureF <= 75) {
    return 'mild';
  }
  if (temperatureF <= 85) {
    return 'warm';
  }
  return 'hot';
}

export function windStrengthLabel(strength) {
  if (strength < 0.2) {
    return 'calm';
  }
  if (strength < 0.4) {
    return 'low';
  }
  if (strength < 0.65) {
    return 'medium';
  }
  if (strength < 0.82) {
    return 'high';
  }
  return 'very_high';
}

function seasonalTemperatureBaselineF(dayOfYear) {
  const day = normalizeDayOfYear(dayOfYear);
  const midpoint = (TEMPERATURE_MIN_F + TEMPERATURE_MAX_F) / 2;
  const amplitude = (TEMPERATURE_MAX_F - TEMPERATURE_MIN_F) / 2;
  const radians = ((day - 15) / YEAR_LENGTH_DAYS) * Math.PI * 2;
  return midpoint + (Math.cos(radians) * amplitude);
}

function seasonalWindStrengthBaseline(dayOfYear) {
  const season = getSeason(normalizeDayOfYear(dayOfYear));
  switch (season) {
    case 'spring':
      return 0.62;
    case 'summer':
      return 0.38;
    case 'fall':
      return 0.52;
    case 'winter':
    default:
      return 0.58;
  }
}

function buildWindVector(angleRadians, strength) {
  const normalizedAngle = normalizeAngleRadians(angleRadians);
  const normalizedStrength = clamp01(Number(strength) || 0);
  const x = Number((Math.cos(normalizedAngle) * normalizedStrength).toFixed(4));
  const y = Number((Math.sin(normalizedAngle) * normalizedStrength).toFixed(4));
  return {
    x,
    y,
    strength: Number(normalizedStrength.toFixed(4)),
    strengthLabel: windStrengthLabel(normalizedStrength),
    angleRadians: Number(normalizedAngle.toFixed(4)),
  };
}

function applyDailyWeatherState(state, weatherState) {
  state.weatherTemperatureVarianceF = weatherState.weatherTemperatureVarianceF;
  state.weatherWindAngleRadians = weatherState.weatherWindAngleRadians;
  state.weatherWindStrength = weatherState.weatherWindStrength;
  state.dailyTemperatureF = weatherState.dailyTemperatureF;
  state.dailyTemperatureBand = weatherState.dailyTemperatureBand;
  state.dailyWindVector = weatherState.dailyWindVector;
}

function buildWeatherForDay(dayOfYear, varianceOffsetF, windAngleRadians, windStrength) {
  const normalizedVariance = Math.max(
    TEMPERATURE_VARIANCE_MIN_F,
    Math.min(TEMPERATURE_VARIANCE_MAX_F, Number(varianceOffsetF) || 0),
  );
  const baseline = seasonalTemperatureBaselineF(dayOfYear);
  const dailyTemperatureF = baseline + normalizedVariance;
  const roundedDailyTemperatureF = Number(dailyTemperatureF.toFixed(1));
  return {
    weatherTemperatureVarianceF: Number(normalizedVariance.toFixed(2)),
    weatherWindAngleRadians: Number(normalizeAngleRadians(windAngleRadians).toFixed(4)),
    weatherWindStrength: Number(clamp01(Number(windStrength) || 0).toFixed(4)),
    dailyTemperatureF: roundedDailyTemperatureF,
    dailyTemperatureBand: temperatureBandFromFahrenheit(roundedDailyTemperatureF),
    dailyWindVector: buildWindVector(windAngleRadians, windStrength),
  };
}

export function initializeDailyWeatherState(state) {
  const rng = mulberry32(state.seed * 97 + 19);
  const baselineStrength = seasonalWindStrengthBaseline(state.dayOfYear);
  const varianceOffsetF = (rng() - 0.5) * 4;
  const windAngleRadians = rng() * Math.PI * 2;
  const windStrength = clamp01(baselineStrength + ((rng() - 0.5) * 0.2));
  const weather = buildWeatherForDay(state.dayOfYear, varianceOffsetF, windAngleRadians, windStrength);
  applyDailyWeatherState(state, weather);
}

export function rollDailyWeatherForCurrentDay(state, rng) {
  const currentVariance = Number.isFinite(Number(state.weatherTemperatureVarianceF))
    ? Number(state.weatherTemperatureVarianceF)
    : 0;
  const varianceDrift = (rng() - 0.5) * 6;
  const nextVariance = Math.max(
    TEMPERATURE_VARIANCE_MIN_F,
    Math.min(TEMPERATURE_VARIANCE_MAX_F, currentVariance + varianceDrift),
  );

  const currentAngle = Number.isFinite(Number(state.weatherWindAngleRadians))
    ? Number(state.weatherWindAngleRadians)
    : rng() * Math.PI * 2;
  const nextAngle = normalizeAngleRadians(currentAngle + ((rng() - 0.5) * (Math.PI / 2)));

  const baselineStrength = seasonalWindStrengthBaseline(state.dayOfYear);
  const currentStrength = Number.isFinite(Number(state.weatherWindStrength))
    ? Number(state.weatherWindStrength)
    : baselineStrength;
  const nextStrength = clamp01((currentStrength * 0.55) + (baselineStrength * 0.45) + ((rng() - 0.5) * 0.24));

  const weather = buildWeatherForDay(state.dayOfYear, nextVariance, nextAngle, nextStrength);
  applyDailyWeatherState(state, weather);
}

export function ensureDailyWeatherState(state) {
  if (
    Number.isFinite(Number(state?.dailyTemperatureF))
    && typeof state?.dailyTemperatureBand === 'string'
    && state?.dailyWindVector
  ) {
    return;
  }
  initializeDailyWeatherState(state);
}

function isStillWaterType(waterType) {
  return waterType === 'pond';
}

export function applyDailyWaterFreezeState(state) {
  const band = typeof state?.dailyTemperatureBand === 'string'
    ? state.dailyTemperatureBand.toLowerCase()
    : 'mild';
  const previousStreak = Number.isFinite(Number(state?.consecutiveFreezingDays))
    ? Math.max(0, Math.floor(Number(state.consecutiveFreezingDays)))
    : 0;
  const freezingStreak = band === 'freezing' ? previousStreak + 1 : 0;
  state.consecutiveFreezingDays = freezingStreak;

  for (const tile of state.tiles || []) {
    if (!tile?.waterType) {
      tile.waterFrozen = false;
      continue;
    }

    if (!isStillWaterType(tile.waterType)) {
      tile.waterFrozen = false;
      continue;
    }

    tile.waterFrozen = freezingStreak >= 2;
  }
}
