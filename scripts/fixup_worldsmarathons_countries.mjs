#!/usr/bin/env node
// One-shot fix-up: re-resolve country in scripts/out/worldsmarathons.json
// using the extended ISO_TO_COUNTRY map from scrape_worldsmarathons.mjs.
//
// Use after expanding the ISO map without re-scraping.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

// Inline the same map as scrape_worldsmarathons.mjs (keep in sync).
const ISO_TO_COUNTRY = {
  AD: 'Andorra', AE: 'United Arab Emirates', AG: 'Antigua and Barbuda',
  AL: 'Albania', AM: 'Armenia', AO: 'Angola', AQ: 'Antarctica', AR: 'Argentina',
  AT: 'Austria', AU: 'Australia', AW: 'Aruba', AX: 'Åland Islands', AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina', BB: 'Barbados', BD: 'Bangladesh', BE: 'Belgium',
  BG: 'Bulgaria', BH: 'Bahrain', BM: 'Bermuda', BN: 'Brunei', BO: 'Bolivia',
  BR: 'Brazil', BS: 'Bahamas', BT: 'Bhutan', BW: 'Botswana', BY: 'Belarus',
  BZ: 'Belize', CA: 'Canada', CD: 'Democratic Republic of the Congo',
  CH: 'Switzerland', CI: "Côte d'Ivoire", CK: 'Cook Islands', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', CV: 'Cape Verde',
  CW: 'Curaçao', CY: 'Cyprus', CZ: 'Czech Republic', DE: 'Germany',
  DK: 'Denmark', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador',
  EE: 'Estonia', EG: 'Egypt', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland',
  FJ: 'Fiji', FK: 'Falkland Islands', FO: 'Faroe Islands', FR: 'France',
  GA: 'Gabon', GB: 'United Kingdom', GD: 'Grenada', GE: 'Georgia', GG: 'Guernsey',
  GH: 'Ghana', GL: 'Greenland', GM: 'Gambia', GR: 'Greece', GT: 'Guatemala',
  GU: 'Guam', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HU: 'Hungary',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IM: 'Isle of Man', IN: 'India',
  IR: 'Iran', IS: 'Iceland', IT: 'Italy', JE: 'Jersey', JM: 'Jamaica',
  JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia',
  KR: 'South Korea', KW: 'Kuwait', KY: 'Cayman Islands', KZ: 'Kazakhstan',
  LA: 'Laos', LB: 'Lebanon', LC: 'Saint Lucia', LI: 'Liechtenstein', LK: 'Sri Lanka',
  LR: 'Liberia', LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia',
  MA: 'Morocco', MC: 'Monaco', MD: 'Moldova', ME: 'Montenegro', MK: 'North Macedonia',
  MM: 'Myanmar', MN: 'Mongolia', MO: 'Macau', MP: 'Northern Mariana Islands',
  MQ: 'Martinique', MT: 'Malta', MU: 'Mauritius', MV: 'Maldives',
  MX: 'Mexico', MY: 'Malaysia', NA: 'Namibia', NC: 'New Caledonia',
  NE: 'Niger', NG: 'Nigeria', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal',
  NZ: 'New Zealand', OM: 'Oman', PA: 'Panama', PE: 'Peru', PF: 'French Polynesia',
  PG: 'Papua New Guinea', PH: 'Philippines', PK: 'Pakistan', PL: 'Poland',
  PR: 'Puerto Rico', PT: 'Portugal', PY: 'Paraguay', QA: 'Qatar',
  RO: 'Romania', RS: 'Serbia', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia',
  SC: 'Seychelles', SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', SK: 'Slovakia',
  SL: 'Sierra Leone', SN: 'Senegal', SO: 'Somalia', ST: 'São Tomé and Príncipe',
  SV: 'El Salvador', SY: 'Syria', TC: 'Turks and Caicos Islands',
  TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan', TN: 'Tunisia', TR: 'Turkey',
  TT: 'Trinidad and Tobago', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine',
  UG: 'Uganda', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VA: 'Vatican City', VE: 'Venezuela', VG: 'British Virgin Islands',
  VI: 'United States Virgin Islands', VN: 'Vietnam', WS: 'Samoa',
  ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
};

const path = resolve(OUT_DIR, 'worldsmarathons.json');
const rows = JSON.parse(await readFile(path, 'utf8'));
let resolvedCount = 0;
for (const r of rows) {
  if (r.country) continue;
  const code = r.country_iso2;
  if (code && ISO_TO_COUNTRY[code]) {
    r.country = ISO_TO_COUNTRY[code];
    resolvedCount++;
  }
}
await writeFile(path, JSON.stringify(rows, null, 2));
console.error(`[fixup] resolved ${resolvedCount} previously-missing countries`);
console.error(`[fixup] total rows: ${rows.length}`);
console.error(`[fixup] still missing: ${rows.filter((r) => !r.country).length}`);
