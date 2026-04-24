import { partnerTaskMatches } from './partnerTaskMatch.mjs';

describe('partnerTaskMatches', () => {
  const entry = {
    audio_role: 'partner_station_work',
    task_match: {
      task_kind: 'camp_maintenance',
      meta: { source: 'auto' },
    },
  };

  test('matches kind and required meta keys (extra keys on task allowed)', () => {
    expect(partnerTaskMatches(entry, {
      kind: 'camp_maintenance',
      meta: { source: 'auto', extra: 1 },
    })).toBe(true);
    expect(partnerTaskMatches(entry, {
      kind: 'camp_maintenance',
      meta: { source: 'wrong' },
    })).toBe(false);
  });

  test('rejects wrong kind', () => {
    expect(partnerTaskMatches(entry, { kind: 'other', meta: { source: 'auto' } })).toBe(false);
  });

  test('rejects null active', () => {
    expect(partnerTaskMatches(entry, null)).toBe(false);
  });
});
