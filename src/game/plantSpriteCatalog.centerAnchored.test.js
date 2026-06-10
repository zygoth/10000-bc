import { getPlantSpriteFrame } from './plantSpriteCatalog.mjs';

describe('getPlantSpriteFrame — center_anchored_sprite (built catalog)', () => {
  it('exposes centerAnchored on flagged wild carrot first-year vegetative life stage', () => {
    const ref = getPlantSpriteFrame('daucus_carota', 'first_year_vegetative');
    expect(ref?.frame?.centerAnchored).toBe(true);
    expect(ref?.frame?.anchorY).toBe(32);
    expect(ref?.frame?.anchorX).toBe(32);
  });

  it('does not set centerAnchored on a default bottom-anchored stage', () => {
    const ref = getPlantSpriteFrame('daucus_carota', 'seedling');
    expect(ref?.frame?.centerAnchored).toBeUndefined();
  });
});
