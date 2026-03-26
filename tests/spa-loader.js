/**
 * SPA Loader — reads index.html, extracts the inline <script> block
 * (lines 4103-9919), and evaluates it in the current jsdom context.
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
  // There are exactly two script tags: two CDN scripts + one inline app script.
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
  // Includes elements referenced by updateAuthUI, initAuth, and render guards.
  document.body.innerHTML = `
    <div id="landing-screen"   style="display:none"></div>
    <div id="page-dashboard"   class="page active"></div>
    <div id="page-history"     class="page"></div>
    <div id="page-medals"      class="page"></div>
    <div id="page-map"         class="page"></div>
    <div id="page-athlete"     class="page"></div>
    <div id="page-train"       class="page"></div>
    <div id="page-pace"        class="page"></div>
    <div id="sMenu"></div>
    <div id="mOverlay"></div>
    <button id="hbtn"></button>

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
    <div id="prStrip"></div>
    <div id="beChart"></div>

    <!-- athlete page -->
    <div id="athName"></div>
    <div id="athSub"></div>
    <div id="athPBs"></div>
    <div id="athAgeGradeChart"></div>
    <div id="athStats"></div>

    <!-- train page -->
    <div id="trainingFeed"></div>
    <div id="stravaStreakHeader"></div>

    <!-- map page -->
    <div id="map" style="height:400px"></div>
    <div id="mapStats"></div>
  `;

  // Eval the SPA script in global (window) scope.
  // Function declarations become window properties; `let` vars stay in eval scope
  // but are accessible via closure from the function declarations.
  // eslint-disable-next-line no-eval
  (0, eval)(extractScript());

  // initApp() was just called (last line of the script). It's async — it awaits
  // initAuth() before running DOM-heavy init helpers. Override those helpers NOW
  // (before the auth promise resolves) so they're no-ops in the test environment.
  global.initAllLocationPickers = () => {};
  global.initRaceNamePicker     = () => {};
  global.initModalSwipe         = () => {};
  global.handleStravaCallback   = () => {};
  global.applyEnvRestrictions   = () => {};
  global.dismissLanding         = () => {};

  // go() calls render() at the end, which calls updateMenuFooter() and then
  // page-specific render functions that assume a fully built DOM.  Override
  // render() to a no-op so navigation tests can assert DOM changes made by
  // go() (page activation, scroll, bn-tab) without triggering render crashes.
  global.render = () => {};

  // closeMenu() accesses sMenu/mOverlay — override to no-op as well.
  global.closeMenu = () => {};
}

module.exports = { loadSPA };
