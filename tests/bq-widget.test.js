const { loadSPA } = require('./spa-loader');

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('Boston Qualifier summary', () => {
  test('returns profile-needed when athlete demographics are missing', () => {
    loadSPA({ races: [], athlete: { name: 'Tester' } });
    expect(computeBQSummary().state).toBe('profile-needed');
  });

  test('maps 25-29 into the 18-34 B.A.A. band', () => {
    loadSPA({
      races: [],
      athlete: { name: 'Runner', gender: 'F', ageGroup: '25–29' },
    });

    const summary = computeBQSummary();
    expect(summary.state).toBe('history-needed');
    expect(summary.standard.band).toBe('18-34');
    expect(summary.standard.time).toBe('3:25:00');
  });

  test('derives age group from date of birth when available', () => {
    loadSPA({
      races: [],
      athlete: { name: 'Runner', gender: 'F', dob: '1999-03-29' },
    });

    const summary = computeBQSummary();
    expect(getAthleteAgeGroup()).toBe('25–29');
    expect(summary.state).toBe('history-needed');
    expect(summary.standard.band).toBe('18-34');
  });

  test('maps older DOB values into the correct later age band', () => {
    loadSPA({
      races: [],
      athlete: { name: 'Runner', gender: 'M', dob: '1958-03-29' },
    });

    expect(getAthleteAgeGroup()).toBe('65–69');
    expect(computeBQSummary().standard.time).toBe('4:05:00');
  });

  test('edit profile age-group field auto-updates from DOB', () => {
    loadSPA({
      races: [],
      athlete: { name: 'Runner', gender: 'F', dob: '1999-03-29' },
    });

    document.body.innerHTML += `
      <input id="eDob" type="date" value="1999-03-29" />
      <input id="eAG" type="text" value="" />
    `;

    updateDerivedAgeGroupField();
    expect(document.getElementById('eAG').value).toBe('25–29');
  });

  test('championship tracker keeps Boston untracked until it is in past or upcoming races', () => {
    loadSPA({
      races: [
        { id: 1, name: 'Test Marathon', distance: 'Marathon', time: '2:58:00', date: '2026-01-01', type: 'run' },
      ],
      athlete: { name: 'Runner', gender: 'M', ageGroup: '35–39' },
    });

    const rows = computeAthleteChampionshipTracker();
    const boston = rows.find(row => row.key === 'boston');
    expect(boston.status).toBe('Not tracked');
  });

  test('championship tracker includes all seven world majors and flags upcoming majors in progress', () => {
    loadSPA({
      races: [
        { id: 1, name: 'Tokyo Marathon 2025', distance: 'Marathon', time: '3:20:00', date: '2025-03-02', type: 'run', city: 'Tokyo', country: 'Japan' },
      ],
      nextRace: { id: 2, name: 'Chicago Marathon 2026', distance: 'Marathon', date: '2026-10-11', type: 'run', city: 'Chicago', country: 'USA' },
      athlete: { name: 'Runner', gender: 'M', dob: '1990-03-29' },
    });

    const rows = computeAthleteChampionshipTracker();
    expect(rows).toHaveLength(7);
    expect(rows.map(row => row.key)).toEqual(['tokyo', 'boston', 'london', 'sydney', 'berlin', 'chicago', 'new_york_city']);
    expect(rows.find(row => row.key === 'tokyo').status).toBe('Completed');
    expect(rows.find(row => row.key === 'chicago').status).toBe('In Progress');
  });

  test('signature distances returns up to three scored PB distances', () => {
    loadSPA({
      races: [
        { id: 1, name: '5K Race', distance: '5K', distKm: 5, time: '0:20:00', date: '2026-01-01', type: 'run' },
        { id: 2, name: '10K Race', distance: '10K', distKm: 10, time: '0:42:00', date: '2026-02-01', type: 'run' },
        { id: 3, name: 'Half Race', distance: 'Half Marathon', distKm: 21.1, time: '1:35:00', date: '2026-03-01', type: 'run' },
      ],
      athlete: { name: 'Runner', gender: 'F', ageGroup: '25–29' },
    });

    const rows = computeSignatureDistances();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
  });

  test('computes qualifier margin from best marathon result', () => {
    loadSPA({
      races: [
        { id: 1, name: 'Marathon A', distance: 'Marathon', time: '3:04:00', date: '2025-01-01', type: 'run' },
        { id: 2, name: 'Marathon B', distance: 'Marathon', time: '2:58:00', date: '2026-01-01', type: 'run' },
      ],
      athlete: { name: 'Runner', gender: 'M', ageGroup: '35–39' },
    });

    const summary = computeBQSummary();
    expect(summary.state).toBe('ready');
    expect(summary.standard.time).toBe('3:00:00');
    expect(summary.best.name).toBe('Marathon B');
    expect(summary.marginSecs).toBe(120);
    expect(summary.qualifies).toBe(true);
    expect(summary.likelyAccepted).toBe(false);
  });

  test('race personality returns ranked athlete traits', () => {
    loadSPA({
      races: [
        { id: 1, name: 'Trail 50K', distance: '50K', distKm: 50, time: '5:05:00', date: '2025-04-01', type: 'ultra', surface: 'Trail', elevationProfile: 'Hilly', splits: ['1:05:00', '1:02:00', '0:58:00', '1:00:00', '1:00:00'] },
        { id: 2, name: 'City Half', distance: 'Half Marathon', distKm: 21.1, time: '1:34:00', date: '2025-10-01', type: 'run', weatherSummary: { tempHigh: 27 }, splits: ['0:48:00', '0:46:00'] },
        { id: 3, name: 'Another Half', distance: 'Half Marathon', distKm: 21.1, time: '1:33:00', date: '2026-02-01', type: 'run', weatherSummary: { tempHigh: 28 }, splits: ['0:47:30', '0:45:30'] },
      ],
      athlete: { name: 'Runner', gender: 'F', dob: '1996-03-29' },
    });

    const rows = computeRacePersonality();
    expect(rows.length).toBe(3);
    expect(rows[0].name).toBeTruthy();
    expect(rows[0].score).toBeGreaterThanOrEqual(rows[1].score);
  });

  test('race cost tracker summarizes tracked spend and cost per race', () => {
    loadSPA({
      races: [
        { id: 1, name: 'Race A', distance: 'Half Marathon', distKm: 21.1, time: '1:40:00', date: '2026-01-01', type: 'run', registrationCost: 120, hotelCost: 180, flightCost: 200, gearCost: 50 },
        { id: 2, name: 'Race B', distance: 'Marathon', distKm: 42.2, time: '3:20:00', date: '2026-02-01', type: 'run', costs: { registration: 140, hotel: 220, gear: 90 } },
      ],
      athlete: { name: 'Runner', gender: 'M', dob: '1990-03-29' },
    });

    const summary = computeRaceCostTracker();
    expect(summary.raceCount).toBe(2);
    // total is now an array of {amount, currency} objects (multi-currency support)
    const usdTotal = Array.isArray(summary.total)
      ? summary.total.find(t => t.currency === 'USD')?.amount
      : summary.total;
    expect(usdTotal).toBe(1000);
    const usdAvg = Array.isArray(summary.avg)
      ? summary.avg.find(t => t.currency === 'USD')?.amount
      : summary.avg;
    expect(Math.round(usdAvg)).toBe(500);
  });
});
