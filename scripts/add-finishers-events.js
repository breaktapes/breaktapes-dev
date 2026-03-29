#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = 'https://www.finishers.com';
const DEFAULT_BASE_PATH = '/en/events';
const DEFAULT_OUTPUT = path.resolve(process.cwd(), 'scripts/generated-finishers-events.json');
const DEFAULT_START_PAGE = 1;
const DEFAULT_END_PAGE = 5;
const DEFAULT_PER_PAGE = 250;
const TYPESENSE_HOST = 'https://vn2qtcjsbg0ea481p.a1.typesense.net';
const TYPESENSE_API_KEY = 'G1BPjGr3KDU7n6yylcfOREpRVGUBpKYW';

function parseArgs(argv) {
  const args = {
    basePath: DEFAULT_BASE_PATH,
    startPage: DEFAULT_START_PAGE,
    endPage: DEFAULT_END_PAGE,
    perPage: DEFAULT_PER_PAGE,
    htmlDir: '',
    outputJson: DEFAULT_OUTPUT,
    seenAt: new Date().toISOString(),
    allPages: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-path') args.basePath = argv[++i];
    else if (arg === '--start-page') args.startPage = Number(argv[++i] || DEFAULT_START_PAGE);
    else if (arg === '--end-page') args.endPage = Number(argv[++i] || DEFAULT_END_PAGE);
    else if (arg === '--per-page') args.perPage = Number(argv[++i] || DEFAULT_PER_PAGE);
    else if (arg === '--html-dir') args.htmlDir = path.resolve(process.cwd(), argv[++i]);
    else if (arg === '--output-json') args.outputJson = path.resolve(process.cwd(), argv[++i]);
    else if (arg === '--seen-at') args.seenAt = argv[++i];
    else if (arg === '--all-pages') args.allPages = true;
  }
  return args;
}

function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function stripDiacritics(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(value = '') {
  return stripDiacritics(String(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function capitalizeLeadingLetter(value = '') {
  const str = String(value);
  return str.replace(/^[a-z]/, match => match.toUpperCase());
}

function formatExactDistanceLabel(distKm) {
  if (distKm === null || distKm === undefined || Number.isNaN(Number(distKm))) return '';
  const rounded = Math.round(Number(distKm) * 10) / 10;
  return `${rounded}K`;
}

function fetchText(url) {
  return execFileSync('curl', ['-L', '--max-time', '20', '-A', 'Mozilla/5.0', '-s', url], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function fetchJson(url, headers = {}) {
  const args = ['-L', '--max-time', '20', '-s', url];
  Object.entries(headers).forEach(([key, value]) => {
    args.push('-H', `${key}: ${value}`);
  });
  const response = execFileSync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(response);
}

function extractNextData(html) {
  const match = String(html).match(/<script[^>]*id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('Finishers page missing __NEXT_DATA__ payload');
  return JSON.parse(match[1]);
}

function dedupePrimitiveList(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function toIsoDate(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function mapDiscipline(meta = {}) {
  const raw = String(meta.raceDiscipline || '').toLowerCase();
  if (raw === 'trail') return { type: 'run', discipline: 'trail-running', surface: 'Trail' };
  if (raw === 'road' || raw === 'walking') return { type: 'run', discipline: 'road-running', surface: 'Road' };
  if (raw === 'triathlon') return { type: 'tri', discipline: 'triathlon', surface: '' };
  if (raw === 'cycling') return { type: 'cycle', discipline: 'cycling', surface: 'Road' };
  if (raw === 'swimming') return { type: 'swim', discipline: 'swimming', surface: 'Open Water' };
  return { type: 'run', discipline: 'road-running', surface: '' };
}

function normalizeDistanceVariant(meters, unit) {
  const numeric = Number(meters);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { dist: 'Custom…', distKm: null, customDist: '' };
  }
  const normalizedUnit = String(unit || '').toLowerCase();
  const distKm = normalizedUnit === 'kilometers' ? numeric : numeric / 1000;
  const roundedMeters = Math.round(distKm * 1000);
  if (Math.abs(roundedMeters - 42195) <= 5) return { dist: 'Marathon', distKm: 42.195, customDist: '' };
  if (Math.abs(roundedMeters - 21097) <= 5 || Math.abs(roundedMeters - 21098) <= 5) return { dist: 'Half Marathon', distKm: 21.1, customDist: '' };
  if (roundedMeters === 10000) return { dist: '10KM', distKm: 10, customDist: '' };
  if (roundedMeters === 5000) return { dist: '5KM', distKm: 5, customDist: '' };
  return {
    dist: 'Custom…',
    distKm: Math.round(distKm * 10) / 10,
    customDist: formatExactDistanceLabel(distKm),
  };
}

function variantNameSuffix(distance) {
  return distance.customDist || formatExactDistanceLabel(distance.distKm);
}

function buildVariantName(baseName, distance, forceVariantLabel = false) {
  const suffix = variantNameSuffix(distance);
  if (!suffix || !forceVariantLabel) return baseName;
  if (new RegExp(`${suffix}$`, 'i').test(baseName)) return baseName;
  return `${baseName} ${suffix}`;
}

function buildAliases(baseName, localName, city, country, variantName, customDist) {
  return dedupePrimitiveList([
    baseName,
    localName && localName !== baseName ? localName : '',
    variantName !== baseName ? variantName : '',
    customDist ? `${baseName} ${customDist}` : '',
    city ? `${baseName} ${city}` : '',
    country ? `${baseName} ${country}` : '',
  ]);
}

function uniqueVariants(race) {
  const distances = Array.isArray(race.raceDistanceVariants) && race.raceDistanceVariants.length
    ? race.raceDistanceVariants
    : [race.raceDistance];
  const units = Array.isArray(race.raceDistanceUnitVariants) && race.raceDistanceUnitVariants.length
    ? race.raceDistanceUnitVariants
    : [race.raceDistanceUnit];
  const seen = new Set();
  const variants = [];
  distances.forEach((distance, index) => {
    const unit = units[index] || units[0] || race.raceDistanceUnit;
    const key = `${distance}:${unit}`;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({ distance, unit });
  });
  return variants;
}

function transformFinishersRace(race, seenAt) {
  const status = String(race.editionStatus || race.raceStatus || '').toLowerCase();
  if (!['confirmed', 'rescheduled'].includes(status)) return [];
  const eventDate = toIsoDate(race.editionStartDate);
  if (!eventDate) return [];
  const eventEndDate = toIsoDate(race.editionEndDate || race.editionStartDate) || eventDate;
  const baseName = capitalizeLeadingLetter(normalizeWhitespace(race.eventName_en || race.eventName || ''));
  if (!baseName) return [];
  const localName = capitalizeLeadingLetter(normalizeWhitespace(race.eventName || ''));
  const city = normalizeWhitespace(race.city_en || race.city || '');
  const region = normalizeWhitespace(race.level1_en || race.level1 || '');
  const country = normalizeWhitespace(race.country_en || race.country || '');
  const meta = mapDiscipline(race);
  const year = Number((eventDate || '').slice(0, 4)) || null;
  const month = Number((eventDate || '').slice(5, 7)) || null;
  const day = Number((eventDate || '').slice(8, 10)) || null;
  const courseSummary = normalizeWhitespace(race.raceDescription || '');
  const surface = meta.surface || '';
  const variants = uniqueVariants(race);
  return variants.map(({ distance, unit }) => {
    const normalizedDistance = normalizeDistanceVariant(distance, unit);
    const variantName = buildVariantName(baseName, normalizedDistance, variants.length > 1);
    return {
      name: variantName,
      aliases: buildAliases(baseName, localName, city, country, variantName, normalizedDistance.customDist),
      type: meta.type,
      discipline: meta.discipline,
      dist: normalizedDistance.dist,
      dist_km: normalizedDistance.distKm,
      custom_dist: normalizedDistance.customDist,
      city,
      region,
      country,
      lat: race._geoloc && Number.isFinite(Number(race._geoloc.lat)) ? Number(race._geoloc.lat) : null,
      lng: race._geoloc && Number.isFinite(Number(race._geoloc.lng)) ? Number(race._geoloc.lng) : null,
      year,
      event_date: eventDate,
      event_end_date: eventEndDate,
      month,
      day,
      source_site: '',
      source_url: '',
      registration_url: '',
      series: baseName,
      registration_status: status,
      course_summary: courseSummary,
      surface,
      source_priority: 76,
      source_last_seen_at: seenAt,
    };
  });
}

function extractFinishersRacesFromHtml(html, seenAt) {
  const data = extractNextData(html);
  const races = data?.props?.pageProps?.races;
  if (!Array.isArray(races)) return [];
  return races.flatMap(race => transformFinishersRace(race, seenAt));
}

function extractTypesenseDocuments(payload) {
  if (Array.isArray(payload?.grouped_hits)) {
    return payload.grouped_hits
      .flatMap(group => Array.isArray(group.hits) ? group.hits : [])
      .map(hit => hit.document)
      .filter(Boolean);
  }
  if (Array.isArray(payload?.hits)) {
    return payload.hits.map(hit => hit.document).filter(Boolean);
  }
  return [];
}

function buildTypesenseUrl(page, perPage) {
  const params = new URLSearchParams({
    q: '*',
    query_by: 'eventName',
    sort_by: 'boosted:desc,raceDate:asc',
    group_by: 'eventId',
    group_limit: '1',
    per_page: String(perPage),
    page: String(page),
  });
  return `${TYPESENSE_HOST}/collections/races/documents/search?${params.toString()}`;
}

function fetchFinishersTypesensePayload(page, perPage) {
  return fetchJson(buildTypesenseUrl(page, perPage), {
    'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
  });
}

function extractTotalPages(payload, perPage) {
  const found = Number(payload?.found || 0);
  const pageSize = Number(perPage || DEFAULT_PER_PAGE);
  if (!Number.isFinite(found) || found <= 0) return 0;
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 0;
  return Math.ceil(found / pageSize);
}

function fetchFinishersTypesensePage(page, perPage, seenAt) {
  const payload = fetchFinishersTypesensePayload(page, perPage);
  const docs = extractTypesenseDocuments(payload);
  return docs.flatMap(race => transformFinishersRace(race, seenAt));
}

function dedupeRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = [
      slugify(row.name),
      slugify(row.city),
      slugify(row.country),
      row.event_date || '',
      row.type || '',
      slugify(row.dist || ''),
      slugify(row.custom_dist || ''),
    ].join('::');
    if (!map.has(key)) {
      map.set(key, row);
      return;
    }
    const current = map.get(key);
    const currentAliases = Array.isArray(current.aliases) ? current.aliases : [];
    const nextAliases = Array.isArray(row.aliases) ? row.aliases : [];
    map.set(key, {
      ...current,
      ...row,
      aliases: dedupePrimitiveList([...currentAliases, ...nextAliases]),
    });
  });
  return [...map.values()].sort((a, b) => {
    if ((a.event_date || '') !== (b.event_date || '')) return (a.event_date || '').localeCompare(b.event_date || '');
    return (a.name || '').localeCompare(b.name || '');
  });
}

function buildPageUrl(basePath, pageNumber) {
  const separator = basePath.includes('?') ? '&' : '?';
  return `${BASE_URL}${basePath}${separator}page=${pageNumber}`;
}

function importFinishersPilot(options = {}) {
  if (options.htmlDir) {
    return importFinishersFromHtmlDir(options.htmlDir, options.seenAt || new Date().toISOString());
  }
  const rows = [];
  const startPage = Number(options.startPage || DEFAULT_START_PAGE);
  let endPage = Number(options.endPage || DEFAULT_END_PAGE);
  const perPage = Number(options.perPage || DEFAULT_PER_PAGE);
  if (options.allPages) {
    const firstPayload = fetchFinishersTypesensePayload(startPage, perPage);
    const docs = extractTypesenseDocuments(firstPayload);
    rows.push(...docs.flatMap(race => transformFinishersRace(race, options.seenAt || new Date().toISOString())));
    endPage = Math.max(startPage, extractTotalPages(firstPayload, perPage));
    for (let page = startPage + 1; page <= endPage; page += 1) {
      rows.push(...fetchFinishersTypesensePage(page, perPage, options.seenAt || new Date().toISOString()));
    }
    return dedupeRows(rows);
  }
  for (let page = startPage; page <= endPage; page += 1) {
    rows.push(...fetchFinishersTypesensePage(page, perPage, options.seenAt || new Date().toISOString()));
  }
  return dedupeRows(rows);
}

function importFinishersFromHtmlDir(htmlDir, seenAt) {
  const files = fs.readdirSync(htmlDir)
    .filter(name => /\.html?$/i.test(name))
    .sort()
    .map(name => path.resolve(htmlDir, name));
  const rows = files.flatMap((file) => {
    const html = fs.readFileSync(file, 'utf8');
    return extractFinishersRacesFromHtml(html, seenAt);
  });
  return dedupeRows(rows);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = importFinishersPilot(args);
  fs.writeFileSync(args.outputJson, `${JSON.stringify(rows, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ total: rows.length, output: args.outputJson })}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  buildVariantName,
  dedupeRows,
  extractFinishersRacesFromHtml,
  extractNextData,
  extractTotalPages,
  extractTypesenseDocuments,
  formatExactDistanceLabel,
  fetchFinishersTypesensePayload,
  fetchFinishersTypesensePage,
  importFinishersFromHtmlDir,
  importFinishersPilot,
  mapDiscipline,
  normalizeDistanceVariant,
  toIsoDate,
  transformFinishersRace,
  uniqueVariants,
};
