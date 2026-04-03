import {
  generateTechForest,
  getTechForestChildResearchBlocker,
  getTechForestStrictPrerequisiteBlocker,
  initialTechUnlocksAllLocked,
  isTechResearchDisplayComplete,
} from './techForestGen.mjs';

describe('isTechResearchDisplayComplete', () => {
  const forest = {
    byUnlockKey: {
      a: { unlockKey: 'a', parentUnlockKey: null, researchTicks: 1 },
      b: { unlockKey: 'b', parentUnlockKey: 'a', researchTicks: 1 },
      c: { unlockKey: 'c', parentUnlockKey: 'b', researchTicks: 1 },
    },
  };

  test('full chain true is complete', () => {
    const techUnlocks = { a: true, b: true, c: true };
    expect(isTechResearchDisplayComplete(forest, techUnlocks, 'c')).toBe(true);
    expect(isTechResearchDisplayComplete(forest, techUnlocks, 'a')).toBe(true);
  });

  test('child true with missing parent is not display-complete', () => {
    const techUnlocks = { a: true, b: false, c: true };
    expect(isTechResearchDisplayComplete(forest, techUnlocks, 'c')).toBe(false);
  });

  test('false when key not researched', () => {
    expect(isTechResearchDisplayComplete(forest, { a: true }, 'b')).toBe(false);
  });

  test('vision-granted key is display-complete even when ancestors are locked', () => {
    const techUnlocks = { a: false, b: true, c: false };
    const sources = { visionGranted: { b: true }, partnerResearched: null };
    expect(isTechResearchDisplayComplete(forest, techUnlocks, 'b', sources)).toBe(true);
  });

  test('partner-researched key is display-complete even when ancestors are locked', () => {
    const techUnlocks = { a: false, b: true, c: true };
    const sources = { visionGranted: null, partnerResearched: { c: true } };
    expect(isTechResearchDisplayComplete(forest, techUnlocks, 'c', sources)).toBe(true);
  });

  test('vision on parent does not make child display-complete', () => {
    const techUnlocks = { a: false, b: true, c: true };
    const sources = { visionGranted: { b: true }, partnerResearched: null };
    expect(isTechResearchDisplayComplete(forest, techUnlocks, 'c', sources)).toBe(false);
  });
});

describe('getTechForestStrictPrerequisiteBlocker', () => {
  const forest = {
    byUnlockKey: {
      a: { unlockKey: 'a', parentUnlockKey: null, researchTicks: 1 },
      b: { unlockKey: 'b', parentUnlockKey: 'a', researchTicks: 1 },
      c: { unlockKey: 'c', parentUnlockKey: 'b', researchTicks: 1 },
    },
  };

  test('returns null when fromKey and all ancestors are unlocked', () => {
    const techUnlocks = { a: true, b: true, c: true };
    expect(getTechForestStrictPrerequisiteBlocker(forest, techUnlocks, 'c')).toBe(null);
    expect(getTechForestStrictPrerequisiteBlocker(forest, techUnlocks, 'b')).toBe(null);
  });

  test('returns first missing key walking up from fromKey', () => {
    const techUnlocks = { a: true, b: false, c: true };
    expect(getTechForestStrictPrerequisiteBlocker(forest, techUnlocks, 'c')).toBe('b');
  });

  test('seed 10000: ladder-only unlock leaves fishing rod as blocker for shovel parent chain', () => {
    const f = generateTechForest(10000);
    const techUnlocks = initialTechUnlocksAllLocked(f);
    techUnlocks.unlock_tool_ladder = true;
    expect(f.byUnlockKey.unlock_tool_shovel.parentUnlockKey).toBe('unlock_tool_ladder');
    expect(getTechForestStrictPrerequisiteBlocker(f, techUnlocks, 'unlock_tool_ladder')).toBe(
      'unlock_tool_fishing_rod',
    );
  });

  test('unknown forest key fails closed (blocker is that key)', () => {
    const forest = { byUnlockKey: { a: { unlockKey: 'a', parentUnlockKey: null, researchTicks: 1 } } };
    expect(getTechForestStrictPrerequisiteBlocker(forest, {}, 'ghost')).toBe('ghost');
  });
});

describe('getTechForestChildResearchBlocker', () => {
  const f = generateTechForest(10000);

  test('vision-only ladder blocks shovel even when fishing rod is researched', () => {
    const techUnlocks = initialTechUnlocksAllLocked(f);
    techUnlocks.unlock_tool_fishing_rod = true;
    techUnlocks.unlock_tool_ladder = true;
    const visionGranted = { unlock_tool_ladder: true };
    const block = getTechForestChildResearchBlocker(
      f,
      techUnlocks,
      'unlock_tool_ladder',
      visionGranted,
      {},
    );
    expect(block).toEqual({ blockerKey: 'unlock_tool_ladder', reason: 'vision_parent' });
  });

  test('partner-researched ladder clears vision_parent gate for shovel', () => {
    const techUnlocks = initialTechUnlocksAllLocked(f);
    techUnlocks.unlock_tool_fishing_rod = true;
    techUnlocks.unlock_tool_ladder = true;
    const visionGranted = { unlock_tool_ladder: true };
    const partnerResearched = { unlock_tool_ladder: true };
    expect(
      getTechForestChildResearchBlocker(
        f,
        techUnlocks,
        'unlock_tool_ladder',
        visionGranted,
        partnerResearched,
      ),
    ).toBe(null);
  });
});
