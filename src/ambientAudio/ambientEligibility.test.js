import {
  isBeehiveTileEligible,
  isCampfireEligible,
  isPartnerWorkEligible,
  listenerInCampFootprint,
} from './ambientEligibility.mjs';

function stateWithCamp(anchorX, anchorY) {
  return {
    camp: { anchorX, anchorY },
    width: 20,
    height: 20,
  };
}

describe('listenerInCampFootprint', () => {
  test('inside footprint', () => {
    const s = stateWithCamp(10, 10);
    expect(listenerInCampFootprint(s, 10, 10)).toBe(true);
    expect(listenerInCampFootprint(s, 12, 11)).toBe(true);
  });

  test('outside footprint', () => {
    const s = stateWithCamp(10, 10);
    expect(listenerInCampFootprint(s, 8, 10)).toBe(false);
    expect(listenerInCampFootprint(s, 10, 14)).toBe(false);
  });
});

describe('isCampfireEligible', () => {
  const entry = {
    audio_role: 'camp_campfire',
    audibility: { requires_listener_in_camp_footprint: true },
  };

  test('eligible when listener in footprint', () => {
    const s = stateWithCamp(5, 5);
    expect(isCampfireEligible(entry, s, 5, 6)).toBe(true);
  });

  test('not eligible outside footprint', () => {
    const s = stateWithCamp(5, 5);
    expect(isCampfireEligible(entry, s, 2, 2)).toBe(false);
  });

  test('not eligible when more than 3 Chebyshev tiles from camp anchor', () => {
    const s = stateWithCamp(5, 5);
    expect(isCampfireEligible(entry, s, 9, 5)).toBe(false);
  });
});

describe('isBeehiveTileEligible', () => {
  const entry = {
    audio_role: 'sim_beehive',
    species_id: 'bombus_pennsylvanicus_colony',
    audibility: { requires_listener_chebyshev_adjacent: true, requires_beehive_active: true },
  };

  test('adjacent active hive matches species', () => {
    const s = {};
    const tile = { x: 5, y: 5, beehive: { active: true, speciesId: 'bombus_pennsylvanicus_colony' } };
    expect(isBeehiveTileEligible(entry, s, tile, 5, 6)).toBe(true);
    expect(isBeehiveTileEligible(entry, s, tile, 4, 4)).toBe(true);
  });

  test('not adjacent', () => {
    const s = {};
    const tile = { x: 5, y: 5, beehive: { active: true, speciesId: 'bombus_pennsylvanicus_colony' } };
    expect(isBeehiveTileEligible(entry, s, tile, 3, 5)).toBe(false);
  });

  test('inactive hive', () => {
    const s = {};
    const tile = { x: 5, y: 5, beehive: { active: false, speciesId: 'bombus_pennsylvanicus_colony' } };
    expect(isBeehiveTileEligible(entry, s, tile, 5, 6)).toBe(false);
  });
});

describe('isPartnerWorkEligible', () => {
  const entry = {
    audio_role: 'partner_station_work',
    task_match: { task_kind: 'camp_maintenance' },
    audibility: { requires_listener_in_camp_footprint: true },
  };

  test('active maintenance and listener in camp', () => {
    const s = {
      ...stateWithCamp(8, 8),
      camp: {
        anchorX: 8,
        anchorY: 8,
        partnerTaskQueue: { active: { kind: 'camp_maintenance', meta: {} }, queued: [] },
      },
    };
    expect(isPartnerWorkEligible(entry, s, 8, 9)).toBe(true);
  });

  test('no active task', () => {
    const s = {
      ...stateWithCamp(8, 8),
      camp: {
        anchorX: 8,
        anchorY: 8,
        partnerTaskQueue: { active: null, queued: [] },
      },
    };
    expect(isPartnerWorkEligible(entry, s, 8, 9)).toBe(false);
  });
});
