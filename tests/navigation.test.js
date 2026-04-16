/**
 * BREAKTAPES — Navigation Tests
 *
 * Tests the go() function behaviour:
 *  • Scroll resets to top on every page change
 *  • Active page class switches correctly
 *  • Active bottom-nav tab switches correctly
 *  • Legacy page aliases (history/map/wishlist → races, athlete/medals → you, pace → dashboard)
 */

const { loadSPA } = require('./spa-loader');

beforeAll(() => {
  loadSPA({ races: [] });
});

beforeEach(() => {
  window.scrollTo.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Scroll-to-top behaviour
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — scroll-to-top', () => {
  test('calls window.scrollTo(0, 0) when navigating to races', () => {
    go('races');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('calls window.scrollTo(0, 0) on every page navigation', () => {
    const pages = ['dashboard', 'races', 'flatlay', 'train', 'you'];
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
  test('activates the correct page element (races)', () => {
    go('races');
    expect(document.getElementById('page-races').classList.contains('active')).toBe(true);
  });

  test('deactivates all other page elements', () => {
    go('you');
    const activePages = document.querySelectorAll('.page.active');
    expect(activePages.length).toBe(1);
    expect(activePages[0].id).toBe('page-you');
  });

  test('switches active page from dashboard to you', () => {
    go('dashboard');
    expect(document.getElementById('page-dashboard').classList.contains('active')).toBe(true);

    go('you');
    expect(document.getElementById('page-you').classList.contains('active')).toBe(true);
    expect(document.getElementById('page-dashboard').classList.contains('active')).toBe(false);
  });

  test('activates the flatlay page element', () => {
    go('flatlay');
    expect(document.getElementById('page-flatlay').classList.contains('active')).toBe(true);
  });

  test('activates the settings page element', () => {
    go('settings');
    expect(document.getElementById('page-settings').classList.contains('active')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy page aliases
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — legacy aliases', () => {
  test('"pace" alias activates page-dashboard', () => {
    go('pace');
    expect(document.getElementById('page-dashboard').classList.contains('active')).toBe(true);
  });

  test('"history" alias activates page-races', () => {
    go('history');
    expect(document.getElementById('page-races').classList.contains('active')).toBe(true);
  });

  test('"map" alias activates page-races', () => {
    go('map');
    expect(document.getElementById('page-races').classList.contains('active')).toBe(true);
  });

  test('"wishlist" alias activates page-races', () => {
    go('wishlist');
    expect(document.getElementById('page-races').classList.contains('active')).toBe(true);
  });

  test('"athlete" alias activates page-you', () => {
    go('athlete');
    expect(document.getElementById('page-you').classList.contains('active')).toBe(true);
  });

  test('"medals" alias activates page-you', () => {
    go('medals');
    expect(document.getElementById('page-you').classList.contains('active')).toBe(true);
  });

  test('"training" alias activates page-train', () => {
    go('training');
    expect(document.getElementById('page-train').classList.contains('active')).toBe(true);
  });

  test('alias still scrolls to top', () => {
    window.scrollTo.mockClear();
    go('history');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bottom-nav active state
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — bottom-nav active state', () => {
  test('activates bn-races when navigating to races', () => {
    go('races');
    expect(document.getElementById('bn-races').classList.contains('active')).toBe(true);
  });

  test('activates bn-flatlay when navigating to flatlay', () => {
    go('flatlay');
    expect(document.getElementById('bn-flatlay').classList.contains('active')).toBe(true);
  });

  test('activates bn-you when navigating to you', () => {
    go('you');
    expect(document.getElementById('bn-you').classList.contains('active')).toBe(true);
  });

  test('activates bn-train when navigating to train', () => {
    go('train');
    expect(document.getElementById('bn-train').classList.contains('active')).toBe(true);
  });

  test('activates bn-dashboard when navigating to dashboard', () => {
    go('dashboard');
    expect(document.getElementById('bn-dashboard').classList.contains('active')).toBe(true);
  });

  test('removes active from all other bn-tab buttons', () => {
    go('you');
    const activeTabs = document.querySelectorAll('.bn-tab.active');
    expect(activeTabs.length).toBe(1);
    expect(activeTabs[0].id).toBe('bn-you');
  });

  test('settings page does not activate any bottom nav tab', () => {
    go('settings');
    const activeTabs = document.querySelectorAll('.bn-tab.active');
    expect(activeTabs.length).toBe(0);
  });

  test('"history" alias activates bn-races', () => {
    go('history');
    expect(document.getElementById('bn-races').classList.contains('active')).toBe(true);
  });

  test('"athlete" alias activates bn-you', () => {
    go('athlete');
    expect(document.getElementById('bn-you').classList.contains('active')).toBe(true);
  });

  test('"pace" alias activates bn-dashboard', () => {
    go('pace');
    expect(document.getElementById('bn-dashboard').classList.contains('active')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _pageNames map (pageTitleBar)
// ─────────────────────────────────────────────────────────────────────────────
describe('go() — pageTitleBar', () => {
  const cases = [
    ['dashboard', 'Home'],
    ['races',     'Races'],
    ['flatlay',   'Gear'],
    ['train',     'Train'],
    ['you',       'You'],
    ['settings',  'Settings'],
  ];
  test.each(cases)('go(%s) sets pageTitleBar to "%s"', (page, expected) => {
    go(page);
    expect(document.getElementById('pageTitleBar').textContent).toBe(expected);
  });
});
