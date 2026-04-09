/**
 * BREAKTAPES — Dashboard Layout Helpers Tests
 *
 * Covers:
 *   - getDashZoneCollapse(): default state + saved state from localStorage
 *   - saveDashZoneCollapse(): writes to fl2_dash_zone_collapse
 *   - getDashLayout() migration v2: forces countdown.enabled = false on first run
 *   - getDashLayout() idempotency: migration skipped after fl2_dash_migration_v2 flag set
 */

const { loadSPA } = require('./spa-loader');

// ── Zone Collapse Helpers ─────────────────────────────────────────────────────

describe('getDashZoneCollapse — default state (no localStorage)', () => {
  beforeAll(() => loadSPA({ races: [] }));

  it('returns defaults when nothing saved', () => {
    localStorage.removeItem('fl2_dash_zone_collapse');
    const state = global.getDashZoneCollapse();
    expect(state).toEqual({
      priority: false,
      performance: false,
      training: true,
      insights: true,
    });
  });

  it('priority (NOW) zone is expanded by default', () => {
    localStorage.removeItem('fl2_dash_zone_collapse');
    const state = global.getDashZoneCollapse();
    expect(state.priority).toBe(false);
  });

  it('training (TRENDING) zone is collapsed by default', () => {
    localStorage.removeItem('fl2_dash_zone_collapse');
    const state = global.getDashZoneCollapse();
    expect(state.training).toBe(true);
  });
});

describe('getDashZoneCollapse — saved state', () => {
  beforeAll(() => loadSPA({ races: [] }));

  it('returns saved state when fl2_dash_zone_collapse is set', () => {
    const custom = { priority: true, performance: false, training: false, insights: false };
    localStorage.setItem('fl2_dash_zone_collapse', JSON.stringify(custom));
    const state = global.getDashZoneCollapse();
    expect(state).toEqual(custom);
  });

  it('falls back to defaults on invalid JSON', () => {
    localStorage.setItem('fl2_dash_zone_collapse', 'not-valid-json!!!');
    const state = global.getDashZoneCollapse();
    expect(state).toEqual({
      priority: false,
      performance: false,
      training: true,
      insights: true,
    });
  });
});

describe('saveDashZoneCollapse — persists state', () => {
  beforeAll(() => loadSPA({ races: [] }));

  it('writes state to fl2_dash_zone_collapse', () => {
    const state = { priority: true, performance: true, training: false, insights: false };
    global.saveDashZoneCollapse(state);
    const raw = localStorage.getItem('fl2_dash_zone_collapse');
    expect(JSON.parse(raw)).toEqual(state);
  });

  it('round-trips via getDashZoneCollapse', () => {
    const state = { priority: false, performance: true, training: true, insights: false };
    global.saveDashZoneCollapse(state);
    const loaded = global.getDashZoneCollapse();
    expect(loaded).toEqual(state);
  });
});

// ── getDashLayout migration v2 ─────────────────────────────────────────────

describe('getDashLayout — migration v2: forces countdown disabled', () => {
  beforeAll(() => loadSPA({ races: [] }));

  it('sets fl2_dash_migration_v2 flag on first call', () => {
    localStorage.removeItem('fl2_dash_migration_v2');
    global.getDashLayout();
    expect(localStorage.getItem('fl2_dash_migration_v2')).toBe('1');
  });

  it('disables countdown widget when pre-existing layout has it enabled', () => {
    localStorage.removeItem('fl2_dash_migration_v2');
    // Simulate an old saved layout with countdown enabled
    const oldLayout = [
      { id: 'countdown', enabled: true, zone: 'priority' },
      { id: 'stats', enabled: true, zone: 'priority' },
    ];
    localStorage.setItem('fl2_dash_layout', JSON.stringify(oldLayout));
    global.getDashLayout();
    // Migration should have patched the saved layout
    const patched = JSON.parse(localStorage.getItem('fl2_dash_layout'));
    const countdown = patched.find(w => w.id === 'countdown');
    expect(countdown.enabled).toBe(false);
  });

  it('does not run migration again when fl2_dash_migration_v2 is already set', () => {
    localStorage.setItem('fl2_dash_migration_v2', '1');
    // Put countdown back to enabled
    const layout = [
      { id: 'countdown', enabled: true, zone: 'priority' },
    ];
    localStorage.setItem('fl2_dash_layout', JSON.stringify(layout));
    global.getDashLayout();
    // Migration should NOT have run — countdown stays as-is in the saved layout
    const saved = JSON.parse(localStorage.getItem('fl2_dash_layout'));
    const countdown = saved.find(w => w.id === 'countdown');
    // countdown.enabled should still be true (migration skipped)
    expect(countdown.enabled).toBe(true);
  });
});

describe('getDashLayout — returns defaults when no saved layout', () => {
  beforeAll(() => loadSPA({ races: [] }));

  it('returns an array of widget objects', () => {
    localStorage.removeItem('fl2_dash_layout');
    localStorage.setItem('fl2_dash_migration_v2', '1'); // skip migration
    const layout = global.getDashLayout();
    expect(Array.isArray(layout)).toBe(true);
    expect(layout.length).toBeGreaterThan(0);
  });

  it('each widget has id, enabled, and zone fields', () => {
    localStorage.removeItem('fl2_dash_layout');
    localStorage.setItem('fl2_dash_migration_v2', '1');
    const layout = global.getDashLayout();
    layout.forEach(w => {
      expect(w).toHaveProperty('id');
      expect(w).toHaveProperty('enabled');
      expect(w).toHaveProperty('zone');
    });
  });

  it('countdown widget is disabled by default (narrative layout)', () => {
    localStorage.removeItem('fl2_dash_layout');
    localStorage.setItem('fl2_dash_migration_v2', '1');
    const layout = global.getDashLayout();
    const countdown = layout.find(w => w.id === 'countdown');
    // countdown is in DASH_WIDGETS with enabled: false
    expect(countdown).toBeDefined();
    expect(countdown.enabled).toBe(false);
  });
});
