const {
  dedupeRows,
  extractFinishersRacesFromHtml,
  extractTotalPages,
  extractTypesenseDocuments,
  normalizeDistanceVariant,
  transformFinishersRace,
} = require('../scripts/add-finishers-events');

const FINISHERS_HTML = `
<!DOCTYPE html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">
      {
        "props": {
          "pageProps": {
            "races": [
              {
                "eventName": "Marathon de Gand",
                "eventName_en": "Ghent Marathon",
                "city": "Gand",
                "city_en": "Ghent",
                "level1": "Flandre",
                "level1_en": "Flanders",
                "country": "Belgique",
                "country_en": "Belgium",
                "editionStartDate": "2026-03-29",
                "editionEndDate": "2026-03-29",
                "editionStatus": "confirmed",
                "raceDiscipline": "road",
                "_geoloc": { "lat": 51.05, "lng": 3.73 },
                "raceDistanceVariants": [21097.5, 42195],
                "raceDistanceUnitVariants": ["meters", "meters"]
              },
              {
                "eventName": "Trail du Test",
                "eventName_en": "Test Trail",
                "city": "Annecy",
                "country": "France",
                "country_en": "France",
                "editionStartDate": "2025-08-18",
                "editionEndDate": "2025-08-18",
                "editionStatus": "rescheduled",
                "raceDiscipline": "trail",
                "raceDistanceVariants": [17000],
                "raceDistanceUnitVariants": ["meters"]
              },
              {
                "eventName": "Canceled Event",
                "eventName_en": "Canceled Event",
                "city": "Paris",
                "country_en": "France",
                "editionStartDate": "2026-06-01",
                "editionEndDate": "2026-06-01",
                "editionStatus": "canceled",
                "raceDiscipline": "road",
                "raceDistanceVariants": [10000],
                "raceDistanceUnitVariants": ["meters"]
              }
            ]
          }
        }
      }
    </script>
  </body>
</html>
`;

describe('Finishers importer', () => {
  test('normalizeDistanceVariant maps standard and custom distances', () => {
    expect(normalizeDistanceVariant(5000, 'meters')).toEqual({
      dist: '5KM',
      distKm: 5,
      customDist: '',
    });
    expect(normalizeDistanceVariant(21097.5, 'meters')).toEqual({
      dist: 'Half Marathon',
      distKm: 21.1,
      customDist: '',
    });
    expect(normalizeDistanceVariant(17000, 'meters')).toEqual({
      dist: 'Custom…',
      distKm: 17,
      customDist: '17K',
    });
  });

  test('transformFinishersRace expands each distance variant into a separate row', () => {
    const rows = transformFinishersRace({
      eventName: 'Marathon de Gand',
      eventName_en: 'Ghent Marathon',
      city: 'Gand',
      city_en: 'Ghent',
      country: 'Belgique',
      country_en: 'Belgium',
      level1_en: 'Flanders',
      editionStartDate: '2026-03-29',
      editionEndDate: '2026-03-29',
      editionStatus: 'confirmed',
      raceDiscipline: 'road',
      raceDistanceVariants: [21097.5, 42195],
      raceDistanceUnitVariants: ['meters', 'meters'],
      _geoloc: { lat: 51.05, lng: 3.73 },
    }, '2026-03-29T12:00:00.000Z');

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.name).sort()).toEqual([
      'Ghent Marathon 21.1K',
      'Ghent Marathon 42.2K',
    ]);
    expect(rows.map(row => row.dist).sort()).toEqual([
      'Half Marathon',
      'Marathon',
    ]);
    expect(rows[0].source_site).toBe('');
    expect(rows[0].source_url).toBe('');
    expect(rows[0].registration_url).toBe('');
  });

  test('extractFinishersRacesFromHtml keeps confirmed and rescheduled races including past editions', () => {
    const rows = extractFinishersRacesFromHtml(FINISHERS_HTML, '2026-03-29T12:00:00.000Z');
    expect(rows).toHaveLength(3);
    expect(rows.find(row => row.name === 'Canceled Event')).toBeUndefined();
    expect(rows.find(row => row.name === 'Test Trail')).toMatchObject({
      dist: 'Custom…',
      custom_dist: '17K',
      event_date: '2025-08-18',
      discipline: 'trail-running',
    });
  });

  test('extractTypesenseDocuments returns grouped document rows from Finishers search payloads', () => {
    const docs = extractTypesenseDocuments({
      grouped_hits: [
        { hits: [{ document: { eventName_en: 'Ghent Marathon' } }] },
        { hits: [{ document: { eventName_en: 'Test Trail' } }] },
      ],
    });

    expect(docs).toEqual([
      { eventName_en: 'Ghent Marathon' },
      { eventName_en: 'Test Trail' },
    ]);
  });

  test('extractTotalPages derives full page count from Typesense found metadata', () => {
    expect(extractTotalPages({ found: 9713 }, 18)).toBe(540);
    expect(extractTotalPages({ found: 0 }, 18)).toBe(0);
  });

  test('dedupeRows preserves same-name rows on different edition dates', () => {
    const rows = dedupeRows([
      {
        name: 'Ghent Marathon',
        city: 'Ghent',
        country: 'Belgium',
        event_date: '2026-03-29',
        type: 'run',
        dist: 'Marathon',
        custom_dist: '',
        aliases: ['Ghent Marathon'],
      },
      {
        name: 'Ghent Marathon',
        city: 'Ghent',
        country: 'Belgium',
        event_date: '2027-03-28',
        type: 'run',
        dist: 'Marathon',
        custom_dist: '',
        aliases: ['Ghent Marathon'],
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.event_date)).toEqual(['2026-03-29', '2027-03-28']);
  });
});
