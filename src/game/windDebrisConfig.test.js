import { debrisSpawnRatePerMinute, normalizeWindDebris } from './windDebrisConfig.mjs';

describe('windDebrisConfig', () => {
  it('normalizeWindDebris parses fall config', () => {
    const cfg = normalizeWindDebris({
      behavior: 'fall',
      mass: 0.4,
      wind_drag: 0.6,
      terminal_fall_speed: 50,
      spawn_rate_per_minute: [0.2, 2.0],
      min_wind_strength: 0.25,
    });
    expect(cfg?.behavior).toBe('fall');
    expect(cfg?.mass).toBe(0.4);
    expect(cfg?.windDrag).toBe(0.6);
    expect(cfg?.spawnRatePerMinute).toEqual([0.2, 2]);
  });

  it('normalizeWindDebris parses float visual overrides', () => {
    const cfg = normalizeWindDebris({
      behavior: 'float',
      mass: 0.08,
      wind_drag: 0.9,
      rise_speed: 12,
      spawn_rate_per_minute: [1, 8],
      min_wind_strength: 0.3,
      visual_part: 'fluff',
      visual_sub_stage: 'dry',
    });
    expect(cfg?.behavior).toBe('float');
    expect(cfg?.visualPart).toBe('fluff');
    expect(cfg?.visualSubStageId).toBe('dry');
  });

  it('debrisSpawnRatePerMinute returns zero below min wind', () => {
    const cfg = normalizeWindDebris({
      behavior: 'fall',
      spawn_rate_per_minute: [1, 5],
      min_wind_strength: 0.4,
    });
    expect(debrisSpawnRatePerMinute(cfg, 0.2)).toBe(0);
    expect(debrisSpawnRatePerMinute(cfg, 0.8)).toBeGreaterThan(1);
  });
});
