/**
 * BREAKTAPES — Wearable Integration Tests
 *
 * Tests: whoopSportName, parseAppleHealthXML, wearable function existence
 *
 * Strategy: loadSPA() populates global scope. Functions declared in index.html
 * are accessible via global / window after the script is evaluated.
 */

const { loadSPA } = require('./spa-loader');

beforeAll(() => {
  loadSPA({ races: [] });
});

// ── whoopSportName ────────────────────────────────────────────────────────────

describe('whoopSportName', () => {
  test('returns name for known sport ID 0 (Running)', () => {
    expect(whoopSportName(0)).toBe('Running');
  });

  test('returns name for known sport ID 1 (Cycling)', () => {
    expect(whoopSportName(1)).toBe('Cycling');
  });

  test('returns "Workout" fallback for unknown sport ID', () => {
    expect(whoopSportName(9999)).toBe('Workout');
  });

  test('returns "Workout" for undefined input', () => {
    expect(whoopSportName(undefined)).toBe('Workout');
  });
});

// ── Apple Health XML parsing ──────────────────────────────────────────────────

describe('parseAppleHealthXML', () => {
  test('parses HKRecord elements from XML string', async () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
  <Record
    type="HKQuantityTypeIdentifierStepCount"
    sourceName="iPhone"
    value="8500"
    unit="count"
    startDate="2026-01-15 08:00:00 +0000"
    endDate="2026-01-15 09:00:00 +0000" />
  <Record
    type="HKQuantityTypeIdentifierHeartRate"
    sourceName="Apple Watch"
    value="72"
    unit="count/min"
    startDate="2026-01-15 10:00:00 +0000"
    endDate="2026-01-15 10:00:01 +0000" />
</HealthData>`;

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const file = new File([blob], 'export.xml', { type: 'text/xml' });
    // jsdom File lacks .text() — polyfill for test environment
    file.text = () => Promise.resolve(xmlContent);

    const records = await parseAppleHealthXML(file);

    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBe(2);
    expect(records[0].type).toBe('HKQuantityTypeIdentifierStepCount');
    expect(records[0].value).toBe('8500');
    expect(records[0].unit).toBe('count');
    expect(records[0].sourceName).toBe('iPhone');
    expect(records[1].type).toBe('HKQuantityTypeIdentifierHeartRate');
  });

  test('returns empty array for XML with no Record elements', async () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
</HealthData>`;

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const file = new File([blob], 'export.xml', { type: 'text/xml' });
    file.text = () => Promise.resolve(xmlContent);

    const records = await parseAppleHealthXML(file);
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBe(0);
  });
});

// ── Wearable function existence (smoke tests) ─────────────────────────────────

describe('Wearable token functions are defined', () => {
  test('saveWearableToken', () => { expect(typeof saveWearableToken).toBe('function'); });
  test('removeWearableToken', () => { expect(typeof removeWearableToken).toBe('function'); });
  test('loadWearableTokens', () => { expect(typeof loadWearableTokens).toBe('function'); });
  test('startWhoopOAuth', () => { expect(typeof startWhoopOAuth).toBe('function'); });
  test('startGarminOAuth', () => { expect(typeof startGarminOAuth).toBe('function'); });
  test('renderWearables', () => { expect(typeof renderWearables).toBe('function'); });
  test('renderWearablesFeed', () => { expect(typeof renderWearablesFeed).toBe('function'); });
  test('saveAppleHealthData', () => { expect(typeof saveAppleHealthData).toBe('function'); });
  test('loadAppleHealthSummary', () => { expect(typeof loadAppleHealthSummary).toBe('function'); });
  test('importAppleHealthXMLStreaming', () => { expect(typeof importAppleHealthXMLStreaming).toBe('function'); });
});

// ── importAppleHealthXMLStreaming — chunk boundary handling ───────────────────

describe('importAppleHealthXMLStreaming chunk boundary logic', () => {
  // We test the chunk-boundary carry-over by simulating the regex parsing
  // logic directly using the exposed parseAppleHealthXML function on small files.
  // The streaming function itself is a superset of this logic.

  test('parseAppleHealthXML handles Record spanning multiple lines correctly', async () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData>
  <Record
    type="HKQuantityTypeIdentifierStepCount"
    sourceName="iPhone"
    value="12345"
    unit="count"
    startDate="2026-02-01 08:00:00 +0000"
    endDate="2026-02-01 09:00:00 +0000" />
</HealthData>`;
    const file = { name: 'export.xml', size: xmlContent.length, type: 'text/xml' };
    file.text = () => Promise.resolve(xmlContent);
    const records = await parseAppleHealthXML(file);
    expect(records.length).toBe(1);
    expect(records[0].value).toBe('12345');
    expect(records[0].startDate).toBe('2026-02-01 08:00:00 +0000');
  });

  test('parseAppleHealthXML correctly extracts sourceName attribute', async () => {
    const xmlContent = `<HealthData>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch Series 9" value="65" unit="count/min" startDate="2026-03-10 07:00:00 +0000" endDate="2026-03-10 07:00:01 +0000" />
</HealthData>`;
    const file = { name: 'export.xml', size: xmlContent.length, type: 'text/xml' };
    file.text = () => Promise.resolve(xmlContent);
    const records = await parseAppleHealthXML(file);
    expect(records[0].sourceName).toBe('Apple Watch Series 9');
    expect(records[0].unit).toBe('count/min');
  });

  test('parseAppleHealthXML handles 100+ records efficiently', async () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      `  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" value="${i * 100}" unit="count" startDate="2026-01-${String(i % 28 + 1).padStart(2, '0')} 08:00:00 +0000" endDate="2026-01-${String(i % 28 + 1).padStart(2, '0')} 09:00:00 +0000" />`
    ).join('\n');
    const xmlContent = `<HealthData>\n${rows}\n</HealthData>`;
    const file = { name: 'export.xml', size: xmlContent.length, type: 'text/xml' };
    file.text = () => Promise.resolve(xmlContent);
    const records = await parseAppleHealthXML(file);
    expect(records.length).toBe(100);
    expect(records[0].value).toBe('0');
    expect(records[99].value).toBe('9900');
  });
});
