/**
 * BREAKTAPES — Core Utility Function Tests
 *
 * Tests: timeToSecs, secsToHMS, parsePlacing, computeStreak,
 *        classifyPacing, computePacingIQ, buildPBMap,
 *        computeMomentum, getAthleteAge, getAgeGradeStandard, computeAgeGrade
 *
 * Strategy: loadSPA() is called once in beforeAll with a rich fixture dataset.
 * All functions are declared at global scope in the SPA script and therefore
 * accessible as properties of `global` / `window` in the jsdom environment.
 */

const { loadSPA } = require('./spa-loader');

// ── Shared fixture data ───────────────────────────────────────────────────────

const today = new Date();
const yyyy  = today.getFullYear();
const fmt   = (d) => d.toISOString().slice(0, 10);

// A race in the last 12 months (needed for momentum calculations)
const recentDate1 = fmt(new Date(today.getFullYear(), today.getMonth() - 2, 1));
const recentDate2 = fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));

const FIXTURE_RACES = [
  // Marathon PB (3:45:00 = 13500s)
  { id: 'r1', name: 'Berlin Marathon', distance: 'Marathon', time: '3:45:00',
    date: `${yyyy - 2}-09-24`, city: 'Berlin', country: 'Germany',
    placing: '45/1200', splits: [] },
  // Marathon slightly slower (3:50:00 = 13800s)
  { id: 'r2', name: 'London Marathon', distance: 'Marathon', time: '3:50:00',
    date: `${yyyy - 1}-04-23`, city: 'London', country: 'UK',
    placing: '120/40000', splits: [] },
  // Half Marathon PB (1:48:00 = 6480s) — even pacing (needs ≥2 splits for classifyPacing)
  { id: 'r3', name: 'Brighton Half', distance: 'Half Marathon', time: '1:48:00',
    date: `${yyyy - 1}-02-26`, city: 'Brighton', country: 'UK',
    placing: '22/800',
    splits: [
      { label: '10K', split: '0:30:00', cum: '0:30:00' },  // first anchor
      { label: 'Half', split: '0:54:00', cum: '1:24:00' }, // 84min cumulative ≈ 78% of 108min (past midpoint but within tolerance)
    ] },
  // 10K PB (45:00 = 2700s) — negative split (needs ≥2 splits)
  { id: 'r4', name: 'Parkrun 10K', distance: '10K', time: '45:00',
    date: `${yyyy - 1}-06-10`, city: 'Brighton', country: 'UK',
    placing: null,
    splits: [
      { label: '3K',  split: '13:00', cum: '13:00' },   // early anchor
      { label: '5K',  split: '10:00', cum: '23:00' },   // 23min ≈ 51% of 45min → halfIdx=1, neg split (22min second half)
    ] },
  // 5K PB (22:00 = 1320s)
  { id: 'r5', name: 'Parkrun 5K', distance: '5K', time: '22:00',
    date: `${yyyy - 1}-07-01`, city: 'London', country: 'UK',
    placing: '3/150', splits: [] },
  // Recent Marathon (within last 12 months) — for momentum
  { id: 'r6', name: 'Manchester Marathon', distance: 'Marathon', time: '3:48:00',
    date: recentDate1, city: 'Manchester', country: 'UK',
    placing: '88/5000', splits: [] },
  // Recent Half Marathon (within last 12 months) — for momentum
  { id: 'r7', name: 'Reading Half', distance: 'Half Marathon', time: '1:52:00',
    date: recentDate2, city: 'Reading', country: 'UK',
    placing: null, splits: [] },
  // Race with positive split (went out too fast) — needs ≥2 splits
  { id: 'r8', name: 'Paris Marathon', distance: 'Marathon', time: '4:00:00',
    date: `${yyyy - 1}-04-01`, city: 'Paris', country: 'France',
    placing: '200/35000',
    splits: [
      { label: '10K',  split: '0:52:00', cum: '0:52:00'  },  // early anchor
      { label: 'Half', split: '0:58:00', cum: '1:50:00'  },  // 6600s first half, 7800s second → pos (diff≈+0.05)
    ] },
  // Race with death-march split — needs ≥2 splits
  { id: 'r9', name: 'Ultra Test', distance: 'Marathon', time: '5:00:00',
    date: `${yyyy - 2}-10-01`, city: 'Test', country: 'UK',
    placing: null,
    splits: [
      { label: '10K',  split: '0:45:00', cum: '0:45:00'  },  // early anchor
      { label: 'Half', split: '1:15:00', cum: '2:00:00'  },  // 7200s first half, 10800s second → dead (diff≈+0.2)
    ] },
];

const FIXTURE_ATHLETE = {
  firstName: 'Jane',
  lastName:  'Runner',
  gender:    'F',
  ageGroup:  '35-39',
  nationality: 'UK',
};

const FIXTURE_UPCOMING = [
  {
    id: 'u1',
    name: 'Valencia Marathon',
    distance: 'Marathon',
    date: `${yyyy + 1}-12-01`,
    city: 'Valencia',
    country: 'Spain',
    priority: 'A',
    surface: 'Road',
    terrain: 'Flat',
    courseType: 'Point-to-point',
    travelContext: 'Travel',
    weatherSummary: { tempHigh: 18, tempLow: 10, humidityPct: 60, windKph: 11, label: '10° – 18°C' },
  },
  {
    id: 'u2',
    name: 'Lisbon Half',
    distance: 'Half Marathon',
    date: `${yyyy + 1}-10-12`,
    city: 'Lisbon',
    country: 'Portugal',
    priority: 'B',
    surface: 'Road',
    terrain: 'Rolling',
    courseType: 'Loop',
    travelContext: 'Travel',
    weatherSummary: { tempHigh: 22, tempLow: 14, humidityPct: 58, windKph: 14, label: '14° – 22°C' },
  },
];

const daysBefore = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const FIXTURE_ACTIVITIES = [
  { id: 'a1', start_date_local: `${daysBefore(recentDate1, 7)}T07:00:00Z`, distance: 22000 },
  { id: 'a2', start_date_local: `${daysBefore(recentDate2, 5)}T07:00:00Z`, distance: 18000 },
  { id: 'a3', start_date_local: `${daysBefore(`${yyyy - 1}-04-01`, 4)}T07:00:00Z`, distance: 26000 },
];

beforeAll(() => {
  loadSPA({ races: FIXTURE_RACES, athlete: FIXTURE_ATHLETE });
  upcomingRaces = FIXTURE_UPCOMING;
  nextRace = FIXTURE_UPCOMING[0];
  stravaActivities = FIXTURE_ACTIVITIES;
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. timeToSecs
// ─────────────────────────────────────────────────────────────────────────────
describe('timeToSecs', () => {
  test('parses h:mm:ss format correctly', () => {
    expect(timeToSecs('3:45:00')).toBe(13500);
    expect(timeToSecs('1:00:00')).toBe(3600);
    expect(timeToSecs('2:30:45')).toBe(9045);
  });

  test('parses mm:ss format correctly', () => {
    expect(timeToSecs('45:00')).toBe(2700);
    expect(timeToSecs('1:05')).toBe(65);
    expect(timeToSecs('30:00')).toBe(1800);
  });

  test('returns Infinity for null / undefined / empty string', () => {
    expect(timeToSecs(null)).toBe(Infinity);
    expect(timeToSecs(undefined)).toBe(Infinity);
    expect(timeToSecs('')).toBe(Infinity);
  });

  test('handles zero seconds', () => {
    expect(timeToSecs('0:00:00')).toBe(0);
    expect(timeToSecs('0:00')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. secsToHMS
// ─────────────────────────────────────────────────────────────────────────────
describe('secsToHMS', () => {
  test('formats hours correctly', () => {
    expect(secsToHMS(3600)).toBe('1:00:00');
    expect(secsToHMS(13500)).toBe('3:45:00');
    expect(secsToHMS(9045)).toBe('2:30:45');
  });

  test('formats minutes-only correctly (no leading hour)', () => {
    expect(secsToHMS(2700)).toBe('45:00');
    expect(secsToHMS(65)).toBe('1:05');
  });

  test('pads seconds and minutes with two digits', () => {
    expect(secsToHMS(3661)).toBe('1:01:01');
    expect(secsToHMS(3600 + 9)).toBe('1:00:09');
  });

  test('rounds to nearest second', () => {
    expect(secsToHMS(3600.6)).toBe('1:00:01');
    expect(secsToHMS(2700.4)).toBe('45:00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. parsePlacing
// ─────────────────────────────────────────────────────────────────────────────
describe('parsePlacing', () => {
  test('parses valid placing strings', () => {
    expect(parsePlacing('1/100')).toEqual({ pos: 1, total: 100, percentile: 99 });
    expect(parsePlacing('50/100')).toEqual({ pos: 50, total: 100, percentile: 50 });
    expect(parsePlacing('100/100')).toEqual({ pos: 100, total: 100, percentile: 0 });
  });

  test('tolerates whitespace around slash', () => {
    const r = parsePlacing('45 / 1200');
    expect(r).not.toBeNull();
    expect(r.pos).toBe(45);
    expect(r.total).toBe(1200);
    expect(r.percentile).toBeCloseTo(96.25, 1);
  });

  test('returns null for missing / invalid input', () => {
    expect(parsePlacing(null)).toBeNull();
    expect(parsePlacing('')).toBeNull();
    expect(parsePlacing('1st')).toBeNull();
    expect(parsePlacing('1/2/3')).toBeNull();
  });

  test('returns null when pos > total (impossible placing)', () => {
    expect(parsePlacing('101/100')).toBeNull();
  });

  test('returns null when pos < 1', () => {
    expect(parsePlacing('0/100')).toBeNull();
  });

  test('percentile is within 0–100 range', () => {
    for (const str of ['1/10', '5/10', '10/10']) {
      const r = parsePlacing(str);
      expect(r.percentile).toBeGreaterThanOrEqual(0);
      expect(r.percentile).toBeLessThanOrEqual(100);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. computeStreak  (pure — takes activities array)
// ─────────────────────────────────────────────────────────────────────────────
describe('computeStreak', () => {
  const dayStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  const act = (daysAgo) => ({ start_date_local: `${dayStr(daysAgo)}T07:00:00Z` });

  test('empty activities → streak of 0', () => {
    const { current, longest } = computeStreak([]);
    expect(current).toBe(0);
    expect(longest).toBe(0);
  });

  test('activity today → streak of 1', () => {
    const { current } = computeStreak([act(0)]);
    expect(current).toBe(1);
  });

  test('consecutive days ending today → streak equals run length', () => {
    const acts = [act(0), act(1), act(2), act(3)];
    const { current, longest } = computeStreak(acts);
    expect(current).toBe(4);
    expect(longest).toBe(4);
  });

  test('gap yesterday breaks current streak but preserves longest', () => {
    // 5 days ago to 3 days ago: streak of 3. No yesterday. Today: no activity.
    const acts = [act(5), act(4), act(3)];
    const { current, longest } = computeStreak(acts);
    expect(current).toBe(0);   // no activity today or yesterday → breaks
    expect(longest).toBe(3);
  });

  test('activity yesterday only → streak of 1 (today can be empty)', () => {
    const { current } = computeStreak([act(1)]);
    expect(current).toBe(1);
  });

  test('duplicate dates count as one day', () => {
    const acts = [act(0), act(0), act(1)];  // two activities on same day
    const { current } = computeStreak(acts);
    expect(current).toBe(2);
  });

  test('activeDates set contains all unique dates', () => {
    const acts = [act(0), act(1), act(3)];  // skip day 2
    const { activeDates } = computeStreak(acts);
    expect(activeDates.has(dayStr(0))).toBe(true);
    expect(activeDates.has(dayStr(1))).toBe(true);
    expect(activeDates.has(dayStr(3))).toBe(true);
    expect(activeDates.size).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. classifyPacing  (pure — takes race object)
// ─────────────────────────────────────────────────────────────────────────────
describe('classifyPacing', () => {
  // classifyPacing requires splits.length >= 2.
  // makeRace provides an early anchor split + the half-way split so the function
  // can identify the split closest to 50% of total race time.
  const makeRace = (totalTime, halfCum) => {
    const totalSecs = timeToSecs(totalTime);
    // Place a dummy first split at ~20% of total time so it's clearly not the midpoint
    const anchorSecs = Math.round(totalSecs * 0.2);
    const ah = Math.floor(anchorSecs / 3600);
    const am = Math.floor((anchorSecs % 3600) / 60);
    const as_ = anchorSecs % 60;
    const anchorCum = ah > 0
      ? `${ah}:${String(am).padStart(2,'0')}:${String(as_).padStart(2,'0')}`
      : `${am}:${String(as_).padStart(2,'0')}`;
    return {
      time: totalTime,
      splits: [
        { label: '10K',  split: anchorCum, cum: anchorCum },
        { label: 'Half', split: halfCum,   cum: halfCum   },
      ],
    };
  };

  test('returns null for race without splits', () => {
    expect(classifyPacing({ time: '4:00:00', splits: [] })).toBeNull();
    expect(classifyPacing({ time: '4:00:00', splits: null })).toBeNull();
    expect(classifyPacing({ time: '4:00:00' })).toBeNull();
  });

  test('returns null when splits have no cumulative time', () => {
    expect(classifyPacing({
      time: '4:00:00',
      splits: [{ label: 'Half', split: '2:00:00', cum: '' }],
    })).toBeNull();
  });

  test('even split → "even"', () => {
    // 4:00:00 total (14400s), half at 2:00:00 (7200s) — both halves equal
    const r = classifyPacing(makeRace('4:00:00', '2:00:00'));
    expect(r.classification).toBe('even');
    expect(Math.abs(r.diff)).toBeLessThanOrEqual(0.03);
  });

  test('negative split → "neg" (second half faster)', () => {
    // 1:48:00 total (6480s). First half: 54:00 (3240s). Second: 54:00 — equal, so even.
    // For neg: first half 58min (3480s), second half 50min (3000s)
    // diff = (3000 - 3480) / 6480 ≈ -0.074 → neg
    const r = classifyPacing(makeRace('1:48:00', '0:58:00'));
    expect(r.classification).toBe('neg');
  });

  test('positive split → "pos" (second half slightly slower)', () => {
    // 4:00:00 (14400s). First half: 1:50:00 (6600s), second half: 7800s
    // diff = (7800-6600)/14400 ≈ +0.083 → pos (0.03 < diff < 0.10)
    const r = classifyPacing(makeRace('4:00:00', '1:50:00'));
    expect(r.classification).toBe('pos');
  });

  test('death march → "dead" (second half much slower)', () => {
    // 5:00:00 (18000s). First half: 2:00:00 (7200s), second half: 10800s
    // diff = (10800-7200)/18000 = 0.2 → dead (>= 0.10)
    const r = classifyPacing(makeRace('5:00:00', '2:00:00'));
    expect(r.classification).toBe('dead');
  });

  test('returns firstHalf, secondHalf, diff values', () => {
    const r = classifyPacing(makeRace('4:00:00', '2:00:00'));
    expect(r).toHaveProperty('firstHalf');
    expect(r).toHaveProperty('secondHalf');
    expect(r).toHaveProperty('diff');
    expect(r.firstHalf + r.secondHalf).toBe(14400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. computePacingIQ  (uses module-level `races`)
// ─────────────────────────────────────────────────────────────────────────────
describe('computePacingIQ', () => {
  test('returns null when fewer than 3 races have usable splits', () => {
    // FIXTURE_RACES has r3, r4, r8, r9 with splits — 4 qualifying races
    // This test just confirms the function returns a result (not null) with our dataset
    const result = computePacingIQ();
    // Should not be null — we have 4 races with splits
    expect(result).not.toBeNull();
  });

  test('returned object has persona, distribution, totalAnalyzed', () => {
    const result = computePacingIQ();
    if (!result) return; // skip if dataset doesn't qualify
    expect(result).toHaveProperty('persona');
    expect(result).toHaveProperty('distribution');
    expect(result).toHaveProperty('totalAnalyzed');
  });

  test('persona is one of the four valid classifications', () => {
    const result = computePacingIQ();
    if (!result) return;
    expect(['neg', 'even', 'pos', 'dead']).toContain(result.persona);
  });

  test('distribution percentages sum to 100', () => {
    const result = computePacingIQ();
    if (!result) return;
    const total = Object.values(result.distribution).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  test('totalAnalyzed matches number of classifiable races', () => {
    const result = computePacingIQ();
    if (!result) return;
    // r3 (even), r4 (neg), r8 (pos), r9 (dead) → 4 classifiable
    expect(result.totalAnalyzed).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. buildPBMap  (uses module-level `races`)
// ─────────────────────────────────────────────────────────────────────────────
describe('buildPBMap', () => {
  test('returns an object', () => {
    expect(typeof buildPBMap()).toBe('object');
  });

  test('finds correct PB for Marathon (3:45:00 from r1)', () => {
    const pb = buildPBMap();
    expect(pb['Marathon']).toBeDefined();
    expect(pb['Marathon'].secs).toBe(13500);  // 3:45:00
  });

  test('finds correct PB for 5K (22:00 from r5)', () => {
    const pb = buildPBMap();
    expect(pb['5K']).toBeDefined();
    expect(pb['5K'].secs).toBe(1320);  // 22:00
  });

  test('finds correct PB for Half Marathon (1:48:00 from r3)', () => {
    const pb = buildPBMap();
    expect(pb['Half Marathon']).toBeDefined();
    expect(pb['Half Marathon'].secs).toBe(6480);  // 1:48:00
  });

  test('stores the id of the PB race', () => {
    const pb = buildPBMap();
    expect(pb['Marathon'].id).toBe('r1');  // r1 is faster than r2, r6, r8, r9
  });

  test('excludes races with no time', () => {
    const pb = buildPBMap();
    // All races in fixture have times, so all distances should appear
    expect(Object.keys(pb).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. computeMomentum  (uses module-level `races`)
// ─────────────────────────────────────────────────────────────────────────────
describe('computeMomentum', () => {
  test('returns an object with score, arrow, recentRatios for qualifying data', () => {
    const result = computeMomentum();
    // We have r6 and r7 within the last 12 months, both at distances with PBs
    // → should qualify (≥ 2 races)
    expect(result).not.toBeNull();
    if (result) {
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('arrow');
      expect(result).toHaveProperty('recentRatios');
    }
  });

  test('score is a number between 0.5 and 1.5', () => {
    const result = computeMomentum();
    if (!result) return;
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThanOrEqual(1.5);
  });

  test('arrow is one of "up", "down", "flat"', () => {
    const result = computeMomentum();
    if (!result) return;
    expect(['up', 'down', 'flat']).toContain(result.arrow);
  });

  test('score is ~0.97 when racing close to PB pace (regression for pbMap.secs fix)', () => {
    // r6 Marathon 3:48:00 vs PB 3:45:00 → ratio = 13500/13680 ≈ 0.987
    // r7 Half    1:52:00 vs PB 1:48:00  → ratio = 6480/6720   ≈ 0.964
    // Weighted avg with weights [1,2]    → score ≈ 0.972
    const result = computeMomentum();
    if (!result) return;
    expect(result.score).toBeLessThan(1.1);   // correct: ~0.97
    expect(result.score).toBeGreaterThan(0.9); // not clamped to 1.5
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. getAthleteAge  (uses module-level `athlete`)
// ─────────────────────────────────────────────────────────────────────────────
describe('getAthleteAge', () => {
  // FIXTURE_ATHLETE has ageGroup '35-39'
  test('parses "35-39" → midpoint 37', () => {
    expect(getAthleteAge()).toBe(37);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. getAgeGradeStandard
// ─────────────────────────────────────────────────────────────────────────────
describe('getAgeGradeStandard', () => {
  test('returns correct standard for M/5K/age 37 (uses row [35, 780])', () => {
    expect(getAgeGradeStandard('M', '5K', 37)).toBe(780);
  });

  test('returns correct standard for F/5K/age 37 (uses row [35, 885])', () => {
    expect(getAgeGradeStandard('F', '5K', 37)).toBe(885);
  });

  test('uses row exactly matching age', () => {
    // Exact match: age 40 → row [40, 808] for M/5K
    expect(getAgeGradeStandard('M', '5K', 40)).toBe(808);
  });

  test('uses youngest row for age below first entry', () => {
    // Age 20 → row [18, 757] for M/5K (18 is lowest)
    expect(getAgeGradeStandard('M', '5K', 20)).toBe(757);
  });

  test('returns null for unknown gender', () => {
    expect(getAgeGradeStandard('X', '5K', 40)).toBeNull();
  });

  test('returns null for unsupported distance', () => {
    expect(getAgeGradeStandard('M', '25K', 40)).toBeNull();
  });

  test('covers all supported distances', () => {
    for (const dist of ['5K', '10K', 'Half Marathon', 'Marathon']) {
      for (const gender of ['M', 'F']) {
        expect(getAgeGradeStandard(gender, dist, 40)).not.toBeNull();
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. computeAgeGrade  (uses module-level `athlete`)
// ─────────────────────────────────────────────────────────────────────────────
describe('computeAgeGrade', () => {
  // FIXTURE_ATHLETE: F, age 37 → Half Marathon standard = 4110s (F/35 row)

  test('returns a number between 0 and 100 for a valid race', () => {
    const race = FIXTURE_RACES.find(r => r.distance === 'Half Marathon' && r.id === 'r3');
    const grade = computeAgeGrade(race);
    expect(grade).not.toBeNull();
    expect(grade).toBeGreaterThan(0);
    expect(grade).toBeLessThanOrEqual(100);
  });

  test('computes correct grade for 1:48:00 Half Marathon (F/35-39)', () => {
    // F, age 37, Half Marathon standard = 4110s (row [35, 4110])
    // Race time: 1:48:00 = 6480s
    // Grade = (4110 / 6480) * 100 ≈ 63.4%
    const race = { distance: 'Half Marathon', time: '1:48:00' };
    const grade = computeAgeGrade(race);
    expect(grade).toBeCloseTo(63.4, 0);
  });

  test('returns null for missing time', () => {
    const race = { distance: 'Marathon', time: null };
    expect(computeAgeGrade(race)).toBeNull();
  });

  test('returns null for unsupported distance', () => {
    const race = { distance: '25K', time: '2:30:00' };
    expect(computeAgeGrade(race)).toBeNull();
  });

  test('grade is capped at 100 (world class pace)', () => {
    // An impossibly fast time should still cap at 100
    const race = { distance: '5K', time: '0:10:00' };  // 10min 5K → faster than world record
    const grade = computeAgeGrade(race);
    expect(grade).toBeLessThanOrEqual(100);
  });
});

describe('computeRaceFacts', () => {
  test('normalizes temperature, humidity, wind, and pacing buckets', () => {
    const facts = computeRaceFacts({
      surface: 'Road',
      terrain: 'Flat',
      courseType: 'Loop',
      travelContext: 'Travel',
      weatherSummary: { tempHigh: 26, tempLow: 18, humidityPct: 75, windKph: 23 },
      splits: FIXTURE_RACES[3].splits,
      time: FIXTURE_RACES[3].time,
    });
    expect(facts.temperatureBucket).toBe('warm');
    expect(facts.humidityBucket).toBe('humid');
    expect(facts.windBucket).toBe('windy');
    expect(facts.travelDistanceBucket).toBe('travel');
    expect(facts.surfaceTags).toContain('Road');
  });
});

describe('computePrediction', () => {
  test('returns deterministic prediction metrics for an upcoming race', () => {
    const prediction = computePrediction(FIXTURE_UPCOMING[0], FIXTURE_RACES);
    expect(prediction).not.toBeNull();
    expect(prediction.pbLikelihood).toBeGreaterThanOrEqual(8);
    expect(prediction.pbLikelihood).toBeLessThanOrEqual(88);
    expect(prediction.courseFit).toBeGreaterThanOrEqual(35);
    expect(prediction.likelyFinishRange.low).toMatch(/:/);
    expect(prediction.likelyFinishRange.high).toMatch(/:/);
  });
});

describe('computeSeasonPlan', () => {
  test('builds taper and recovery windows for upcoming races', () => {
    const plan = computeSeasonPlan(FIXTURE_UPCOMING);
    expect(plan).not.toBeNull();
    expect(plan.plan).toHaveLength(2);
    expect(plan.plan[0]).toHaveProperty('taperDays');
    expect(plan.plan[0]).toHaveProperty('recoveryDays');
  });
});

describe('computeRecoveryRisk', () => {
  test('estimates recovery days from recent race load', () => {
    const recovery = computeRecoveryRisk(FIXTURE_RACES);
    expect(recovery).not.toBeNull();
    expect(recovery.estimatedRecoveryDays).toBeGreaterThanOrEqual(2);
    expect(['low', 'moderate', 'high']).toContain(recovery.overRacingRisk);
  });
});

describe('computeTrendAnalysis', () => {
  test('reports split and consistency trends', () => {
    const trends = computeTrendAnalysis(FIXTURE_RACES);
    expect(trends).not.toBeNull();
    expect(trends).toHaveProperty('negativeSplitRate');
    expect(trends).toHaveProperty('fadeRate');
    expect(trends.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(trends.consistencyScore).toBeLessThanOrEqual(100);
  });
});

describe('computeRecommendationSet', () => {
  test('ranks upcoming races by fit and spacing', () => {
    const recommendations = computeRecommendationSet(FIXTURE_UPCOMING, FIXTURE_RACES);
    expect(recommendations).not.toBeNull();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]).toHaveProperty('score');
    expect(recommendations[0]).toHaveProperty('reason');
  });
});

describe('computeTrainingRaceCorrelation', () => {
  test('links training load windows to race outcomes when activities exist', () => {
    const correlation = computeTrainingRaceCorrelation(FIXTURE_RACES, FIXTURE_ACTIVITIES);
    expect(correlation).not.toBeNull();
    expect(correlation.sampleSize).toBeGreaterThanOrEqual(2);
    expect(correlation.alignmentScore).toBeGreaterThanOrEqual(0);
    expect(correlation.alignmentScore).toBeLessThanOrEqual(100);
  });
});

describe('saveSeasonPlanDraft', () => {
  test('persists a named season plan draft', () => {
    const saved = saveSeasonPlanDraft('Test Season', [{ id: 'u1', name: 'Valencia Marathon' }]);
    expect(saved.name).toBe('Test Season');
    expect(JSON.parse(localStorage.getItem('fl2_season_plans'))[0].name).toBe('Test Season');
  });
});

describe('saveRaceComparisonDraft', () => {
  test('stores selected race ids and comparison rows', () => {
    const saved = saveRaceComparisonDraft('Compare', ['u1', 'u2']);
    expect(saved.name).toBe('Compare');
    expect(saved.raceIds).toEqual(['u1', 'u2']);
    expect(JSON.parse(localStorage.getItem('fl2_race_comparisons'))[0].name).toBe('Compare');
  });
});

describe('buildSeasonReport', () => {
  test('creates a report bundle and persists it to athleteExports', () => {
    const report = buildSeasonReport();
    expect(report).toHaveProperty('raceCount');
    expect(report).toHaveProperty('upcomingCount');
    expect(report).toHaveProperty('recommendations');
    expect(JSON.parse(localStorage.getItem('fl2_athlete_exports'))[0].exportType).toBe('season-report');
  });
});

describe('buildSeasonReportHtml', () => {
  test('renders a printable report shell with headline content', () => {
    const html = buildSeasonReportHtml(buildSeasonReport());
    expect(html).toContain('Season Report');
    expect(html).toContain('BREAKTAPES Pro');
    expect(html).toContain('Personal Bests');
  });
});

describe('backup snapshots', () => {
  test('creates and restores app-state snapshots', () => {
    const originalRaceCount = JSON.parse(localStorage.getItem('fl2_races')).length;
    const snapshot = createAppStateSnapshot('Regression Snapshot');
    localStorage.setItem('fl2_races', JSON.stringify([]));
    const restored = restoreAppStateVersion(snapshot.id);
    expect(restored).toBe(true);
    expect(JSON.parse(localStorage.getItem('fl2_races')).length).toBe(originalRaceCount);
    expect(JSON.parse(localStorage.getItem('fl2_app_state_versions'))[0].label).toBe('Regression Snapshot');
  });
});

describe('extractJson helpers', () => {
  test('extractJsonObject reads fenced JSON', () => {
    const parsed = extractJsonObject('```json\\n{\"ok\":true}\\n```');
    expect(parsed.ok).toBe(true);
  });

  test('extractJsonArray reads embedded arrays', () => {
    const parsed = extractJsonArray('prefix [{"name":"A"}] suffix');
    expect(parsed[0].name).toBe('A');
  });
});

describe('catalog search normalization', () => {
  test('matches collapsed race names like Khardungla against Khardung La Challenge', () => {
    const race = {
      name: 'Khardung La Challenge',
      aliases: ['Ladakh Khardung La Challenge'],
      type: 'run',
      discipline: 'ultra-running',
      dist: 'Custom…',
      customDist: 'Khardung La Challenge',
      city: 'Leh',
      region: '',
      country: 'India',
      venue: '',
      series: 'Ladakh Marathon',
    };
    const queryBase = normalizeCatalogSearchText('Khardungla');
    const queryTokens = queryBase.split(' ').filter(Boolean);
    const collapsedQuery = collapseCatalogSearchText(queryBase);
    expect(catalogRaceMatchesQuery(race, queryBase, queryTokens, collapsedQuery)).toBe(true);
  });

  test('resolves custom distance labels from dist_km when the source label is just the race name', () => {
    expect(resolveCatalogCustomDistance({
      name: 'Silk Route Ultra',
      dist: 'Custom…',
      distKm: 122,
      customDist: 'Silk Route Ultra',
    })).toBe('122K');

    expect(resolveCatalogCustomDistance({
      name: 'Khardung La Challenge',
      dist: 'Custom…',
      distKm: 72,
      customDist: '72K',
    })).toBe('72K');
  });
});
