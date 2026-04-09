/**
 * BREAKTAPES — Athlete Briefing Card Tests
 *
 * Tests renderAthleteBriefing() for all 4 states:
 *   State 1: New user (RACES empty)
 *   State 2: Pre-race (upcoming race exists)
 *   State 3: Post-race (most recent past race within 7 days, no upcoming)
 *   State 4: No race (past races exist, none within 7 days, no upcoming)
 *
 * Strategy: loadSPA() is called in a beforeAll within each describe block.
 * Each call resets the SPA eval scope and global function declarations.
 * The #athleteBriefing div is injected into the DOM after each load.
 */

const { loadSPA } = require('./spa-loader');

const fmt = (d) => d.toISOString().slice(0, 10);

function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmt(d);
}

// Helper: always inject a fresh #athleteBriefing div, call the function, return innerHTML
function getRenderedHTML() {
  let el = document.getElementById('athleteBriefing');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'athleteBriefing';
  document.body.appendChild(el);
  global.renderAthleteBriefing();
  return document.getElementById('athleteBriefing').innerHTML;
}

// Fixture races
const PAST_RACE = {
  id: 'r1',
  name: 'Berlin Marathon 2023',
  date: daysFromToday(-60),
  distance: 'Marathon',
  time: '3:45:00',
  placing: '45/1200',
  city: 'Berlin',
  country: 'Germany',
};

const RECENT_RACE = {
  id: 'r2',
  name: 'Paris Marathon 2026',
  date: daysFromToday(-3),
  distance: 'Marathon',
  time: '3:15:22',
  placing: '450/40000',
  city: 'Paris',
  country: 'France',
};

// nextRace format (fl2_nr) — what the SPA uses for upcoming race display
const NEXT_RACE = {
  name: 'Boston Marathon 2026',
  date: daysFromToday(30),
  distance: 'Marathon',
  city: 'Boston',
  country: 'USA',
};

// ── State 1: New User ──────────────────────────────────────────────────────────

describe('renderAthleteBriefing — State 1: new user (empty races)', () => {
  beforeAll(() => loadSPA({ races: [] }));

  it('shows Welcome state', () => {
    const html = getRenderedHTML();
    expect(html).toContain('👋');
    expect(html).toContain('Your Story Starts Here');
    expect(html).toContain('Add your first race');
  });

  it('shows Add First Race CTA', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Add First Race');
    expect(html).toContain('openRaceModal');
  });

  it('does not show No Upcoming Race state', () => {
    const html = getRenderedHTML();
    expect(html).not.toContain('No Upcoming Race');
  });
});

// ── State 2: Pre-Race ─────────────────────────────────────────────────────────

describe('renderAthleteBriefing — State 2: pre-race (upcoming race exists)', () => {
  beforeAll(() => loadSPA({ races: [PAST_RACE], nextRace: NEXT_RACE }));

  it('shows Pre-Race state label', () => {
    const html = getRenderedHTML();
    expect(html).toContain('📍');
    expect(html).toContain('Pre-Race');
  });

  it('displays the race name with days countdown', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Boston Marathon');
    expect(html).toMatch(/in \d+ days/);
  });

  it('shows last result pill with time when past races exist', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Last:');
    expect(html).toContain('3:45:00');
  });

  it('does not show Add Next Race CTA (not needed pre-race)', () => {
    const html = getRenderedHTML();
    expect(html).not.toContain('Add Next Race');
  });
});

describe('renderAthleteBriefing — State 2: pre-race with no past races', () => {
  beforeAll(() => loadSPA({ races: [], nextRace: NEXT_RACE }));

  it('shows Pre-Race state without last result pill', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Pre-Race');
    expect(html).toContain('Boston Marathon');
    expect(html).not.toContain('Last:');
  });
});

// ── State 3: Post-Race ────────────────────────────────────────────────────────

describe('renderAthleteBriefing — State 3: post-race (within 7 days, no upcoming)', () => {
  beforeAll(() => loadSPA({ races: [PAST_RACE, RECENT_RACE] }));

  it('shows Just Finished state label', () => {
    const html = getRenderedHTML();
    expect(html).toContain('🏁');
    expect(html).toContain('Just Finished');
  });

  it('displays the recent race name with year stripped', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Paris Marathon');
    // Year stripped from hero
    expect(html).not.toMatch(/Paris Marathon 2026/);
  });

  it('shows race time and placing in a result pill', () => {
    const html = getRenderedHTML();
    expect(html).toContain('3:15:22');
    expect(html).toContain('450/40000');
  });

  it('shows Add Next Race CTA', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Add Next Race');
  });
});

describe('renderAthleteBriefing — State 3: post-race without time field', () => {
  beforeAll(() => {
    const noTime = { ...RECENT_RACE, time: undefined };
    loadSPA({ races: [PAST_RACE, noTime] });
  });

  it('shows Just Finished state gracefully without time', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Just Finished');
    expect(html).not.toContain('undefined');
  });
});

// ── State 4: No Upcoming Race ─────────────────────────────────────────────────

describe('renderAthleteBriefing — State 4: no upcoming, last race > 7 days ago', () => {
  beforeAll(() => loadSPA({ races: [PAST_RACE] }));

  it('shows No Upcoming Race state', () => {
    const html = getRenderedHTML();
    expect(html).toContain('🎯');
    expect(html).toContain('No Upcoming Race');
  });

  it('shows last race name in sub line', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Berlin Marathon');
  });

  it('shows Add Next Race CTA', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Add Next Race');
    expect(html).toContain('openRaceModal');
  });
});

// ── State Detection Precedence ────────────────────────────────────────────────

describe('renderAthleteBriefing — state precedence', () => {
  beforeAll(() => loadSPA({ races: [PAST_RACE, RECENT_RACE], nextRace: NEXT_RACE }));

  it('pre-race takes priority over post-race when both exist', () => {
    const html = getRenderedHTML();
    expect(html).toContain('Pre-Race');
    expect(html).not.toContain('Just Finished');
  });
});
