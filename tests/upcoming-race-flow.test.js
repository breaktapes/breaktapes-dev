const { loadSPA } = require('./spa-loader');

const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const pastDate = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('upcoming-only race flow', () => {
  test('migrateFutureHistoryToUpcoming moves future history races into upcoming storage', () => {
    loadSPA({
      races: [
        { id: 1, name: 'Future Test', distance: 'Marathon', type: 'run', date: futureDate, city: 'Valencia', country: 'Spain', priority: 'A' },
        { id: 2, name: 'Past Test', distance: 'Marathon', type: 'run', date: pastDate, city: 'Berlin', country: 'Germany' },
      ],
      athlete: { name: 'Tester' },
    });

    expect(migrateFutureHistoryToUpcoming()).toBe(true);

    const storedRaces = JSON.parse(localStorage.getItem('fl2_races'));
    const storedUpcoming = JSON.parse(localStorage.getItem('fl2_upcoming'));
    const storedNextRace = JSON.parse(localStorage.getItem('fl2_nr'));

    expect(storedRaces).toHaveLength(1);
    expect(storedRaces[0].name).toBe('Past Test');
    expect(storedUpcoming).toHaveLength(1);
    expect(storedUpcoming[0]).toMatchObject({
      name: 'Future Test',
      date: futureDate,
      location: 'Valencia, Spain',
      distance: 'Marathon',
      type: 'run',
    });
    expect(storedNextRace.name).toBe('Future Test');
  });

  test('saveNR rejects past dates so completed races stay out of upcoming', () => {
    loadSPA({ races: [], athlete: { name: 'Tester' } });
    document.body.innerHTML += `
      <div id="nrModal" data-edit-id=""></div>
      <input id="nrN" value="Past Upcoming" />
      <input id="nrDt" value="${pastDate}" />
      <select id="nrType"><option value="run" selected>run</option></select>
      <select id="nrDis"><option value="Marathon" selected>Marathon</option></select>
      <input id="nrCustomDist" value="" />
      <div id="nrCustomWrap" style="display:none"></div>
      <input id="nrCi" value="Boston" />
      <select id="nrCo"><option value="United States" selected>United States</option></select>
      <select id="nrPri"><option value="A" selected>A</option></select>
      <div id="cdCard"></div>
      <div id="raceForecastStrip"><div id="raceForecastContent"></div></div>
      <div id="raceDNAContent"></div>
    `;
    global.alert = jest.fn();

    saveNR();

    expect(global.alert).toHaveBeenCalledWith('Upcoming races must be in the future. Use Race History for completed events.');
    expect(JSON.parse(localStorage.getItem('fl2_upcoming') || '[]')).toEqual([]);
  });
});
