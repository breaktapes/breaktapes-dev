const {
  buildAhotuCuratedRows,
  buildStaticUtmbRows,
  buildRefreshMigration,
  dedupeRows,
  extractDetailUrls,
  extractHyroxEvents,
  extractUtmbEvents,
  normalizeIronmanDistance,
  parseRaceDetail,
} = require('../scripts/ironman-race-catalog');

const LISTING_HTML = `
  <html>
    <body>
      <a href="https://www.ironman.com/races/im703-valencia">See Race Details</a>
      <a href="https://www.ironman.com/races/im-barcelona">See Race Details</a>
      <a href="https://www.ironman.com/races/im703-valencia">Duplicate</a>
      <a href="/races/xclusive-challenge">Ignore me</a>
    </body>
  </html>
`;

const VALENCIA_HTML = `
  <html>
    <head>
      <meta name="description" content="Race IRONMAN 70.3 Valencia with a Mediterranean swim, rolling bike course, and a flat run through Spain’s vibrant city. A fast, scenic, and unforgettable challenge!" />
      <script type="application/ld+json">{
        "name": "IRONMAN 70.3 Valencia",
        "startDate": "2026-04-19T00:00:00+0000",
        "location": {
          "address": {
            "addressRegion": "Valencia",
            "addressCountry": "Spain"
          }
        }
      }</script>
    </head>
    <body>
      <div class="race-hero-content">
        <span class="tag tag--white">Registration Sold Out</span>
      </div>
      <div class="icon-field-item">
        <div class="icon-field-label">Swim</div>
        <div class="icon-field-value"><span>Ocean</span><span>—</span></div>
      </div>
      <div class="icon-field-item">
        <div class="icon-field-label">Bike</div>
        <div class="icon-field-value"><span>Rolling</span><span>—</span></div>
      </div>
      <div class="icon-field-item">
        <div class="icon-field-label">Run</div>
        <div class="icon-field-value"><span>Flat</span><span>—</span></div>
      </div>
      <div class="icon-field-item">
        <div class="icon-field-label">High Air Temp</div>
        <div class="icon-field-value"><span>47 °F / 21 °C</span><span>—</span></div>
      </div>
      <div class="icon-field-item">
        <div class="icon-field-label">Low Air Temp</div>
        <div class="icon-field-value"><span>34 °F / 11 °C</span><span>—</span></div>
      </div>
      <div class="icon-field-item">
        <div class="icon-field-label">Avg. Water Temp</div>
        <div class="icon-field-value"><span>66 °F / 19 °C</span><span>—</span></div>
      </div>
    </body>
  </html>
`;

const HYROX_HTML = `
  <div class="w-vwrapper usg_vwrapper_1 en_subpage-pt_titlebox">
    <h2 class="w-post-elm post_title usg_post_title_1 en_subpage-pt_titlebox entry-title"><a href="https://hyrox.com/event/hyrox-london/">HYROX London</a></h2>
    <span class="w-post-elm post_custom_field usg_post_custom_field_2 type_text event_date_1 color_link_inherit"><span class="w-post-elm-value">3. Apr. 2026</span></span>
    <span class="w-post-elm post_custom_field usg_post_custom_field_3 type_text event_date_3 color_link_inherit"><span class="w-post-elm-before">– </span><span class="w-post-elm-value">5. Apr. 2026</span></span>
  </div>
  <div class="w-vwrapper usg_vwrapper_1 en_subpage-pt_titlebox">
    <h2 class="w-post-elm post_title usg_post_title_1 en_subpage-pt_titlebox entry-title"><a href="https://hyrox.com/event/hyrox-youngstars-london/">HYROX Youngstars London</a></h2>
    <span class="w-post-elm post_custom_field usg_post_custom_field_2 type_text event_date_1 color_link_inherit"><span class="w-post-elm-value">3. Apr. 2026</span></span>
  </div>
`;

const UTMB_HTML = `
  <div>Europe</div>
  <a href="https://istria.utmb.world">09 - 12 April 2026</a>
  <a href="https://montblanc.utmb.world">24 - 30 August 2026</a>
  <div>Oceania</div>
  <a href="https://tarawera.utmb.world">13 - 14 February 2027</a>
`;

describe('upcoming catalog parser', () => {
  test('extractDetailUrls returns unique race URLs from IRONMAN listing pages', () => {
    expect(extractDetailUrls(LISTING_HTML)).toEqual([
      'https://www.ironman.com/races/im-barcelona',
      'https://www.ironman.com/races/im703-valencia',
    ]);
  });

  test('normalizeIronmanDistance maps key triathlon series into app distances', () => {
    expect(normalizeIronmanDistance('IRONMAN', 'IRONMAN South Africa')).toEqual({
      type: 'tri',
      dist: 'Ironman / Full',
      distKm: 226,
      customDist: null,
    });
    expect(normalizeIronmanDistance('IRONMAN 70.3', 'IRONMAN 70.3 Valencia')).toEqual({
      type: 'tri',
      dist: '70.3 / Half Ironman',
      distKm: 113,
      customDist: null,
    });
  });

  test('parseRaceDetail preserves IRONMAN source-page weather and course fields', () => {
    const row = parseRaceDetail(VALENCIA_HTML, {
      sourceUrl: 'https://www.ironman.com/races/im703-valencia',
      sourcePage: 1,
      seenAt: '2026-03-28T00:00:00.000Z',
    });

    expect(row).toMatchObject({
      name: 'IRONMAN 70.3 Valencia',
      type: 'tri',
      discipline: 'triathlon',
      dist: '70.3 / Half Ironman',
      dist_km: 113,
      city: 'Valencia',
      country: 'Spain',
      event_date: '2026-04-19',
      source_site: 'ironman',
      registration_url: 'https://www.ironman.com/races/im703-valencia',
      weather_profile_source: 'source-page',
      air_temp_high_c: 21,
      air_temp_low_c: 11,
      water_temp_c: 19,
    });
    expect(row.course_summary).toContain('Mediterranean swim');
  });

  test('extractHyroxEvents keeps adult HYROX race weekends and excludes Youngstars', () => {
    const rows = extractHyroxEvents(HYROX_HTML);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'HYROX London',
      type: 'hyrox',
      discipline: 'hyrox',
      dist: 'Solo Open',
      city: 'London',
      event_date: '2026-04-03',
      event_end_date: '2026-04-05',
      source_site: 'hyrox',
    });
  });

  test('buildAhotuCuratedRows maps trail races into run type with preserved discipline', () => {
    const rows = buildAhotuCuratedRows([{
      name: 'Trail Sample by UTMB',
      discipline: 'trail-running',
      city: 'Chamonix',
      country: 'France',
      event_date: '2026-08-28',
      series: 'UTMB World Series',
    }]);

    expect(rows[0]).toMatchObject({
      name: 'Trail Sample by UTMB',
      type: 'run',
      discipline: 'trail-running',
      dist: 'Custom…',
      custom_dist: 'Trail Running',
      source_site: 'ahotu',
    });
  });

  test('extractUtmbEvents maps UTMB World Series weekends into trail-running upcoming rows', () => {
    const rows = extractUtmbEvents(UTMB_HTML, '2026-03-28');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      source_site: 'utmb',
      discipline: 'trail-running',
      type: 'run',
      series: 'UTMB World Series',
      custom_dist: 'Trail Running',
    });
    expect(rows.find(r => r.name === 'Istria 100 by UTMB')).toMatchObject({
      city: 'Labin',
      country: 'Croatia',
      event_date: '2026-04-09',
      event_end_date: '2026-04-12',
    });
    expect(rows.find(r => r.name === 'Tarawera Ultramarathon by UTMB')).toMatchObject({
      city: 'Rotorua',
      country: 'New Zealand',
      event_date: '2027-02-13',
      event_end_date: '2027-02-14',
    });
  });

  test('buildStaticUtmbRows returns future UTMB weekends from the verified schedule only', () => {
    const rows = buildStaticUtmbRows('2026-03-28');
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.find(r => r.name === 'Istria 100 by UTMB')).toMatchObject({
      source_site: 'utmb',
      type: 'run',
      discipline: 'trail-running',
      city: 'Labin',
      country: 'Croatia',
      event_date: '2026-04-09',
      event_end_date: '2026-04-12',
    });
    expect(rows.find(r => r.name === 'Tarawera Ultramarathon by UTMB')).toMatchObject({
      city: 'Rotorua',
      country: 'New Zealand',
      event_date: '2027-02-13',
      event_end_date: '2027-02-14',
    });
    expect(rows.find(r => r.name === 'Tenerife Bluetrail by UTMB')).toBeUndefined();
  });

  test('buildRefreshMigration emits SQL with the new generic columns', () => {
    const sql = buildRefreshMigration([
      parseRaceDetail(VALENCIA_HTML, {
        sourceUrl: 'https://www.ironman.com/races/im703-valencia',
        sourcePage: 1,
        seenAt: '2026-03-28T00:00:00.000Z',
      }),
    ]);

    expect(sql).toContain('discipline');
    expect(sql).toContain('event_end_date');
    expect(sql).toContain('weather_profile_source');
    expect(sql).toContain('registration_url');
    expect(sql).toContain('IRONMAN 70.3 Valencia');
  });

  test('dedupeRows preserves same-name variants when distance differs', () => {
    const rows = dedupeRows([
      {
        name: 'City Marathon Weekend',
        city: 'Example City',
        country: 'Exampleland',
        year: 2026,
        type: 'run',
        dist: 'Marathon',
        custom_dist: '',
        source_priority: 50,
      },
      {
        name: 'City Marathon Weekend',
        city: 'Example City',
        country: 'Exampleland',
        year: 2026,
        type: 'run',
        dist: 'Half Marathon',
        custom_dist: '',
        source_priority: 50,
      },
      {
        name: 'City Marathon Weekend',
        city: 'Example City',
        country: 'Exampleland',
        year: 2026,
        type: 'run',
        dist: 'Custom…',
        custom_dist: '10KM',
        source_priority: 50,
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => `${row.dist}:${row.custom_dist || ''}`).sort()).toEqual([
      'Custom…:10KM',
      'Half Marathon:',
      'Marathon:',
    ]);
  });
});
