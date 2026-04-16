/**
 * SPA Loader — reads index.html, extracts the inline <script> block
 * and evaluates it in the current jsdom context.
 *
 * IMPORTANT: Call loadSPA() in a beforeAll block ONCE per test file.
 * Re-calling it will throw because `let races` can't be redeclared.
 *
 * Usage:
 *   const { loadSPA } = require('./spa-loader');
 *   beforeAll(() => loadSPA({ races: [...], athlete: {...} }));
 */

const fs   = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '../index.html');

let _scriptCache = null;

function extractScript() {
  if (_scriptCache) return _scriptCache;
  const html = fs.readFileSync(HTML_PATH, 'utf-8');
  // Match the ONE big inline script (no src attribute), grab its content.
  const re = /<script(?!\s+src)[^>]*>([\s\S]*?)<\/script>/gi;
  let best = '';
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].length > best.length) best = m[1];
  }
  _scriptCache = best;
  return _scriptCache;
}

/**
 * Seed localStorage and eval the SPA script in the current jsdom window.
 *
 * @param {object} opts
 * @param {Array}   opts.races           – replaces fl2_races
 * @param {object}  opts.athlete         – replaces fl2_ath
 * @param {object}  opts.nextRace        – replaces fl2_nr
 * @param {Array}   opts.stravaActivities– replaces fl2_strava_acts
 * @param {object}  opts.stravaData      – replaces fl2_strava
 */
function loadSPA({
  races            = null,
  athlete          = null,
  nextRace         = null,
  stravaActivities = [],
  stravaData       = null,
} = {}) {
  // Clear previous state
  localStorage.clear();

  // Seed test data
  if (races)            localStorage.setItem('fl2_races',      JSON.stringify(races));
  if (athlete)          localStorage.setItem('fl2_ath',        JSON.stringify(athlete));
  if (nextRace)         localStorage.setItem('fl2_nr',         JSON.stringify(nextRace));
  if (stravaData)       localStorage.setItem('fl2_strava',     JSON.stringify(stravaData));
  if (stravaActivities.length)
                        localStorage.setItem('fl2_strava_acts',JSON.stringify(stravaActivities));

  // Build a minimal DOM so the SPA doesn't throw on missing elements.
  // 6-page structure: dashboard, races, flatlay, train, you, settings
  document.body.innerHTML = `
    <div id="landing-screen"   style="display:none"></div>
    <div id="page-dashboard"   class="page active">
      <div id="homePanel-dash"></div>
      <div id="homePanel-pace" style="display:none"></div>
    </div>
    <div id="page-races"       class="page">
      <div id="racesPanel-map"></div>
      <div class="races-sheet" id="racesSheet">
        <div id="racesYearTabs"></div>
        <div id="hs-r"></div><div id="hs-c"></div><div id="hs-k"></div><div id="hs-m"></div>
        <div id="raceSheetList"></div>
      </div>
      <!-- compat -->
      <div id="prStrip" style="display:none"></div>
      <div id="beChart" style="display:none"></div>
      <div id="matchedRaces" style="display:none"></div>
      <div id="histList" style="display:none"></div>
      <div id="histMatchCount" style="display:none"></div>
      <button id="histLoadMore" style="display:none"></button>
      <input id="histSearch" style="display:none">
      <button id="histClearBtn" style="display:none"></button>
      <div id="ws-r" style="display:none"></div>
      <div id="ws-c" style="display:none"></div>
      <div id="ws-s" style="display:none"></div>
      <div id="ws-y" style="display:none"></div>
      <div id="wishlistList" style="display:none"></div>
    </div>
    <div id="page-flatlay"     class="page"></div>
    <div id="page-train"       class="page"></div>
    <div id="page-you"         class="page">
      <div id="youPanel-profile"></div>
      <div id="youPanel-medals" style="display:none"></div>
    </div>
    <div id="page-settings"    class="page"></div>

    <!-- bottom nav -->
    <button id="bn-dashboard" class="bn-tab active"></button>
    <button id="bn-races"     class="bn-tab"></button>
    <button id="bn-flatlay"   class="bn-tab"></button>
    <button id="bn-train"     class="bn-tab"></button>
    <button id="bn-you"       class="bn-tab"></button>

    <!-- page title bar (mobile) -->
    <div id="pageTitleBar"></div>

    <!-- auth UI elements referenced by updateAuthUI() -->
    <span  id="authMenuLabel"></span>
    <div   id="authSection"></div>
    <div   id="userSection"       style="display:none"></div>
    <span  id="userEmail"></span>
    <div   id="feedbackPill"      style="display:none"></div>
    <div   id="stagingBanner"     style="display:none"></div>
    <div   id="onboardBanner"     style="display:none"></div>
    <div   id="onboardProgress"></div>
    <div   id="onboardMsg"></div>
    <button id="onboardCta"></button>

    <!-- dashboard widgets (render guards check for null but having them avoids noise) -->
    <div id="dash-widget-greeting"></div>
    <div id="dash-widget-countdown"></div>
    <div id="dash-widget-stats"></div>
    <div id="dash-widget-goals"></div>
    <div id="dash-widget-insights"></div>
    <div id="dash-widget-achievements"></div>
    <div id="dash-widget-world"></div>
    <div id="dash-widget-on-this-day"></div>
    <div id="dash-widget-field-placing"></div>
    <div id="dash-widget-activity-preview"></div>
    <div id="dash-widget-training-streak"></div>
    <div id="dash-widget-pacing-iq"></div>
    <div id="dash-widget-momentum"></div>
    <div id="dash-widget-race-forecast"></div>
    <div id="dash-widget-age-grade"></div>
    <div id="dash-widget-race-dna"></div>
    <div id="dashCustomize"></div>
    <div id="dashLayout"></div>
    <div id="greetingContent"></div>
    <div id="countdownContent"></div>
    <div id="raceForecastStrip" style="display:none"><div id="raceForecastContent"></div></div>
    <div id="fieldPlacingContent"></div>
    <div id="onThisDayContent"></div>
    <div id="activityPreviewFeed"></div>
    <div id="streakWidgetContent"></div>
    <div id="pacingIQContent"></div>
    <div id="momentumWidgetContent"></div>
    <div id="ageGradeWidgetContent"></div>
    <div id="raceDNAContent"></div>
    <div id="dashAchievementsSummary"></div>
    <div id="prStrip"></div>
    <div id="beChart"></div>
    <div id="mwAchievements"></div>
    <div id="medalGrid"></div>

    <!-- athlete / you page -->
    <div id="athName"></div>
    <div id="athSub"></div>
    <div id="athPBs"></div>
    <div id="athAgeGradeChart"></div>
    <div id="athStats"></div>

    <!-- train page -->
    <div id="trainingFeed"></div>
    <div id="stravaStreakHeader"></div>

    <!-- map panel -->
    <div id="map" style="height:400px"></div>
    <div id="mapStats"></div>
  `;

  // Eval the SPA script in global (window) scope.
  // eslint-disable-next-line no-eval
  (0, eval)(extractScript());

  // initApp() was just called (last line of the script). It's async — it awaits
  // initAuth() before running DOM-heavy init helpers. Override those helpers NOW
  // (before the auth promise resolves) so they're no-ops in the test environment.
  global.initAllLocationPickers = () => {};
  global.initRaceNamePicker     = () => {};
  global.initUpcomingRacePicker = () => {};
  global.initModalSwipe         = () => {};
  global.handleStravaCallback   = () => {};
  global.applyEnvRestrictions   = () => {};
  global.dismissLanding         = () => {};

  // go() calls render() at the end, which calls page-specific render functions
  // that assume a fully built DOM. Override render() to a no-op so navigation
  // tests can assert DOM changes (page activation, scroll, bn-tab) cleanly.
  global.render = () => {};

  // closeMenu() may be referenced by legacy code — keep as no-op.
  global.closeMenu = () => {};
}

module.exports = { loadSPA };
