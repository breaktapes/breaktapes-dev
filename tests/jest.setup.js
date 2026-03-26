/**
 * BREAKTAPES Jest Global Setup
 *
 * Stubs out external CDN libraries (Supabase, Leaflet) so the SPA script
 * can be eval'd in jsdom without network requests.  Each test file calls
 * loadSPA() from spa-loader.js which seeds localStorage and evals the script.
 */

// ── Supabase stub ─────────────────────────────────────────────────────────────
const makeSupabaseMock = () => {
  const chain = {
    select:  () => chain,
    insert:  () => chain,
    update:  () => chain,
    upsert:  () => chain,
    delete:  () => chain,
    eq:      () => chain,
    neq:     () => chain,
    gt:      () => chain,
    lt:      () => chain,
    gte:     () => chain,
    lte:     () => chain,
    order:   () => chain,
    limit:   () => chain,
    range:   () => chain,
    match:   () => chain,
    filter:  () => chain,
    not:     () => chain,
    or:      () => chain,
    ilike:   () => chain,
    single:  async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then:    (fn) => Promise.resolve({ data: [], error: null }).then(fn),
  };
  return {
    auth: {
      onAuthStateChange: (cb) => {
        // Call callback asynchronously with a null session
        setTimeout(() => cb('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession:          async () => ({ data: { session: null }, error: null }),
      signInWithPassword:  async () => ({ data: { user: null, session: null }, error: null }),
      signUp:              async () => ({ data: { user: null, session: null }, error: null }),
      signOut:             async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
    },
    from: () => chain,
  };
};

global.supabase = { createClient: () => makeSupabaseMock() };

// ── Leaflet stub ──────────────────────────────────────────────────────────────
const mapObj = {
  setView:    function() { return this; },
  addLayer:   function() { return this; },
  removeLayer:function() { return this; },
  fitBounds:  function() { return this; },
  on:         function() { return this; },
  off:        function() { return this; },
  remove:     function() { return this; },
  getZoom:    () => 5,
};
const layerObj = { addTo: () => layerObj, remove: () => {} };

global.L = {
  map:             () => mapObj,
  tileLayer:       () => layerObj,
  layerGroup:      () => ({ ...layerObj, addLayer: () => {}, clearLayers: () => {} }),
  circleMarker:    () => ({ ...layerObj, on: () => layerObj }),
  polyline:        () => layerObj,
  divIcon:         () => ({}),
  marker:          () => ({ ...layerObj, on: () => layerObj, setIcon: () => {} }),
  latLngBounds:    () => ({ extend: () => ({}) }),
  latLng:          () => ({}),
  geoJSON:         () => layerObj,
  control:         { scale: () => ({ addTo: () => {} }) },
};

// ── fetch stub ────────────────────────────────────────────────────────────────
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// ── geolocation stub ──────────────────────────────────────────────────────────
global.navigator.geolocation = {
  getCurrentPosition: jest.fn(),
};

// ── scrollTo stub (jsdom doesn't implement it) ────────────────────────────────
global.scrollTo = jest.fn();
window.scrollTo = jest.fn();

// ── Safe document.getElementById ─────────────────────────────────────────────
// The SPA has many async callbacks (auth state changes, Supabase responses) that
// fire after a test has already replaced the DOM.  Wrap getElementById so that
// accessing .innerHTML / .textContent / .classList on a missing element never
// throws — returning a safe inert element instead of null.
const _origGetById = document.getElementById.bind(document);
document.getElementById = (id) => {
  const el = _origGetById(id);
  if (el) return el;
  // Return a minimal inert element proxy so property-set calls are no-ops
  const dummy = document.createElement('div');
  dummy.__dummy = true;
  return dummy;
};
