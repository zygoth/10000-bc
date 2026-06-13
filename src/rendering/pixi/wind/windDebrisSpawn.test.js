import { PLANT_BY_ID } from '../../../game/plantCatalog.mjs';
import { isoOccupantDepthZ } from './windDebrisDepth.mjs';
import {
  buildDebrisSpawnContextForPlant,
  buildDebrisSpawnContextForTile,
  computeFloatDriftVelocity,
  debrisSpriteWorldScale,
  floatDebrisPickBiasScreenPx,
  floatDebrisTilePickScreenPx,
  floatDebrisWobbleRotationRad,
  initFloatDebrisWobble,
  listEligibleDebrisSourcesForPlant,
  resolveRenderedPlantForTile,
  screenToTileLocalPx,
  spawnChanceThisFrame,
  tileLocalToScreenPx,
} from './windDebrisSpawn.mjs';

describe('windDebrisSpawn', () => {
  it('isoOccupantDepthZ increases with screen Y and patch bias', () => {
    expect(isoOccupantDepthZ(100, 200, 0)).toBeLessThan(isoOccupantDepthZ(100, 220, 0));
    expect(isoOccupantDepthZ(100, 200, 5)).toBeGreaterThan(isoOccupantDepthZ(100, 200, 0));
    expect(isoOccupantDepthZ(100, 200, 0)).toBeGreaterThan(5000);
  });

  it('listEligibleDebrisSourcesForPlant finds oak fall leaf debris', () => {
    const species = PLANT_BY_ID.corylus_americana;
    expect(species).toBeTruthy();
    const plant = {
      alive: true,
      speciesId: 'corylus_americana',
      stageName: 'mature_flowering',
      activeSubStages: [{ partName: 'leaf', subStageId: 'green' }],
    };
    const sources = listEligibleDebrisSourcesForPlant(
      { dayOfYear: 15 },
      species,
      plant,
      15,
    );
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].windDebris.behavior).toBe('fall');
    expect(sources[0].spriteRef?.frame).toBeTruthy();
  });

  it('listEligibleDebrisSourcesForPlant finds walnut fall leaf debris', () => {
    const species = PLANT_BY_ID.juglans_nigra;
    expect(species).toBeTruthy();
    const plant = {
      alive: true,
      speciesId: 'juglans_nigra',
      stageName: 'mature_seed_set',
      activeSubStages: [{ partName: 'leaf', subStageId: 'yellow' }],
    };
    const sources = listEligibleDebrisSourcesForPlant(
      { dayOfYear: 27 },
      species,
      plant,
      27,
    );
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].windDebris.behavior).toBe('fall');
    expect(sources[0].subStageId).toBe('yellow');
    expect(sources[0].spriteRef?.frame).toBeTruthy();
  });

  it('resolveRenderedPlantForTile uses the first plant id on the tile', () => {
    const tile = { plantIds: ['shown', 'hidden'] };
    const gameState = {
      plants: {
        shown: { alive: true, id: 'shown' },
        hidden: { alive: true, id: 'hidden' },
      },
    };
    expect(resolveRenderedPlantForTile(tile, gameState)?.id).toBe('shown');
  });

  it('debrisSpriteWorldScale is independent of plant life-stage display scale', () => {
    const species = PLANT_BY_ID.corylus_americana;
    const plant = {
      alive: true,
      id: 'p1',
      speciesId: 'corylus_americana',
      stageName: 'mature_flowering',
      activeSubStages: [{ partName: 'leaf', subStageId: 'green' }],
    };
    const sources = listEligibleDebrisSourcesForPlant({ dayOfYear: 15 }, species, plant, 15);
    expect(sources.length).toBeGreaterThan(0);
    const source = sources[0];
    const baseLayout = {
      plantId: 'p1',
      screenX: 200,
      occupantAnchorY: 300,
      groundY: 320,
      patchCapacity: 1,
      patchScale: 1,
      stageSize: 8,
      plantOrLogScale: 2,
    };
    const seedlingLayout = { ...baseLayout, plantOrLogScale: 1.1, stageSize: 2 };
    const matureLayout = { ...baseLayout, plantOrLogScale: 2, stageSize: 10 };
    const rng = () => 0.5;
    const seedlingCtx = buildDebrisSpawnContextForPlant(
      plant,
      seedlingLayout,
      4,
      4,
      source,
      rng,
    );
    const matureCtx = buildDebrisSpawnContextForPlant(
      plant,
      matureLayout,
      4,
      4,
      source,
      rng,
    );
    expect(seedlingCtx?.spriteScale).toBe(debrisSpriteWorldScale());
    expect(matureCtx?.spriteScale).toBe(debrisSpriteWorldScale());
    expect(seedlingCtx?.spriteScale).toBe(matureCtx?.spriteScale);
  });

  it('buildDebrisSpawnContextForTile places float debris on the rendered plant canopy', () => {
    const species = PLANT_BY_ID.asclepias_syriaca;
    expect(species).toBeTruthy();
    const tile = { plantIds: ['p1'] };
    const gameState = {
      dayOfYear: 26,
      plants: {
        p1: {
          alive: true,
          id: 'p1',
          speciesId: 'asclepias_syriaca',
          stageName: 'seed_set',
          activeSubStages: [{ partName: 'pod', subStageId: 'dry' }],
        },
      },
    };
    const layout = {
      plantId: 'p1',
      screenX: 200,
      occupantAnchorY: 300,
      groundY: 320,
      patchCapacity: 1,
      patchScale: 1,
      stageSize: 8,
      plantOrLogScale: 2,
    };
    const rng = () => 0.5;
    const ctx = buildDebrisSpawnContextForTile(tile, gameState, layout, 4, 4, rng);
    expect(ctx?.plantId).toBe('p1');
    expect(ctx?.windDebris.behavior).toBe('float');
    expect(ctx.spawnX).toBe(200);
    expect(ctx.spawnY).toBeLessThan(300);
    expect(ctx.spawnY).toBeLessThan(260);
  });

  it('buildDebrisSpawnContextForPlant prefers live plant sprite anchors', () => {
    const species = PLANT_BY_ID.corylus_americana;
    const plant = {
      alive: true,
      id: 'p1',
      speciesId: 'corylus_americana',
      stageName: 'mature_flowering',
      activeSubStages: [{ partName: 'leaf', subStageId: 'green' }],
    };
    const sources = listEligibleDebrisSourcesForPlant({ dayOfYear: 15 }, species, plant, 15);
    const layout = {
      plantId: 'p1',
      screenX: 50,
      occupantAnchorY: 80,
      groundY: 100,
      patchCapacity: 1,
      patchScale: 1,
      stageSize: 6,
      plantOrLogScale: 2,
    };
    const ctx = buildDebrisSpawnContextForPlant(
      plant,
      layout,
      2,
      2,
      sources[0],
      () => 0.5,
      { x: 200, y: 300, zBias: 0 },
    );
    expect(ctx?.spawnX).toBe(200);
    expect(ctx?.groundY).toBe(300);
    expect(ctx?.spawnY).toBeLessThan(300);
  });

  it('buildDebrisSpawnContextForTile rejects stale layout plant ids', () => {
    const tile = { plantIds: ['p1'] };
    const gameState = {
      dayOfYear: 26,
      plants: {
        p1: {
          alive: true,
          id: 'p1',
          speciesId: 'asclepias_syriaca',
          stageName: 'seed_set',
          activeSubStages: [{ partName: 'pod', subStageId: 'dry' }],
        },
      },
    };
    const layout = {
      plantId: 'old-plant',
      screenX: 200,
      occupantAnchorY: 300,
      groundY: 320,
      patchCapacity: 1,
      patchScale: 1,
      stageSize: 8,
      plantOrLogScale: 2,
    };
    expect(buildDebrisSpawnContextForTile(tile, gameState, layout, 4, 4, () => 0)).toBeNull();
  });

  it('floatDebrisWobbleRotationRad oscillates within amplitude', () => {
    const slot = {};
    initFloatDebrisWobble(slot, () => 0.25);
    const r0 = floatDebrisWobbleRotationRad(slot, 0);
    const r1 = floatDebrisWobbleRotationRad(slot, slot.wobblePeriodMs / 4);
    expect(Math.abs(r0)).toBeLessThan(slot.wobbleAmpRad + 1e-6);
    expect(Math.abs(r1)).toBeLessThan(slot.wobbleAmpRad + 1e-6);
    expect(r0).not.toBe(r1);
  });

  it('computeFloatDriftVelocity scales with gust multiplier', () => {
    const wind = { angleRadians: 0, strength: 1 };
    const calm = computeFloatDriftVelocity(wind, 1, () => 0.5, 0.5);
    const gusty = computeFloatDriftVelocity(wind, 1, () => 0.5, 1.5);
    expect(gusty.vx).toBeGreaterThan(calm.vx);
  });

  it('computeFloatDriftVelocity follows screen-space wind angle', () => {
    const east = computeFloatDriftVelocity(
      { angleRadians: 0, strength: 1 },
      1,
      () => 0.5,
    );
    expect(east.vx).toBeGreaterThan(0);
    expect(Math.abs(east.vy)).toBeLessThan(Math.abs(east.vx) * 0.1);

    const south = computeFloatDriftVelocity(
      { angleRadians: Math.PI / 2, strength: 1 },
      1,
      () => 0.5,
    );
    expect(south.vy).toBeGreaterThan(0);
    expect(Math.abs(south.vx)).toBeLessThan(Math.abs(south.vy) * 0.1);
  });

  it('floatDebrisPickBiasScreenPx offsets pick downward from canopy spawn', () => {
    const tileC = { position: { x: 0, y: 0 } };
    const worldPanLayer = { position: { x: 0, y: 0 } };
    const bias = floatDebrisPickBiasScreenPx(100, 140, 200, tileC, worldPanLayer);
    expect(bias).toBeGreaterThanOrEqual(8);
    const pick = floatDebrisTilePickScreenPx(100, 140, tileC, worldPanLayer, bias);
    const foot = tileLocalToScreenPx(100, 140, tileC, worldPanLayer);
    expect(pick.y).toBeGreaterThan(foot.y);
    expect(pick.x).toBe(foot.x);
  });

  it('screenToTileLocalPx inverts tileLocalToScreenPx', () => {
    const tileC = { position: { x: 40, y: -12 } };
    const worldPanLayer = { position: { x: 5, y: 3 } };
    const screen = tileLocalToScreenPx(180, 220, tileC, worldPanLayer);
    const local = screenToTileLocalPx(screen.x, screen.y, tileC, worldPanLayer);
    expect(local.x).toBeCloseTo(180, 5);
    expect(local.y).toBeCloseTo(220, 5);
  });

  it('spawnChanceThisFrame increases with wind strength', () => {
    const ctx = {
      windDebris: {
        spawnRatePerMinute: [0.5, 4],
        minWindStrength: 0.2,
      },
      instanceFactor: 1,
    };
    const low = spawnChanceThisFrame(ctx, 0.3, 100, 1);
    const high = spawnChanceThisFrame(ctx, 0.9, 100, 1);
    expect(high).toBeGreaterThan(low);
  });

  it('spawnChanceThisFrame scales with sub-stage instance factor', () => {
    const ctx = {
      windDebris: {
        spawnRatePerMinute: [1, 1],
        minWindStrength: 0,
      },
      instanceFactor: 1,
    };
    const full = spawnChanceThisFrame(ctx, 0.8, 100, 1, 1);
    const sparse = spawnChanceThisFrame(ctx, 0.8, 100, 1, 0.2);
    expect(full).toBeGreaterThan(sparse);
  });
});
