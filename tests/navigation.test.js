/**
 * BREAKTAPES — Navigation Tests
 *
 * Tests the go() function behaviour:
 *  • Scroll resets to top on every page change
 *  • Active page class switches correctly
 *  • Active bottom-nav tab switches correctly
 *  • Page aliases (pace → train, training → train)
 */

const { loadSPA } = require('./spa-loader');

beforeAll(() => {
  // Add the bottom-nav buttons and extra page elements go() needs
  loadSPA({ races: [] });

  // Bottom-nav tabs (go() does getElementById('bn-' + page))
  ['dashboard', 'history', 'flatlay', 'medals', 'map', 'athlete', 'train', 'pace'].forEach(id => {
    const btn = document.createElement('button');
    btn.id = 'bn-' + id;
    btn.className = 'bn-tab active';  // start all active to test toggling
    document.body.appendChild(btn);
  });
});

beforeEach(() => {
  // Reset scrollTo mock so each test gets a clean call count
  window.scrollTo.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Scroll-to-top behaviour
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — scroll-to-top', () => {
  test('calls window.scrollTo(0, 0) when navigating to history', () => {
    go('history');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('calls window.scrollTo(0, 0) on every page navigation', () => {
    const pages = ['dashboard', 'history', 'medals', 'athlete'];
    pages.forEach(page => {
      window.scrollTo.mockClear();
      go(page);
      expect(window.scrollTo).toHaveBeenCalledTimes(1);
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });

  test('scrolls to top even when navigating to same page twice', () => {
    go('dashboard');
    window.scrollTo.mockClear();
    go('dashboard');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Active page switching
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — active page class', () => {
  test('activates the correct page element', () => {
    go('history');
    expect(document.getElementById('page-history').classList.contains('active')).toBe(true);
  });

  test('deactivates all other page elements', () => {
    go('medals');
    const allPages = document.querySelectorAll('.page');
    const activePages = document.querySelectorAll('.page.active');
    expect(activePages.length).toBe(1);
    expect(activePages[0].id).toBe('page-medals');
  });

  test('switches active page from dashboard to athlete', () => {
    go('dashboard');
    expect(document.getElementById('page-dashboard').classList.contains('active')).toBe(true);

    go('athlete');
    expect(document.getElementById('page-athlete').classList.contains('active')).toBe(true);
    expect(document.getElementById('page-dashboard').classList.contains('active')).toBe(false);
  });

  test('activates the flatlay page element', () => {
    go('flatlay');
    expect(document.getElementById('page-flatlay').classList.contains('active')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Page aliases
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — page aliases', () => {
  test('"pace" alias activates page-train', () => {
    go('pace');
    expect(document.getElementById('page-train').classList.contains('active')).toBe(true);
  });

  test('"training" alias activates page-train', () => {
    go('training');
    expect(document.getElementById('page-train').classList.contains('active')).toBe(true);
  });

  test('"pace" alias still scrolls to top', () => {
    window.scrollTo.mockClear();
    go('pace');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bottom-nav active state
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — bottom-nav active state', () => {
  test('activates the correct bn-tab button', () => {
    go('history');
    expect(document.getElementById('bn-history').classList.contains('active')).toBe(true);
  });

  test('activates the flatlay bottom-nav button', () => {
    go('flatlay');
    expect(document.getElementById('bn-flatlay').classList.contains('active')).toBe(true);
  });

  test('removes active from all other bn-tab buttons', () => {
    go('medals');
    const activeTabs = document.querySelectorAll('.bn-tab.active');
    // Only bn-medals should be active
    expect(activeTabs.length).toBe(1);
    expect(activeTabs[0].id).toBe('bn-medals');
  });
});
