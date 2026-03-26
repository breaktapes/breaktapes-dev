const { loadSPA } = require('./spa-loader');

beforeAll(() => {
  loadSPA({ races: [] });
});

describe('Achievement helpers', () => {
  test('normalizes world marathon major variants', () => {
    expect(normalizeWorldMajorKey('TCS New York City Marathon')).toBe('new_york_city');
    expect(normalizeWorldMajorKey('NYC Marathon')).toBe('new_york_city');
    expect(normalizeWorldMajorKey('Boston Marathon')).toBe('boston');
  });

  test('normalizes achievement distances used in ladder matching', () => {
    expect(normalizeAchievementDistance('10K')).toBe('10KM');
    expect(normalizeAchievementDistance('70.3')).toBe('70.3 / Half Ironman');
    expect(normalizeAchievementDistance('Full Ironman')).toBe('Ironman / Full');
  });

  test('evaluates ladder PB thresholds', () => {
    const result = evaluateAchievementCriteria(
      { criteria: { type: 'pb_seconds', distance: '10KM', seconds: 3000 } },
      [],
      { '10KM': { secs: 2700, raceId: 'r1' } }
    );

    expect(result.unlocked).toBe(true);
    expect(result.sourceRaceId).toBe('r1');
  });

  test('counts unique world majors for six star logic', () => {
    const rows = [
      { name: 'Tokyo Marathon', worldMajorKey: 'tokyo' },
      { name: 'Boston Marathon', worldMajorKey: 'boston' },
      { name: 'London Marathon', worldMajorKey: 'london' },
      { name: 'Berlin Marathon', worldMajorKey: 'berlin' },
      { name: 'Chicago Marathon', worldMajorKey: 'chicago' },
      { name: 'NYC Marathon', worldMajorKey: 'new_york_city' },
      { name: 'Boston Marathon', worldMajorKey: 'boston' },
    ];

    const result = evaluateAchievementCriteria(
      { criteria: { type: 'world_major_count', value: 6 } },
      rows,
      {}
    );

    expect(result.unlocked).toBe(true);
    expect(result.proof.majors).toEqual(
      expect.arrayContaining(['tokyo', 'boston', 'london', 'berlin', 'chicago', 'new_york_city'])
    );
  });
});
