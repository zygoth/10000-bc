import { createInitialGameState } from './simCore.mjs';
import { CAMP_STATION_RECIPES, TOOL_RECIPES } from './simActions.mjs';
import { PLANT_CATALOG } from './plantCatalog.mjs';
import {
  applyManualTestBootstrap,
  DEBUG_VISION_HALLUCINOGEN_ITEM_ID,
  defaultManualTestBootstrapOptions,
} from './manualTestBootstrap.mjs';

function stockpileByItemId(state) {
  const byItem = new Map();
  for (const stack of state?.camp?.stockpile?.stacks || []) {
    byItem.set(stack.itemId, Number(stack.quantity) || 0);
  }
  return byItem;
}

describe('manualTestBootstrap', () => {
  it('does nothing when disabled', () => {
    const base = createInitialGameState(10000, { width: 40, height: 40 });
    const disabled = applyManualTestBootstrap(base, { enabled: false });
    expect(disabled).toBe(base);
  });

  it('seeds stations, unlocks, tools, and materials when enabled', () => {
    const base = createInitialGameState(12345, { width: 40, height: 40 });
    const seeded = applyManualTestBootstrap(base, {
      ...defaultManualTestBootstrapOptions(),
      enabled: true,
    });

    const expectedStations = Object.values(CAMP_STATION_RECIPES).map((recipe) => recipe.stationId);
    for (const stationId of expectedStations) {
      expect(seeded.camp.stationsUnlocked).toContain(stationId);
    }

    for (const recipe of Object.values(CAMP_STATION_RECIPES)) {
      if (recipe.requiredUnlock) {
        expect(seeded.techUnlocks[recipe.requiredUnlock]).toBe(true);
      }
    }
    for (const recipe of Object.values(TOOL_RECIPES)) {
      if (recipe.requiredUnlock) {
        expect(seeded.techUnlocks[recipe.requiredUnlock]).toBe(true);
      }
    }

    const byItem = stockpileByItemId(seeded);
    for (const recipe of Object.values(TOOL_RECIPES)) {
      expect(byItem.get(recipe.outputItemId)).toBeGreaterThanOrEqual(1);
    }
    expect(byItem.get('tool:hide_pitch_vessel_filled_sap')).toBeGreaterThanOrEqual(1);
    expect(byItem.get('bark:inner_bark')).toBeGreaterThanOrEqual(1);
    const cordageFiberItemIds = [];
    for (const species of PLANT_CATALOG) {
      for (const part of species.parts || []) {
        for (const subStage of part.subStages || []) {
          if (Array.isArray(subStage?.craft_tags) && subStage.craft_tags.includes('cordage_fiber')) {
            cordageFiberItemIds.push(`${species.id}:${part.name}:${subStage.id}`);
          }
        }
      }
    }
    expect(cordageFiberItemIds.length).toBeGreaterThan(0);
    expect(cordageFiberItemIds.some((itemId) => (byItem.get(itemId) || 0) > 0)).toBe(true);

    const walnut = seeded.camp.stockpile.stacks.find((s) => s.itemId === 'juglans_nigra:husked_nut:whole');
    expect(walnut).toBeTruthy();
    expect(walnut.decayDaysRemaining).toBe(300);
    expect(Number.isFinite(Number(walnut.unitWeightKg)) && Number(walnut.unitWeightKg) > 0).toBe(true);

    expect(byItem.get(DEBUG_VISION_HALLUCINOGEN_ITEM_ID)).toBeGreaterThanOrEqual(4);
  });
});
