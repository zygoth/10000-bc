const VALID_REACH_TIERS = new Set(['ground', 'elevated', 'canopy']);

/**
 * Optional per–life-stage overrides for harvest reach. Catalog uses `reach_tier` as the default;
 * when the plant is in a key listed in `reach_tier_by_life_stage`, that reach tier wins.
 */
export function resolveEffectiveReachTier(subStage, lifeStageName) {
  const map = subStage?.reach_tier_by_life_stage;
  if (map && typeof map === 'object' && typeof lifeStageName === 'string' && lifeStageName) {
    const override = map[lifeStageName];
    if (typeof override === 'string' && VALID_REACH_TIERS.has(override)) {
      return override;
    }
  }
  const base = typeof subStage?.reach_tier === 'string' ? subStage.reach_tier : 'ground';
  return VALID_REACH_TIERS.has(base) ? base : 'ground';
}
