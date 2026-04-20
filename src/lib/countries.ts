/**
 * ISO 3166-1 alpha-2 → country name for autocomplete haystack expansion.
 * Covers the ~80 countries most commonly represented in endurance race catalogs.
 * When users type a country name (e.g. "oman", "france"), we resolve it to
 * the ISO code so it matches catalog entries stored as 2-letter codes.
 */
export const ISO_TO_NAME: Record<string, string> = {
  AD: 'andorra',
  AE: 'united arab emirates uae',
  AT: 'austria',
  AU: 'australia',
  BE: 'belgium',
  BH: 'bahrain',
  BR: 'brazil',
  CA: 'canada',
  CH: 'switzerland',
  CL: 'chile',
  CN: 'china',
  CO: 'colombia',
  CZ: 'czech republic czechia',
  DE: 'germany',
  DK: 'denmark',
  EG: 'egypt',
  ES: 'spain',
  FI: 'finland',
  FR: 'france',
  GB: 'united kingdom uk england scotland wales',
  GR: 'greece',
  HK: 'hong kong',
  HR: 'croatia',
  HU: 'hungary',
  ID: 'indonesia',
  IE: 'ireland',
  IL: 'israel',
  IN: 'india',
  IS: 'iceland',
  IT: 'italy',
  JP: 'japan',
  KE: 'kenya',
  KR: 'south korea korea',
  KW: 'kuwait',
  LU: 'luxembourg',
  MA: 'morocco',
  MT: 'malta',
  MX: 'mexico',
  MY: 'malaysia',
  NL: 'netherlands holland',
  NO: 'norway',
  NZ: 'new zealand',
  OM: 'oman',
  PE: 'peru',
  PH: 'philippines',
  PL: 'poland',
  PT: 'portugal',
  QA: 'qatar',
  RO: 'romania',
  RS: 'serbia',
  RU: 'russia',
  SA: 'saudi arabia',
  SE: 'sweden',
  SG: 'singapore',
  SI: 'slovenia',
  SK: 'slovakia',
  TH: 'thailand',
  TN: 'tunisia',
  TR: 'turkey',
  TW: 'taiwan',
  UA: 'ukraine',
  US: 'united states usa america',
  ZA: 'south africa',
  ZW: 'zimbabwe',
}

/**
 * Given a 2-letter ISO country code (e.g. "OM"), returns the country name
 * string to append to the search haystack (e.g. "oman").
 * Returns empty string for unknown codes.
 */
export function countryNameHaystack(code: string): string {
  if (!code) return ''
  return ISO_TO_NAME[code.toUpperCase()] ?? code.toLowerCase()
}
