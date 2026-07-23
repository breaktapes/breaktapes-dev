import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { TimePickerWheel } from '@/components/TimePickerWheel'
import type { HMS } from '@/components/TimePickerWheel'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { selectRaces, selectNextRace, selectAthlete, selectAuthUser } from '@/stores/selectors'
import { posthog } from '@/lib/posthog'
import { EditProfileModal } from '@/components/EditProfileModal'
import { InjuryLogModal } from '@/components/InjuryLogModal'
import type { Injury, Race } from '@/types'
import { INJURY_BODY_PARTS, INJURY_PHASES } from '@/types'
import { useUnits, distUnit } from '@/lib/units'
import { distLabel } from '@/lib/utils'
import { APP_URL } from '@/env'
import { supabase } from '@/lib/supabase'

// ─── Goal distance presets (static, not from race history) ───────────────────

const GOAL_SPORTS = ['Running', 'Triathlon', 'Cycling', 'Swimming', 'HYROX'] as const

const GOAL_DISTANCES: Record<string, { label: string; value: string }[]> = {
  Running:   [
    { label: '5K',           value: '5' },
    { label: '10K',          value: '10' },
    { label: '10 Mile',      value: '16.09' },
    { label: 'Half Marathon',value: '21.1' },
    { label: 'Marathon',     value: '42.2' },
    { label: '50K',          value: '50' },
    { label: '100K',         value: '100' },
    { label: '100 Mile',     value: '160.93' },
  ],
  Triathlon: [
    { label: 'Super Sprint', value: '13' },
    { label: 'Sprint',       value: '25.75' },
    { label: 'Olympic',      value: '51.5' },
    { label: 'PTO 100',      value: '100' },
    { label: '70.3 / Middle Distance', value: '113' },
    { label: 'IRONMAN / Full Distance', value: '226' },
  ],
  Cycling:   [
    { label: '50K',          value: '50' },
    { label: '100K',         value: '100' },
    { label: 'Century (161km)', value: '161' },
  ],
  Swimming:  [
    { label: '1K',           value: '1' },
    { label: '3K',           value: '3' },
    { label: '5K',           value: '5' },
    { label: '10K',          value: '10' },
  ],
  HYROX:     [
    { label: 'Solo Open',    value: 'Solo Open' },
    { label: 'Solo Pro',     value: 'Solo Pro' },
    { label: 'Doubles Open', value: 'Doubles Open' },
    { label: 'Doubles Pro',  value: 'Doubles Pro' },
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((new Date(dateStr + 'T00:00:00').getTime() - now.getTime()) / 86400000))
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtMonthYear(year: number, month: number): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[month]} ${year}`
}

function fmtDDMMMYYYY(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = String(d.getDate()).padStart(2, '0')
  const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()]
  return `${day}${mon}${d.getFullYear()}`
}

function abbreviateCountry(c: string): string {
  if (!c) return ''
  const words = c.trim().split(/\s+/)
  return words.length === 1 ? c.slice(0, 3).toUpperCase() : words.map(w => w[0].toUpperCase()).join('')
}

function computeAge(dob: string | undefined): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function ageGroup(dob: string | undefined, gender: string | undefined): string | null {
  const age = computeAge(dob)
  if (age === null) return null
  const g = gender === 'M' ? 'M' : gender === 'F' ? 'F' : ''
  const bracket = Math.floor(age / 5) * 5
  return `${g}${bracket > 0 ? bracket : '18'}`
}

function yearsActive(races: Race[]): number {
  if (races.length === 0) return 0
  const years = races.map(r => parseInt(r.date?.slice(0, 4) ?? '0'))
  return new Date().getFullYear() - Math.min(...years) + 1
}

const DIST_LABEL_KM: Record<string, number> = {
  'marathon': 42.195, 'full marathon': 42.195,
  'half marathon': 21.0975, 'half': 21.0975,
  'ironman': 226, 'full ironman': 226, 'full distance': 226,
  'ironman / full distance': 226, 'im': 226,
  'half ironman': 113, '70.3': 113, 'middle distance': 113,
  '70.3 / middle distance': 113, 'im 70.3': 113,
  'olympic': 51.5, 'olympic triathlon': 51.5, 'olympic tri': 51.5,
  'sprint': 25.75, 'sprint triathlon': 25.75, 'sprint tri': 25.75,
  '5k': 5, '10k': 10, '15k': 15, '20k': 20, '25k': 25, '30k': 30,
  '50k': 50, '60k': 60, '80k': 80, '90k': 90, '100k': 100,
  '160k': 160, '50mi': 80.47, '100mi': 160.93,
  'ultra': 50, 'ultramarathon': 50,
  'mile': 1.609, '1 mile': 1.609, '5 mile': 8.047, '10 mile': 16.09,
  'hyrox': 8,
}

function distToKm(d: string | undefined): number {
  if (!d) return 0
  const n = parseFloat(d)
  if (!isNaN(n)) return n
  return DIST_LABEL_KM[d.toLowerCase().trim()] ?? 0
}

function totalKm(races: Race[]): number {
  return races
    .filter(r => !r.outcome || r.outcome === 'Finished')
    .reduce((sum, r) => sum + distToKm(r.distance), 0)
}

function uniqueCountries(races: Race[]): string[] {
  return [...new Set(races.map(r => r.country).filter(Boolean))]
}

function athleteLevel(raceCount: number): string {
  if (raceCount >= 50) return 'ELITE'
  if (raceCount >= 20) return 'PRO'
  if (raceCount >= 10) return 'COMP'
  if (raceCount >= 5) return 'FIT'
  return 'NEW'
}



// Canonical PB distance order: running distances first (ascending km), then triathlon (ascending).
// Only these distances appear in the Personal Bests section; non-standard distances are excluded.
// distValue: actual race.distance to match (defaults to key). sportMatch: substring to match in race.sport.
const PB_DISTANCES: Array<{ key: string; label: string; sport: string; distValue?: string; sportMatch?: string }> = [
  // Running
  { key: '5',      label: '5K',            sport: 'Running' },
  { key: '10',     label: '10K',           sport: 'Running' },
  { key: '16.09',  label: '10 Mile',       sport: 'Running' },
  { key: '21.1',   label: 'Half Marathon', sport: 'Running' },
  { key: '42.2',   label: 'Marathon',      sport: 'Running' },
  { key: '42.195', label: 'Marathon',      sport: 'Running' },
  { key: '50',     label: '50K',           sport: 'Running', sportMatch: 'run' },
  { key: '100',    label: '100K',          sport: 'Running', sportMatch: 'run' },
  { key: '160.93', label: '100 Mile',      sport: 'Running', sportMatch: 'run' },
  // Triathlon
  { key: '17.65',  label: 'Super Sprint',  sport: 'Triathlon' },
  { key: '25.75',  label: 'Sprint',        sport: 'Triathlon' },
  { key: '51.5',   label: 'Olympic',       sport: 'Triathlon' },
  { key: '113', label: '70.3 / Middle Distance', sport: 'Triathlon' },
  { key: '226',    label: 'Ironman',       sport: 'Triathlon' },
  // Cycling (key=composite so won't clash; distValue=actual race distance)
  { key: '40|cy',     label: '40K TT',    sport: 'Cycling',  distValue: '40',     sportMatch: 'cycl' },
  { key: '100|cy',    label: '100K',      sport: 'Cycling',  distValue: '100',    sportMatch: 'cycl' },
  { key: '160.93|cy', label: '100 Mile',  sport: 'Cycling',  distValue: '160.93', sportMatch: 'cycl' },
  // Swimming
  { key: '1.5|sw',    label: '1500m',     sport: 'Swimming', distValue: '1.5',    sportMatch: 'swim' },
  { key: '3|sw',      label: '3K',        sport: 'Swimming', distValue: '3',      sportMatch: 'swim' },
  { key: '5|sw',      label: '5K',        sport: 'Swimming', distValue: '5',      sportMatch: 'swim' },
  { key: '10|sw',     label: '10K',       sport: 'Swimming', distValue: '10',     sportMatch: 'swim' },
  // HYROX (any distance, sport must be hyrox)
  { key: 'hyrox',     label: 'HYROX',     sport: 'HYROX',                         sportMatch: 'hyrox' },
]
const PB_KEY_ORDER: Map<string, number> = new Map(PB_DISTANCES.map((d, i) => [d.key, i]))
const PB_KEY_LABEL: Map<string, string>  = new Map(PB_DISTANCES.map(d => [d.key, d.label]))
const PB_KEY_SPORT: Map<string, string>  = new Map(PB_DISTANCES.map(d => [d.key, d.sport]))
const PB_SPORT_ORDER = ['Running', 'Triathlon', 'Cycling', 'Swimming', 'HYROX']

const PB_HIDDEN_LS_KEY = 'fl2_pb_hidden_keys'

function readPBHiddenKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(PB_HIDDEN_LS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
    // Fallback: seed from synced athlete store (cross-device)
    const stored = useAthleteStore.getState().athlete?.pbHiddenKeys
    return new Set(Array.isArray(stored) ? stored : [])
  } catch { return new Set() }
}
function savePBHiddenKeys(s: Set<string>) {
  try { localStorage.setItem(PB_HIDDEN_LS_KEY, JSON.stringify([...s])) } catch {}
  // Sync to athlete store so public profile Worker can read it
  useAthleteStore.getState().updateAthlete({ pbHiddenKeys: [...s] })
}

// country full-name → ISO-2 code (covers the most common racing nations)
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  'united arab emirates': 'AE', 'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ',
  'argentina': 'AR', 'australia': 'AU', 'austria': 'AT', 'bahrain': 'BH',
  'bangladesh': 'BD', 'belgium': 'BE', 'brazil': 'BR', 'canada': 'CA',
  'chile': 'CL', 'china': 'CN', 'colombia': 'CO', 'croatia': 'HR',
  'czech republic': 'CZ', 'denmark': 'DK', 'ecuador': 'EC', 'egypt': 'EG',
  'ethiopia': 'ET', 'finland': 'FI', 'france': 'FR', 'germany': 'DE',
  'ghana': 'GH', 'greece': 'GR', 'hong kong': 'HK', 'hungary': 'HU',
  'iceland': 'IS', 'india': 'IN', 'indonesia': 'ID', 'iran': 'IR',
  'ireland': 'IE', 'israel': 'IL', 'italy': 'IT', 'jamaica': 'JM',
  'japan': 'JP', 'jordan': 'JO', 'kenya': 'KE', 'kuwait': 'KW',
  'lebanon': 'LB', 'malaysia': 'MY', 'mexico': 'MX', 'morocco': 'MA',
  'nepal': 'NP', 'netherlands': 'NL', 'new zealand': 'NZ', 'nigeria': 'NG',
  'norway': 'NO', 'oman': 'OM', 'pakistan': 'PK', 'peru': 'PE',
  'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT', 'qatar': 'QA',
  'romania': 'RO', 'russia': 'RU', 'saudi arabia': 'SA', 'singapore': 'SG',
  'south africa': 'ZA', 'south korea': 'KR', 'spain': 'ES', 'sri lanka': 'LK',
  'sweden': 'SE', 'switzerland': 'CH', 'taiwan': 'TW', 'tanzania': 'TZ',
  'thailand': 'TH', 'turkey': 'TR', 'uganda': 'UG', 'ukraine': 'UA',
  'united kingdom': 'GB', 'united states': 'US', 'vietnam': 'VN', 'zimbabwe': 'ZW',
}

// ISO-2 → ISO-3 abbreviation
const ISO2_TO_ISO3: Record<string, string> = {
  AE:'UAE', AF:'AFG', AL:'ALB', DZ:'ALG', AR:'ARG', AU:'AUS', AT:'AUT', BH:'BHR',
  BD:'BAN', BE:'BEL', BR:'BRA', CA:'CAN', CL:'CHI', CN:'CHN', CO:'COL', HR:'CRO',
  CZ:'CZE', DK:'DEN', EC:'ECU', EG:'EGY', ET:'ETH', FI:'FIN', FR:'FRA', DE:'GER',
  GH:'GHA', GR:'GRE', HK:'HKG', HU:'HUN', IS:'ISL', IN:'IND', ID:'INA', IR:'IRI',
  IE:'IRL', IL:'ISR', IT:'ITA', JM:'JAM', JP:'JPN', JO:'JOR', KE:'KEN', KW:'KUW',
  LB:'LBN', MY:'MAS', MX:'MEX', MA:'MAR', NP:'NEP', NL:'NED', NZ:'NZL', NG:'NGR',
  NO:'NOR', OM:'OMA', PK:'PAK', PE:'PER', PH:'PHI', PL:'POL', PT:'POR', QA:'QAT',
  RO:'ROU', RU:'RUS', SA:'KSA', SG:'SGP', ZA:'RSA', KR:'KOR', ES:'ESP', LK:'SRI',
  SE:'SWE', CH:'SUI', TW:'TPE', TZ:'TAN', TH:'THA', TR:'TUR', UG:'UGA', UA:'UKR',
  GB:'GBR', US:'USA', VN:'VIE', ZW:'ZIM',
}

function countryToISO2(name: string): string {
  return COUNTRY_NAME_TO_ISO2[name.toLowerCase().trim()] ?? (name.length === 2 ? name.toUpperCase() : '')
}

function countryFlagUrl(name: string): string {
  const iso2 = countryToISO2(name)
  if (!iso2) return ''
  return `https://flagcdn.com/20x15/${iso2.toLowerCase()}.png`
}

function countryToISO3(name: string): string {
  const iso2 = countryToISO2(name)
  if (!iso2) return name.slice(0, 3).toUpperCase()
  return ISO2_TO_ISO3[iso2] ?? iso2
}

// ─── Age-Grade Standards (WA road-race tables) ────────────────────────────────

const AGE_GRADE_STANDARDS: Record<string, Record<string, Array<[number, number]>>> = {
  M: {
    '5K':           [[18,757],[35,780],[40,808],[45,852],[50,913],[55,1002],[60,1110],[65,1254],[70,1440]],
    '10K':          [[18,1571],[35,1620],[40,1680],[45,1770],[50,1890],[55,2070],[60,2295],[65,2580],[70,2970]],
    'Half Marathon':[[18,3561],[35,3660],[40,3810],[45,4020],[50,4290],[55,4680],[60,5190],[65,5820],[70,6720]],
    'Marathon':     [[18,7377],[35,7560],[40,7890],[45,8340],[50,8910],[55,9720],[60,10800],[65,12060],[70,13920]],
  },
  F: {
    '5K':           [[18,855],[35,885],[40,922],[45,975],[50,1050],[55,1155],[60,1290],[65,1470],[70,1710]],
    '10K':          [[18,1771],[35,1830],[40,1908],[45,2010],[50,2160],[55,2370],[60,2640],[65,3000],[70,3480]],
    'Half Marathon':[[18,3975],[35,4110],[40,4290],[45,4530],[50,4890],[55,5370],[60,6000],[65,6840],[70,7920]],
    'Marathon':     [[18,8231],[35,8520],[40,8910],[45,9420],[50,10140],[55,11100],[60,12420],[65,14100],[70,16320]],
  },
}

function getAgeGradeStandard(gender: string, distLabel: string, age: number): number | null {
  const table = (AGE_GRADE_STANDARDS[gender] ?? {})[distLabel]
  if (!table) return null
  let std: number | null = null
  for (const [ageFrom, secs] of table) {
    if (age >= ageFrom) std = secs
  }
  return std
}

function parseTimeToSecs(str: string | undefined): number | null {
  if (!str) return null
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN) || p.some(v => v < 0) || p.length === 0) return null
  if (p.length === 3) return (p[1] > 59 || p[2] > 59) ? null : p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[1] > 59 ? null : p[0] * 60 + p[1]
  return null
}

interface AgeGradeResult { pct: number; distance: string; raceName: string; raceDate: string }

function computeAgeGradeForRace(
  race: Race,
  gender: string | undefined,
  age: number | null,
): number | null {
  if (!gender || !age) return null
  const dl = distLabel(race.distance)
  const std = getAgeGradeStandard(gender, dl, age)
  if (!std || !race.time) return null
  const secs = parseTimeToSecs(race.time)
  if (!secs) return null
  return Math.min(100, (std / secs) * 100)
}

interface SigDistEntry {
  distance: string
  race: Race
  score: number
  label: string
  metric: 'age-grade' | 'pace' | 'speed'
}

function computeSignatureDistances(
  races: Race[],
  gender: string | undefined,
  age: number | null,
): SigDistEntry[] {
  // build PBs by distance — completed races only, compared in SECONDS (string
  // compare ranks "10:01:00" before "9:59:00" for ultras/IRONMAN over 10h).
  const pbMap: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    if (r.outcome && r.outcome !== 'Finished') continue
    const rs = parseTimeToSecs(r.time)
    if (rs == null) continue
    const cur = pbMap[r.distance]
    if (!cur || rs < (parseTimeToSecs(cur.time!) ?? Infinity)) pbMap[r.distance] = r
  }

  const entries: SigDistEntry[] = []
  for (const [, race] of Object.entries(pbMap)) {
    const ageGrade = computeAgeGradeForRace(race, gender, age)
    const secs = parseTimeToSecs(race.time)
    const distKm = distToKm(race.distance)
    const isRunning = ['run', 'ultra', 'hyrox'].includes(race.sport ?? 'run')
    const speedScore = secs && distKm ? distKm / (secs / 3600) : 0
    const paceSecsPerKm = isRunning && distKm > 0 && secs ? secs / distKm : 0
    const paceLabel = paceSecsPerKm > 0
      ? `${Math.floor(paceSecsPerKm / 60)}:${String(Math.round(paceSecsPerKm % 60)).padStart(2, '0')}/km`
      : `${speedScore.toFixed(1)} km/h`
    entries.push({
      distance: distLabel(race.distance),
      race,
      score: ageGrade ?? speedScore,
      label: ageGrade ? `${ageGrade.toFixed(1)}% age-grade` : paceLabel,
      metric: ageGrade ? 'age-grade' : isRunning ? 'pace' : 'speed',
    })
  }
  return entries.sort((a, b) => b.score - a.score).slice(0, 3)
}

function computeAgeGradeHistory(
  races: Race[],
  gender: string | undefined,
  age: number | null,
): AgeGradeResult[] {
  const COVERED = new Set(['5K', '10K', 'Half Marathon', 'Marathon'])
  return races
    .filter(r => r.time && r.date && COVERED.has(distLabel(r.distance)))
    .map(r => {
      const pct = computeAgeGradeForRace(r, gender, age)
      return pct ? { pct, distance: distLabel(r.distance), raceName: r.name ?? '', raceDate: r.date } : null
    })
    .filter((x): x is AgeGradeResult => x !== null)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
}

function buildPBByDist(races: Race[]): Array<{ key: string; label: string; race: Race }> {
  const map: Record<string, Race> = {}
  for (const entry of PB_DISTANCES) {
    const distToMatch = entry.distValue ?? entry.key
    for (const r of races) {
      if (!r.time || !r.distance) continue
      if (r.outcome && r.outcome !== 'Finished') continue  // DNF/DSQ/DNS isn't a PB
      if (r.distance !== distToMatch) continue
      if (entry.sportMatch) {
        const rSport = (r.sport ?? '').toLowerCase()
        // For running: empty sport is treated as running (legacy data)
        const isRunMatch = entry.sportMatch === 'run' && (rSport === '' || rSport.includes('run'))
        const isOtherMatch = entry.sportMatch !== 'run' && rSport.includes(entry.sportMatch)
        if (!isRunMatch && !isOtherMatch) continue
      } else if (entry.key !== r.distance) {
        // No sportMatch and key differs from distance → skip (composite key with no filter)
        continue
      }
      { const _rs = parseTimeToSecs(r.time); const _cur = map[entry.key]; if (_rs != null && (!_cur || _rs < (parseTimeToSecs(_cur.time!) ?? Infinity))) map[entry.key] = r }
    }
    // HYROX: match any distance as long as sport matches
    if (entry.key === 'hyrox') {
      for (const r of races) {
        if (!r.time) continue
        if (r.outcome && r.outcome !== 'Finished') continue
        const rSport = (r.sport ?? '').toLowerCase()
        if (!rSport.includes('hyrox')) continue
        { const _rs = parseTimeToSecs(r.time); const _cur = map[entry.key]; if (_rs != null && (!_cur || _rs < (parseTimeToSecs(_cur.time!) ?? Infinity))) map[entry.key] = r }
      }
    }
  }
  return [...PB_KEY_ORDER.keys()]
    .filter(key => map[key])
    .map(key => ({ key, label: PB_KEY_LABEL.get(key) ?? distLabel(key), race: map[key] }))
}

function parseHMS(str: string): number | null {
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN)) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

// ─── Achievement Definitions ──────────────────────────────────────────────────

interface Achievement {
  id: string
  icon: string
  name: string
  description: string
  group: 'special' | 'ladder'
  family?: string   // ladder family: '10k' | 'half' | 'marathon' | 'ultra' | 'tri703' | 'iron'
  tier?: number     // ladder tier order (lower = slower / easier)
  check: (races: Race[], athlete: ReturnType<typeof selectAthlete>) => boolean
  findSourceRace?: (races: Race[], athlete: ReturnType<typeof selectAthlete>) => Race | null
}

function isRunningRace(r: Race): boolean {
  const s = (r.sport ?? '').toLowerCase()
  return s === '' || s === 'running' || s === 'run'
}

function isTriRace(r: Race): boolean {
  const s = (r.sport ?? '').toLowerCase()
  return s.includes('tri') || s.includes('iron')
}

// Best time (seconds) for races in a km range, optionally filtered by sport
function getPBSecsForDist(races: Race[], minKm: number, maxKm: number, sport?: string): number | null {
  let best: number | null = null
  for (const r of races) {
    if (!r.time) continue
    // PBs come from completed races only — a DNF/DSQ/DNS can carry a partial time.
    if (r.outcome && r.outcome !== 'Finished') continue
    const km = distToKm(r.distance)
    if (isNaN(km) || km < minKm || km > maxKm) continue
    if (sport && (r.sport ?? '').toLowerCase() !== sport.toLowerCase()) continue
    const secs = parseHMS(r.time)
    if (secs === null) continue
    if (best === null || secs < best) best = secs
  }
  return best
}

// Rough continent codes keyed by country name (as stored in race catalog)
const CONTINENT_MAP: Record<string, string> = {
  // Africa
  'Egypt': 'AF', 'South Africa': 'AF', 'Morocco': 'AF', 'Kenya': 'AF', 'Ethiopia': 'AF',
  'Nigeria': 'AF', 'Tanzania': 'AF', 'Uganda': 'AF', 'Ghana': 'AF', 'Namibia': 'AF',
  'Zimbabwe': 'AF', 'Rwanda': 'AF', 'Algeria': 'AF', 'Tunisia': 'AF',
  // Asia / Middle East
  'Japan': 'AS', 'China': 'AS', 'South Korea': 'AS', 'India': 'AS', 'Thailand': 'AS',
  'Singapore': 'AS', 'Hong Kong': 'AS', 'Taiwan': 'AS', 'Malaysia': 'AS', 'Indonesia': 'AS',
  'Philippines': 'AS', 'Vietnam': 'AS', 'Nepal': 'AS', 'Sri Lanka': 'AS',
  'United Arab Emirates': 'AS', 'Saudi Arabia': 'AS', 'Qatar': 'AS', 'Bahrain': 'AS',
  'Kuwait': 'AS', 'Jordan': 'AS', 'Israel': 'AS', 'Lebanon': 'AS', 'Oman': 'AS', 'Turkey': 'AS',
  // Europe
  'Germany': 'EU', 'France': 'EU', 'United Kingdom': 'EU', 'Italy': 'EU', 'Spain': 'EU',
  'Netherlands': 'EU', 'Belgium': 'EU', 'Switzerland': 'EU', 'Austria': 'EU', 'Sweden': 'EU',
  'Norway': 'EU', 'Denmark': 'EU', 'Finland': 'EU', 'Poland': 'EU', 'Czech Republic': 'EU',
  'Portugal': 'EU', 'Greece': 'EU', 'Ireland': 'EU', 'Hungary': 'EU', 'Romania': 'EU',
  'Croatia': 'EU', 'Slovakia': 'EU', 'Slovenia': 'EU', 'Estonia': 'EU', 'Latvia': 'EU',
  'Lithuania': 'EU', 'Luxembourg': 'EU', 'Malta': 'EU', 'Serbia': 'EU', 'Bulgaria': 'EU',
  // North America
  'United States': 'NA', 'Canada': 'NA', 'Mexico': 'NA', 'Jamaica': 'NA',
  'Dominican Republic': 'NA', 'Puerto Rico': 'NA',
  // South America
  'Brazil': 'SA', 'Argentina': 'SA', 'Chile': 'SA', 'Colombia': 'SA', 'Peru': 'SA',
  'Uruguay': 'SA', 'Ecuador': 'SA', 'Bolivia': 'SA',
  // Oceania
  'Australia': 'OC', 'New Zealand': 'OC',
}

function continentOf(country: string): string {
  return CONTINENT_MAP[country] ?? 'UNKNOWN'
}

function isNegativeSplit(race: Race): boolean {
  if (!isRunningRace(race)) return false
  const splits = (race.splits ?? []).filter(s => s.split && parseHMS(s.split) !== null)
  if (splits.length < 2) return false
  const times = splits.map(s => parseHMS(s.split!) ?? 0)
  const mid = Math.floor(times.length / 2)
  const avgFirst = times.slice(0, mid).reduce((a, b) => a + b, 0) / mid
  const avgSecond = times.slice(mid).reduce((a, b) => a + b, 0) / (times.length - mid)
  return avgSecond < avgFirst
}

function hadCrisisAndRecovery(race: Race): boolean {
  if (!isRunningRace(race)) return false
  const splits = (race.splits ?? []).filter(s => s.split && parseHMS(s.split) !== null)
  if (splits.length < 3) return false
  const times = splits.map(s => parseHMS(s.split!) ?? 0)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  let hadCrisis = false
  for (let i = 0; i < times.length - 1; i++) {
    if (times[i] > avg * 1.2) hadCrisis = true
    if (hadCrisis && times[i] <= avg) return true
  }
  return false
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

// ── Inline SVG icon paths (24×24 viewBox, stroke-only, no fill) ──────────────
type SvgKey =
  | 'mountain' | 'moon'   | 'lightning' | 'heart'   | 'shield'
  | 'wave'     | 'globe'  | 'stopwatch' | 'camera'  | 'star'
  | 'map_pin'  | 'flag'   | 'users'     | 'medal'   | 'run'
  | 'calendar' | 'flame'

const SVG_PATHS: Record<SvgKey, string | string[]> = {
  mountain:  'M3 20h18L12 4 3 20z M9 13h6',
  moon:      'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  lightning: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  heart:     'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  shield:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  wave:      ['M2 12c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0','M2 17c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0','M2 7c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0'],
  globe:     ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z','M2 12h20','M12 2c-2.76 3.45-4 7-4 10s1.24 6.55 4 10M12 2c2.76 3.45 4 7 4 10s-1.24 6.55-4 10'],
  stopwatch: ['M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 13V9','M10 2h4','M12 2v2'],
  camera:    ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  star:      'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  map_pin:   ['M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z','M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  flag:      ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z','M4 22v-7'],
  users:     ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75','M9 7a4 4 0 1 0 0 8 4 4 0 1 0 0-8z'],
  medal:     ['M7.21 13.89 7 23l5-3 5 3-.21-9.12','M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z'],
  run:       ['M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0','M7.5 17.5l2.5-4 2.5 2 2.5-4','M6 13l2-3 4 1 2-3'],
  calendar:  ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z','M16 2v4','M8 2v4','M3 10h18'],
  flame:     'M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z M9 17.5c.5-2 2-3 3-5',
}

// Maps achievement id / ladder family → SVG icon key
const ACHIEVEMENT_ICON: Record<string, SvgKey> = {
  // Ladder families
  '10k':      'lightning', 'half':    'flag', 'marathon': 'flag',
  'ultra':    'mountain',  'tri703':  'wave', 'iron':     'shield',
  // Special
  'climb_crusher':             'mountain', 'heat_warrior':              'flame',
  'night_runner':              'moon',     'negative_split_master':     'lightning',
  'no_quit':                   'heart',    'pain_cave':                 'heart',
  'comeback_run':              'run',      'cutoff_survivor':           'stopwatch',
  'solo_warrior':              'shield',   'desert_runner':             'flame',
  'mountain_goat':             'mountain', 'sea_level_sprinter':        'wave',
  'stamp_collector':           'globe',    'continental':               'globe',
  'race_tourist':              'map_pin',  'season_finisher':           'calendar',
  'double_trouble':            'flag',     'sprint_specialist':         'lightning',
  'half_collector':            'flag',     'marathoner_plus':           'flag',
  'ultra_initiate':            'mountain', 'ultra_elite':               'mountain',
  'hundred_miler':             'mountain', 'iron_mind':                 'wave',
  'full_send':                 'shield',   'swim_survivor':             'wave',
  'pacemaker':                 'stopwatch','first_timer_guide':         'users',
  'club_loyalist':             'users',    'photo_finish':              'camera',
  'early_bird':                'moon',     'bib_collector':             'flag',
  'medal_wall':                'medal',    'lucky_number':              'star',
  'back_to_back_ultra':        'mountain', 'comrades_marathon_finisher':'star',
  'six_star_journey_started':  'star',     'six_star_marathon_finisher':'star',
  'extreme_conditions':        'mountain',
}

function AchievementSVGIcon({ a, size = 28, color = 'var(--orange)' }: { a: Achievement; size?: number; color?: string }) {
  const key: SvgKey = (a.family && ACHIEVEMENT_ICON[a.family]) ? ACHIEVEMENT_ICON[a.family] as SvgKey
    : (ACHIEVEMENT_ICON[a.id] ?? 'star') as SvgKey
  const paths = SVG_PATHS[key]
  const pathArr = Array.isArray(paths) ? paths : [paths]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {pathArr.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

const ACHIEVEMENTS: Achievement[] = [
  // ── Special singles (39) ──────────────────────────────────────────────────
  {
    id: 'climb_crusher', icon: '⛰️', name: 'CLIMB CRUSHER', group: 'special',
    description: 'Completed a running race with 500m+ elevation gain.',
    check: r => r.some(x => isRunningRace(x) && (x.elevation ?? 0) >= 500),
    findSourceRace: r => r.find(x => isRunningRace(x) && (x.elevation ?? 0) >= 500) ?? null,
  },
  {
    id: 'heat_warrior', icon: '🌡️', name: 'HEAT WARRIOR', group: 'special',
    description: 'Finished a race above 30°C.',
    check: r => r.some(x => (x.weather?.temp ?? 0) > 30),
    findSourceRace: r => r.find(x => (x.weather?.temp ?? 0) > 30) ?? null,
  },
  {
    id: 'night_runner', icon: '🌙', name: 'NIGHT RUNNER', group: 'special',
    description: 'Completed a race starting after sunset.',
    check: r => r.some(x => {
      if (!x.startTime) return false
      const h = parseInt(x.startTime.split(':')[0] ?? '12', 10)
      return h >= 20 || h < 6
    }),
    findSourceRace: r => r.find(x => {
      if (!x.startTime) return false
      const h = parseInt(x.startTime.split(':')[0] ?? '12', 10)
      return h >= 20 || h < 6
    }) ?? null,
  },
  {
    id: 'negative_split_master', icon: '⚡', name: 'NEGATIVE SPLIT MASTER', group: 'special',
    description: 'Ran a running race with a faster second half (based on splits).',
    check: r => r.some(isNegativeSplit),
    findSourceRace: r => r.find(isNegativeSplit) ?? null,
  },
  {
    id: 'no_quit', icon: '🫀', name: 'NO QUIT', group: 'special',
    description: 'Drastically slowed mid-race but dug deep to finish (based on splits).',
    check: r => r.some(hadCrisisAndRecovery),
    findSourceRace: r => r.find(hadCrisisAndRecovery) ?? null,
  },
  {
    id: 'pain_cave', icon: '❤️', name: 'PAIN CAVE', group: 'special',
    description: 'HR in Zone 4/5 for 70%+ of a race.',
    check: () => false,
  },
  {
    id: 'comeback_run', icon: '🔁', name: 'COMEBACK RUN', group: 'special',
    description: 'Raced after a 2+ week injury break. Set your break dates in Edit Profile.',
    check: (r, athlete) => {
      const end = athlete?.injuryBreakEnd
      const start = athlete?.injuryBreakStart
      if (!end || !start) return false
      const daysOff = (new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000
      if (daysOff < 14) return false
      return r.some(x => x.date > end)
    },
    findSourceRace: (r, athlete) => {
      const end = athlete?.injuryBreakEnd
      if (!end) return null
      return r.filter(x => x.date > end).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    },
  },
  {
    id: 'solo_warrior', icon: '🪖', name: 'SOLO WARRIOR', group: 'special',
    description: 'No pacer, no group — full solo race.',
    check: () => false,
  },
  {
    id: 'desert_runner', icon: '🏜️', name: 'DESERT RUNNER', group: 'special',
    description: 'Completed a race tagged with Desert terrain.',
    check: r => r.some(x => x.surface === 'desert'),
    findSourceRace: r => r.find(x => x.surface === 'desert') ?? null,
  },
  {
    id: 'mountain_goat', icon: '🐐', name: 'MOUNTAIN GOAT', group: 'special',
    description: 'Trail race with significant elevation.',
    check: r => r.some(x => x.surface === 'trail' && (x.elevation ?? 0) >= 200),
    findSourceRace: r => r.find(x => x.surface === 'trail' && (x.elevation ?? 0) >= 200) ?? null,
  },
  {
    id: 'sea_level_sprinter', icon: '🌊', name: 'SEA LEVEL SPRINTER', group: 'special',
    description: 'Completed a race tagged with Coastal terrain.',
    check: r => r.some(x => x.surface === 'coastal'),
    findSourceRace: r => r.find(x => x.surface === 'coastal') ?? null,
  },
  {
    id: 'stamp_collector', icon: '📮', name: 'STAMP COLLECTOR', group: 'special',
    description: 'Raced in 10 different cities.',
    check: r => new Set(r.map(x => x.city).filter(Boolean)).size >= 10,
  },
  {
    id: 'continental', icon: '🌍', name: 'CONTINENTAL', group: 'special',
    description: 'Race on 3+ continents.',
    check: r => new Set(r.map(x => x.country).filter(Boolean).map(continentOf).filter(c => c !== 'UNKNOWN')).size >= 3,
  },
  {
    id: 'race_tourist', icon: '🧳', name: 'RACE TOURIST', group: 'special',
    description: '5 races in different countries.',
    check: r => new Set(r.map(x => x.country).filter(Boolean)).size >= 5,
  },
  {
    id: 'season_finisher', icon: '📆', name: 'SEASON FINISHER', group: 'special',
    description: '5+ races in a calendar year.',
    check: r => {
      const y: Record<string, number> = {}
      for (const x of r) { const yr = x.date?.slice(0, 4); if (yr) y[yr] = (y[yr] ?? 0) + 1 }
      return Object.values(y).some(c => c >= 5)
    },
  },
  {
    id: 'double_trouble', icon: '✌️', name: 'DOUBLE TROUBLE', group: 'special',
    description: 'Two races within 7 days.',
    check: r => {
      const sorted = [...r].filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date))
      for (let i = 1; i < sorted.length; i++) {
        const diff = (new Date(sorted[i].date + 'T00:00:00').getTime() - new Date(sorted[i-1].date + 'T00:00:00').getTime()) / 86400000
        if (diff <= 7) return true
      }
      return false
    },
  },
  {
    id: 'sprint_specialist', icon: '💨', name: 'SPRINT SPECIALIST', group: 'special',
    description: '5 x 5K races (exact 5K distance).',
    check: r => r.filter(x => { const km = distToKm(x.distance); return km >= 4.9 && km <= 5.1 }).length >= 5,
  },
  {
    id: 'half_collector', icon: '🌓', name: 'HALF COLLECTOR', group: 'special',
    description: '10 half marathons (exactly 21.1 km).',
    check: r => r.filter(x => { const km = distToKm(x.distance); return km >= 21.0 && km <= 21.2 }).length >= 10,
  },
  {
    id: 'marathoner_plus', icon: '🏛️', name: 'MARATHONER+', group: 'special',
    description: '5 full marathons (exactly 42.2 km).',
    check: r => r.filter(x => { const km = distToKm(x.distance); return km >= 42.1 && km <= 42.3 }).length >= 5,
  },
  {
    id: 'ultra_initiate', icon: '🏔️', name: 'ULTRA INITIATE', group: 'special',
    description: 'First 50K+ running finish. Sport field must be filled in.',
    check: r => r.some(x => x.sport && isRunningRace(x) && distToKm(x.distance) >= 50),
    findSourceRace: r => r.filter(x => x.sport && isRunningRace(x) && distToKm(x.distance) >= 50).sort((a, b) => distToKm(a.distance) - distToKm(b.distance))[0] ?? null,
  },
  {
    id: 'ultra_elite', icon: '🦅', name: 'ULTRA ELITE', group: 'special',
    description: '100K+ running completed. Includes any running race ≥ 90 km.',
    check: r => r.some(x => x.sport && isRunningRace(x) && distToKm(x.distance) >= 90),
    findSourceRace: r => r.filter(x => x.sport && isRunningRace(x) && distToKm(x.distance) >= 90).sort((a, b) => distToKm(a.distance) - distToKm(b.distance))[0] ?? null,
  },
  {
    id: 'hundred_miler', icon: '💯', name: 'HUNDRED MILER', group: 'special',
    description: '100-mile running finish (161 km+). Sport field must be filled in.',
    check: r => r.some(x => x.sport && isRunningRace(x) && distToKm(x.distance) >= 161),
    findSourceRace: r => r.find(x => x.sport && isRunningRace(x) && distToKm(x.distance) >= 161) ?? null,
  },
  {
    id: 'iron_mind', icon: '🔱', name: 'IRON MIND', group: 'special',
    description: 'Finished a 70.3 triathlon (113 km, exact distance).',
    check: r => r.some(x => isTriRace(x) && distToKm(x.distance) >= 112 && distToKm(x.distance) <= 114),
    findSourceRace: r => r.find(x => isTriRace(x) && distToKm(x.distance) >= 112 && distToKm(x.distance) <= 114) ?? null,
  },
  {
    id: 'full_send', icon: '🛡️', name: 'FULL SEND', group: 'special',
    description: 'Completed a full Ironman (226 km, exact distance).',
    check: r => r.some(x => isTriRace(x) && distToKm(x.distance) >= 225 && distToKm(x.distance) <= 228),
    findSourceRace: r => r.find(x => isTriRace(x) && distToKm(x.distance) >= 225 && distToKm(x.distance) <= 228) ?? null,
  },
  {
    id: 'swim_survivor', icon: '🏊', name: 'SWIM SURVIVOR', group: 'special',
    description: 'Finished a swim race or a triathlon (which includes a swim segment).',
    check: r => r.some(x =>
      x.outcome !== 'DNF' && (
        (x.sport ?? '').toLowerCase().includes('swim') ||
        isTriRace(x)
      )
    ),
    findSourceRace: r => r.find(x =>
      x.outcome !== 'DNF' && (
        (x.sport ?? '').toLowerCase().includes('swim') ||
        isTriRace(x)
      )
    ) ?? null,
  },
  {
    id: 'pacemaker', icon: '⏱️', name: 'PACEMAKER', group: 'special',
    description: 'Served as an official pacer at a race. Set "Role at Race" to Pacer in the race form.',
    check: r => r.some(x => x.roleAtRace === 'pacer'),
    findSourceRace: r => r.find(x => x.roleAtRace === 'pacer') ?? null,
  },
  {
    id: 'first_timer_guide', icon: '🤝', name: 'FIRST TIMER GUIDE', group: 'special',
    description: 'Guided someone through their first race. Set "Role at Race" to Guide in the race form.',
    check: r => r.some(x => x.roleAtRace === 'guide'),
    findSourceRace: r => r.find(x => x.roleAtRace === 'guide') ?? null,
  },
  {
    id: 'club_loyalist', icon: '🏃', name: 'CLUB LOYALIST', group: 'special',
    description: '3+ years with a run club. Add your club join date in Edit Profile.',
    check: (_r, athlete) => {
      const dates = athlete?.clubJoinDates ?? {}
      const threeYearsAgo = new Date()
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
      return Object.values(dates).some(d => !!d && new Date(d + 'T00:00:00') <= threeYearsAgo)
    },
  },
  {
    id: 'photo_finish', icon: '📸', name: 'PHOTO FINISH', group: 'special',
    description: 'Race photo uploaded.',
    check: r => r.some(x => x.medalPhoto || (x.photos?.length ?? 0) > 0),
    findSourceRace: r => r.find(x => x.medalPhoto || (x.photos?.length ?? 0) > 0) ?? null,
  },
  {
    id: 'early_bird', icon: '🌅', name: 'EARLY BIRD', group: 'special',
    description: 'Race start before 6 AM.',
    check: r => r.some(x => {
      const st = x.startTime; if (!st) return false
      const h = parseInt(st.split(':')[0] ?? '24', 10)
      return h < 6
    }),
    findSourceRace: r => r.find(x => { const st = x.startTime; if (!st) return false; return parseInt(st.split(':')[0] ?? '24', 10) < 6 }) ?? null,
  },
  {
    id: 'bib_collector', icon: '🎽', name: 'BIB COLLECTOR', group: 'special',
    description: '25 race bibs collected.',
    check: r => r.length >= 25,
  },
  {
    id: 'medal_wall', icon: '🏅', name: 'MEDAL WALL', group: 'special',
    description: '50 medals collected.',
    check: r => r.length >= 50,
  },
  {
    id: 'lucky_number', icon: '🍀', name: 'LUCKY NUMBER', group: 'special',
    description: 'Same bib number in two different races.',
    check: r => {
      const bibs = r.map(x => x.bibNumber).filter(Boolean) as string[]
      return new Set(bibs).size < bibs.length
    },
  },
  {
    id: 'back_to_back_ultra', icon: '🧱', name: 'BACK-TO-BACK ULTRA', group: 'special',
    description: '2 running ultras (50K+) in the same calendar week. Running only.',
    check: r => {
      const ultras = r.filter(x => x.sport && isRunningRace(x) && distToKm(x.distance) >= 50 && x.date)
      const weekMap: Record<string, number> = {}
      for (const u of ultras) { const w = isoWeek(u.date); weekMap[w] = (weekMap[w] ?? 0) + 1 }
      return Object.values(weekMap).some(c => c >= 2)
    },
  },
  {
    id: 'comrades_marathon_finisher', icon: '🔥', name: 'COMRADES MARATHON FINISHER', group: 'special',
    description: 'Completed the Comrades Marathon.',
    check: r => r.some(x => (x.name ?? '').toLowerCase().includes('comrades')),
    findSourceRace: r => r.find(x => (x.name ?? '').toLowerCase().includes('comrades')) ?? null,
  },
  {
    id: 'six_star_journey_started', icon: '⭐', name: 'SIX STAR JOURNEY STARTED', group: 'special',
    description: 'Completed your first World Marathon Major.',
    check: r => MAJORS.some(m => r.some(x => matchesMajor(x, m))),
    findSourceRace: r => r.find(x => MAJORS.some(m => matchesMajor(x, m))) ?? null,
  },
  {
    id: 'six_star_marathon_finisher', icon: '🌟', name: 'SIX STAR MARATHON FINISHER', group: 'special',
    description: 'Completed all six World Marathon Majors.',
    check: r => MAJORS.every(m => r.some(x => matchesMajor(x, m))),
  },
  {
    id: 'extreme_conditions', icon: '🗻', name: 'EXTREME CONDITIONS', group: 'special',
    description: 'Race above 3,000m altitude.',
    check: () => false,
  },
  {
    id: 'cutoff_survivor', icon: '⏳', name: 'CUTOFF SURVIVOR', group: 'special',
    description: 'Finished within the last 5% of finishers.',
    check: () => false,
  },

  // ── 10K Ladder (7 tiers) ──────────────────────────────────────────────────
  { id: '10k_first_gear',     icon: '🏁', name: 'FIRST GEAR',     group: 'ladder', family: '10k', tier: 1, description: '10K under 60 min.',        check: r => { const pb = getPBSecsForDist(r, 9.5, 11); return pb !== null && pb < 3600 }, findSourceRace: r => r.filter(x => { const km = distToKm(x.distance); return km >= 9.5 && km <= 11 && x.time && (parseHMS(x.time) ?? Infinity) < 3600 }).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0] ?? null },
  { id: '10k_steady_roll',    icon: '🏁', name: 'STEADY ROLL',    group: 'ladder', family: '10k', tier: 2, description: '10K under 55 min.',        check: r => { const pb = getPBSecsForDist(r, 9.5, 11); return pb !== null && pb < 3300 } },
  { id: '10k_breaking_rhythm',icon: '🏁', name: 'BREAKING RHYTHM',group: 'ladder', family: '10k', tier: 3, description: '10K under 50 min.',        check: r => { const pb = getPBSecsForDist(r, 9.5, 11); return pb !== null && pb < 3000 } },
  { id: '10k_locked_in',      icon: '🏁', name: 'LOCKED IN',      group: 'ladder', family: '10k', tier: 4, description: '10K under 45 min.',        check: r => { const pb = getPBSecsForDist(r, 9.5, 11); return pb !== null && pb < 2700 } },
  { id: '10k_sharp_pace',     icon: '🏁', name: 'SHARP PACE',     group: 'ladder', family: '10k', tier: 5, description: '10K under 40 min.',        check: r => { const pb = getPBSecsForDist(r, 9.5, 11); return pb !== null && pb < 2400 } },
  { id: '10k_speed_control',  icon: '🏁', name: 'SPEED CONTROL',  group: 'ladder', family: '10k', tier: 6, description: '10K under 35 min.',        check: r => { const pb = getPBSecsForDist(r, 9.5, 11); return pb !== null && pb < 2100 } },
  { id: '10k_velocity_elite', icon: '🏁', name: 'VELOCITY ELITE', group: 'ladder', family: '10k', tier: 7, description: '10K under 30 min.',        check: r => { const pb = getPBSecsForDist(r, 9.5, 11); return pb !== null && pb < 1800 } },

  // ── Half Marathon Ladder (14 tiers) ──────────────────────────────────────
  { id: 'half_half_starter',   icon: '🌓', name: 'HALF STARTER',    group: 'ladder', family: 'half', tier: 1,  description: 'Half under 2:30.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 9000 } },
  { id: 'half_finding_flow',   icon: '🌓', name: 'FINDING FLOW',    group: 'ladder', family: 'half', tier: 2,  description: 'Half under 2:20.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 8400 } },
  { id: 'half_built_engine',   icon: '🌓', name: 'BUILT ENGINE',    group: 'ladder', family: 'half', tier: 3,  description: 'Half under 2:10.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 7800 } },
  { id: 'half_strong_hold',    icon: '🌓', name: 'STRONG HOLD',     group: 'ladder', family: 'half', tier: 4,  description: 'Half under 2:00.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 7200 } },
  { id: 'half_pace_driver',    icon: '🌓', name: 'PACE DRIVER',     group: 'ladder', family: 'half', tier: 5,  description: 'Half under 1:50.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 6600 } },
  { id: 'half_subtle_shift',   icon: '🌓', name: 'SUBTLE SHIFT',    group: 'ladder', family: 'half', tier: 6,  description: 'Half under 1:45.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 6300 } },
  { id: 'half_double_digits',  icon: '🌓', name: 'DOUBLE DIGITS',   group: 'ladder', family: 'half', tier: 7,  description: 'Half under 1:40.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 6000 } },
  { id: 'half_on_the_edge',    icon: '🌓', name: 'ON THE EDGE',     group: 'ladder', family: 'half', tier: 8,  description: 'Half under 1:35.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 5700 } },
  { id: 'half_half_elite',     icon: '🌓', name: 'HALF ELITE',      group: 'ladder', family: 'half', tier: 9,  description: 'Half under 1:30.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 5400 } },
  { id: 'half_sharp_operator', icon: '🌓', name: 'SHARP OPERATOR',  group: 'ladder', family: 'half', tier: 10, description: 'Half under 1:25.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 5100 } },
  { id: 'half_speed_endurance',icon: '🌓', name: 'SPEED ENDURANCE', group: 'ladder', family: 'half', tier: 11, description: 'Half under 1:20.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 4800 } },
  { id: 'half_precision_runner',icon:'🌓', name: 'PRECISION RUNNER',group: 'ladder', family: 'half', tier: 12, description: 'Half under 1:15.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 4500 } },
  { id: 'half_top_tier',       icon: '🌓', name: 'TOP TIER',        group: 'ladder', family: 'half', tier: 13, description: 'Half under 1:05.',  check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 3900 } },
  { id: 'half_unreal_territory',icon:'🌓', name: 'UNREAL TERRITORY',group: 'ladder', family: 'half', tier: 14, description: 'Half under 60 min.', check: r => { const pb = getPBSecsForDist(r, 20, 23); return pb !== null && pb < 3600 } },

  // ── Marathon Ladder (15 tiers) ────────────────────────────────────────────
  { id: 'marathon_first_marathoner', icon: '🏛️', name: 'FIRST MARATHONER', group: 'ladder', family: 'marathon', tier: 1,  description: 'Marathon under 5:00.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 18000 } },
  { id: 'marathon_settling_in',      icon: '🏛️', name: 'SETTLING IN',      group: 'ladder', family: 'marathon', tier: 2,  description: 'Marathon under 4:30.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 16200 } },
  { id: 'marathon_sub4_club',        icon: '🏛️', name: 'SUB-4 CLUB',       group: 'ladder', family: 'marathon', tier: 3,  description: 'Marathon under 4:00.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 14400 } },
  { id: 'marathon_rising_standard',  icon: '🏛️', name: 'RISING STANDARD',  group: 'ladder', family: 'marathon', tier: 4,  description: 'Marathon under 3:45.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 13500 } },
  { id: 'marathon_serious_runner',   icon: '🏛️', name: 'SERIOUS RUNNER',   group: 'ladder', family: 'marathon', tier: 5,  description: 'Marathon under 3:30.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 12600 } },
  { id: 'marathon_competitive_edge', icon: '🏛️', name: 'COMPETITIVE EDGE', group: 'ladder', family: 'marathon', tier: 6,  description: 'Marathon under 3:15.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 11700 } },
  { id: 'marathon_elite_barrier',    icon: '🏛️', name: 'ELITE BARRIER',    group: 'ladder', family: 'marathon', tier: 7,  description: 'Marathon under 3:00.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 10800 } },
  { id: 'marathon_breaking_limits',  icon: '🏛️', name: 'BREAKING LIMITS',  group: 'ladder', family: 'marathon', tier: 8,  description: 'Marathon under 2:55.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 10500 } },
  { id: 'marathon_precision_pace',   icon: '🏛️', name: 'PRECISION PACE',   group: 'ladder', family: 'marathon', tier: 9,  description: 'Marathon under 2:50.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 10200 } },
  { id: 'marathon_high_performance', icon: '🏛️', name: 'HIGH PERFORMANCE', group: 'ladder', family: 'marathon', tier: 10, description: 'Marathon under 2:45.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 9900 } },
  { id: 'marathon_advanced_tier',    icon: '🏛️', name: 'ADVANCED TIER',    group: 'ladder', family: 'marathon', tier: 11, description: 'Marathon under 2:40.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 9600 } },
  { id: 'marathon_national_level',   icon: '🏛️', name: 'NATIONAL LEVEL',   group: 'ladder', family: 'marathon', tier: 12, description: 'Marathon under 2:35.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 9300 } },
  { id: 'marathon_elite_class',      icon: '🏛️', name: 'ELITE CLASS',      group: 'ladder', family: 'marathon', tier: 13, description: 'Marathon under 2:30.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 9000 } },
  { id: 'marathon_sub_elite',        icon: '🏛️', name: 'SUB-ELITE',        group: 'ladder', family: 'marathon', tier: 14, description: 'Marathon under 2:25.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 8700 } },
  { id: 'marathon_world_class',      icon: '🏛️', name: 'WORLD CLASS',      group: 'ladder', family: 'marathon', tier: 15, description: 'Marathon under 2:20.',  check: r => { const pb = getPBSecsForDist(r, 40, 45); return pb !== null && pb < 8400 } },

  // ── Ultra Ladder (9 tiers — finisher-based, cumulative: higher distance unlocks all lower tiers) ──
  { id: 'ultra_50k_initiate',      icon: '🏔️', name: 'ULTRA INITIATE',  group: 'ladder', family: 'ultra', tier: 1, description: 'Any running finish ≥ 50K (45 km+).',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 45, 99999) !== null },
  { id: 'ultra_50m_iron_legs',     icon: '🏔️', name: 'IRON LEGS',       group: 'ladder', family: 'ultra', tier: 2, description: 'Any running finish ≥ 50 Miles (75 km+).',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 75, 99999) !== null },
  { id: 'ultra_100k_century',      icon: '🏔️', name: 'CENTURY RUNNER',  group: 'ladder', family: 'ultra', tier: 3, description: 'Any running finish ≥ 100K (99 km+), or 100K cumulative split in a longer race.',
    check: r => {
      const running = r.filter(isRunningRace)
      if (getPBSecsForDist(running, 99, 99999) !== null) return true
      // 100K split recorded in a longer race (cumulative time present)
      return running.some(race => {
        const distKm = distToKm(race.distance)
        if (!isFinite(distKm) || distKm <= 101) return false
        const split100k = race.splits?.find(s => (s.label ?? '').toUpperCase() === '100K')
        return !!split100k?.cumulative && parseHMS(split100k.cumulative) !== null
      })
    } },
  { id: 'ultra_100m_centurion',    icon: '🏔️', name: 'CENTURION',       group: 'ladder', family: 'ultra', tier: 4, description: 'Any running finish ≥ 100 Miles (155 km+).',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 155, 99999) !== null },
  { id: 'ultra_135m_desert_soul',  icon: '🏔️', name: 'DESERT SOUL',     group: 'ladder', family: 'ultra', tier: 5, description: 'Any running finish ≥ 135 Miles (217.26 km+). Badwater territory.',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 217, 99999) !== null },
  { id: 'ultra_200m_double_century',icon:'🏔️', name: 'DOUBLE CENTURY',  group: 'ladder', family: 'ultra', tier: 6, description: 'Any running finish ≥ 200 Miles (321.87 km+).',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 321, 99999) !== null },
  { id: 'ultra_240m_spine_walker', icon: '🏔️', name: 'SPINE WALKER',    group: 'ladder', family: 'ultra', tier: 7, description: 'Any running finish ≥ 240 Miles (386.24 km+).',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 386, 99999) !== null },
  { id: 'ultra_250m_iron_will',    icon: '🏔️', name: 'IRON WILL',       group: 'ladder', family: 'ultra', tier: 8, description: 'Any running finish ≥ 250 Miles (402.34 km+).',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 402, 99999) !== null },
  { id: 'ultra_300m_transcendent', icon: '🏔️', name: 'TRANSCENDENT',    group: 'ladder', family: 'ultra', tier: 9, description: 'Any running finish ≥ 300 Miles (482.8 km+). Beyond what most humans consider possible.',
    check: r => getPBSecsForDist(r.filter(isRunningRace), 482, 99999) !== null },

  // ── 70.3 Ladder (7 tiers) ─────────────────────────────────────────────────
  { id: 'tri703_finisher',         icon: '🔱', name: '70.3 FINISHER',    group: 'ladder', family: 'tri703', tier: 0, description: 'Completed a 70.3 triathlon (113 km).',
    check: r => r.some(x => isTriRace(x) && distToKm(x.distance) >= 112 && distToKm(x.distance) <= 114 && !!x.time),
    findSourceRace: r => r.find(x => isTriRace(x) && distToKm(x.distance) >= 112 && distToKm(x.distance) <= 114 && !!x.time) ?? null,
  },
  { id: 'tri703_half_iron_entry',  icon: '🔱', name: 'HALF IRON ENTRY',  group: 'ladder', family: 'tri703', tier: 1, description: '70.3 under 6:00.',   check: r => { const pb = getPBSecsForDist(r, 112, 114, 'triathlon'); return pb !== null && pb < 21600 } },
  { id: 'tri703_building_strength',icon: '🔱', name: 'BUILDING STRENGTH',group: 'ladder', family: 'tri703', tier: 2, description: '70.3 under 5:30.',   check: r => { const pb = getPBSecsForDist(r, 112, 114, 'triathlon'); return pb !== null && pb < 19800 } },
  { id: 'tri703_iron_control',     icon: '🔱', name: 'IRON CONTROL',     group: 'ladder', family: 'tri703', tier: 3, description: '70.3 under 5:00.',   check: r => { const pb = getPBSecsForDist(r, 112, 114, 'triathlon'); return pb !== null && pb < 18000 } },
  { id: 'tri703_competitive_field',icon: '🔱', name: 'COMPETITIVE FIELD',group: 'ladder', family: 'tri703', tier: 4, description: '70.3 under 4:45.',   check: r => { const pb = getPBSecsForDist(r, 112, 114, 'triathlon'); return pb !== null && pb < 17100 } },
  { id: 'tri703_sharp_execution', icon: '🔱', name: 'SHARP EXECUTION',  group: 'ladder', family: 'tri703', tier: 5, description: '70.3 under 4:30.',   check: r => { const pb = getPBSecsForDist(r, 112, 114, 'triathlon'); return pb !== null && pb < 16200 } },
  { id: 'tri703_elite_amateur',   icon: '🔱', name: 'ELITE AMATEUR',    group: 'ladder', family: 'tri703', tier: 6, description: '70.3 under 4:15.',   check: r => { const pb = getPBSecsForDist(r, 112, 114, 'triathlon'); return pb !== null && pb < 15300 } },
  { id: 'tri703_iron_elite',      icon: '🔱', name: 'IRON ELITE',       group: 'ladder', family: 'tri703', tier: 7, description: '70.3 under 4:00.',   check: r => { const pb = getPBSecsForDist(r, 112, 114, 'triathlon'); return pb !== null && pb < 14400 } },

  // ── Full Ironman Ladder (7 tiers) ─────────────────────────────────────────
  { id: 'ironman_finisher',           icon: '🛡️', name: 'IRONMAN FINISHER', group: 'ladder', family: 'iron', tier: 0, description: 'Completed a full Ironman (226 km).',
    check: r => r.some(x => isTriRace(x) && distToKm(x.distance) >= 225 && distToKm(x.distance) <= 228 && !!x.time),
    findSourceRace: r => r.find(x => isTriRace(x) && distToKm(x.distance) >= 225 && distToKm(x.distance) <= 228 && !!x.time) ?? null,
  },
  { id: 'ironman_full_iron_finisher', icon: '🛡️', name: 'IRON FINISHER',  group: 'ladder', family: 'iron', tier: 1, description: 'Full Ironman under 12:00.', check: r => { const pb = getPBSecsForDist(r, 225, 228, 'triathlon'); return pb !== null && pb < 43200 } },
  { id: 'ironman_full_iron_builder',  icon: '🛡️', name: 'IRON BUILDER',   group: 'ladder', family: 'iron', tier: 2, description: 'Full Ironman under 11:30.', check: r => { const pb = getPBSecsForDist(r, 225, 228, 'triathlon'); return pb !== null && pb < 41400 } },
  { id: 'ironman_full_strong_iron',   icon: '🛡️', name: 'STRONG IRON',    group: 'ladder', family: 'iron', tier: 3, description: 'Full Ironman under 11:00.', check: r => { const pb = getPBSecsForDist(r, 225, 228, 'triathlon'); return pb !== null && pb < 39600 } },
  { id: 'ironman_full_iron_competitor',icon:'🛡️', name: 'IRON COMPETITOR',group: 'ladder', family: 'iron', tier: 4, description: 'Full Ironman under 10:30.', check: r => { const pb = getPBSecsForDist(r, 225, 228, 'triathlon'); return pb !== null && pb < 37800 } },
  { id: 'ironman_full_sub10_club',    icon: '🛡️', name: 'SUB-10 CLUB',    group: 'ladder', family: 'iron', tier: 5, description: 'Full Ironman under 10:00.', check: r => { const pb = getPBSecsForDist(r, 225, 228, 'triathlon'); return pb !== null && pb < 36000 } },
  { id: 'ironman_full_elite_iron',    icon: '🛡️', name: 'ELITE IRON',     group: 'ladder', family: 'iron', tier: 6, description: 'Full Ironman under 9:30.',  check: r => { const pb = getPBSecsForDist(r, 225, 228, 'triathlon'); return pb !== null && pb < 34200 } },
  { id: 'ironman_full_world_tier',    icon: '🛡️', name: 'WORLD TIER',     group: 'ladder', family: 'iron', tier: 7, description: 'Full Ironman under 9:00.',  check: r => { const pb = getPBSecsForDist(r, 225, 228, 'triathlon'); return pb !== null && pb < 32400 } },
]

const LADDER_FAMILIES: Array<{ key: string; label: string; icon: string }> = [
  { key: '10k',      label: '10K',          icon: '10K' },
  { key: 'half',     label: 'HALF MARATHON',icon: '21.1K' },
  { key: 'marathon', label: 'MARATHON',     icon: '42.2K' },
  { key: 'ultra',    label: 'ULTRA',        icon: '50K+' },
  { key: 'tri703', label: '70.3 / Middle Distance', icon: '70.3' },
  { key: 'iron',     label: 'FULL IRONMAN', icon: '140.6' },
]

// World Marathon Majors
const MAJORS = [
  { id: 'tokyo',    name: 'TOKYO' },
  { id: 'boston',   name: 'BOSTON' },
  { id: 'london',   name: 'LONDON' },
  { id: 'berlin',   name: 'BERLIN' },
  { id: 'chicago',  name: 'CHICAGO' },
  { id: 'nyc',      name: 'NEW YORK CITY' },
  { id: 'sydney',   name: 'SYDNEY' },
]

function matchesMajor(race: Race, major: { id: string; name: string }): boolean {
  const nameLower = (race.name ?? '').toLowerCase()
  const cityLower = (race.city ?? '').toLowerCase()
  return nameLower.includes(major.id) || cityLower.includes(major.id) ||
    nameLower.includes(major.name.toLowerCase())
}

// Race Personality traits
function computePersonality(races: Race[]): Array<{ trait: string; score: number; desc: string }> {
  const past = races.filter(r => r.date <= new Date().toISOString().split('T')[0])
  const total = past.length

  // STARTER: low fade rate
  const withSplits = past.filter(r => (r.splits ?? []).length >= 2)
  let fadeCount = 0
  for (const r of withSplits) {
    const s = (r.splits ?? []).filter(x => x.split)
    if (s.length < 2) continue
    const first = parseHMS(s[0].split!) ?? 0
    const last  = parseHMS(s[s.length - 1].split!) ?? 0
    if (last > first * 1.02) fadeCount++
  }
  const fadeRate = withSplits.length > 0 ? fadeCount / withSplits.length : 0
  const starterScore = Math.round((1 - fadeRate) * 100)

  // DIESEL: proportion of long races
  const longRaces = past.filter(r => distToKm(r.distance) >= 21).length
  const dieselScore = total > 0 ? Math.min(100, Math.round((longRaces / total) * 100 + (total >= 3 ? 35 : 0))) : 0

  // BIG-DAY PERFORMER: PBs + race count milestones
  const majorMatches = past.filter(r => MAJORS.some(m => matchesMajor(r, m))).length
  const pbCount = buildPBByDist(past).length
  const bigDayScore = Math.min(100, majorMatches * 20 + pbCount * 10)

  return [
    { trait: 'STARTER',           score: starterScore, desc: `${fadeRate === 0 ? '0' : Math.round(fadeRate * 100)}% fade rate suggests how often early effort stays under control.` },
    { trait: 'DIESEL',            score: dieselScore,  desc: `${longRaces} longer races and a consistency score of ${starterScore} point to durable endurance.` },
    { trait: 'BIG-DAY PERFORMER', score: bigDayScore,  desc: `${majorMatches} majors logged and ${pbCount} personal-best categories banked.` },
  ]
}

// ─── Athlete Hero Card ────────────────────────────────────────────────────────

function AthleteHero({ onEdit }: { onEdit: () => void }) {
  const athlete = useAthleteStore(selectAthlete)
  const races   = useRaceStore(selectRaces)
  const units   = useUnits()
  const nextRace = useRaceStore(selectNextRace)
  const { user } = useUser()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [copyToast, setCopyToast] = useState(false)

  function showCopyToast() {
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 2500)
  }

  const initials = useMemo(() => {
    const f = athlete?.firstName?.slice(0, 1) ?? ''
    const l = athlete?.lastName?.slice(0, 1) ?? ''
    return (f + l).toUpperCase() || '?'
  }, [athlete])

  // Clerk's default `imageUrl` is its initials avatar. Treat it as "no
  // photo" so we keep our own monogram (matches the dossier export).
  // Real uploads come back from Clerk's CDN at *.clerk.accounts.dev or
  // images.clerk.dev, never the gravatar/initials fallback host.
  const hasPhoto = !!user?.hasImage && !!user?.imageUrl

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large — must be under 10 MB')
      return
    }
    setUploading(true)
    try {
      await user.setProfileImage({ file })
      // Clerk re-issues user via reactive `useUser()` hook on success.
    } catch (err) {
      console.warn('[Profile] photo upload failed', err)
      alert('Could not upload photo. Try a different image.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const fullName = athlete
    ? [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || 'Athlete'
    : 'Athlete'

  const sportCity = [athlete?.mainSport, [athlete?.city, athlete?.country].filter(Boolean).join(', ')]
    .filter(Boolean).join(' · ')

  const level    = athleteLevel(races.length)
  const years    = yearsActive(races)
  const rawKm    = totalKm(races)
  const dist     = Math.round(units === 'imperial' ? rawKm * 0.621371 : rawKm)
  const ctrCount = uniqueCountries(races).length

  const stats = [
    { label: 'Races',                   value: races.length.toString() },
    { label: `Total ${distUnit(units)}`, value: dist.toLocaleString() },
    { label: 'Countries', value: ctrCount.toString() },
    { label: 'Years',    value: years.toString() },
  ]

  const ag = ageGroup(athlete?.dob, athlete?.gender)
  const age = computeAge(athlete?.dob)

  const clubs = athlete?.clubs?.length
    ? athlete.clubs
    : athlete?.club
      ? athlete.club.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean)
      : []

  return (
    <>
    <div style={st.heroCard}>
      {/* Avatar row */}
      <div style={st.avatarRow}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label={hasPhoto ? 'Change profile photo' : 'Upload profile photo'}
          style={{
            ...st.avatar,
            padding: 0,
            cursor: uploading ? 'wait' : 'pointer',
            background: hasPhoto ? 'transparent' : 'var(--surface3)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {hasPhoto ? (
            <img
              src={user.imageUrl}
              alt={[athlete?.firstName, athlete?.lastName].filter(Boolean).join(' ') || 'Profile'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span style={st.avatarInitials}>{initials}</span>
          )}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '22px',
              height: '22px',
              borderRadius: 'var(--radius-round)',
              background: 'var(--orange)',
              color: '#000',
              fontSize: 'var(--text-xs)',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--black)',
              pointerEvents: 'none',
            }}
            title="Upload photo"
          >
            {uploading ? '…' : '+'}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handlePhotoChange}
          style={{ display: 'none' }}
        />
        <div style={st.avatarInfo}>
          <div style={st.athleteName}>{fullName}</div>
          {sportCity && <div style={st.athleteSub}>{sportCity}</div>}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginTop: '4px' }}>
            <span style={st.levelBadge}>{level}</span>
            {age !== null && <span style={st.levelBadge}>{age}yr{ag ? ` · ${ag}` : ''}</span>}
          </div>
        </div>
        <button style={st.editBtnSmall} onClick={onEdit}>✎ EDIT</button>
      </div>

      {/* Stats row */}
      <div style={st.heroStats}>
        {stats.map(s => (
          <div key={s.label} style={st.heroStatCell}>
            <div style={st.heroStatValue}>{s.value}</div>
            <div style={st.heroStatLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Countries raced — flag image + name */}
      {(() => {
        const ctrs = uniqueCountries(races)
        if (!ctrs.length) return null
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            {ctrs.map(c => {
              const flagUrl = countryFlagUrl(c)
              const abbr = countryToISO3(c)
              return (
                <span key={c} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)',
                  background: 'var(--surface3)', border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius-md)', padding: '5px 10px',
                }}>
                  {flagUrl && (
                    <img
                      src={flagUrl}
                      alt={c}
                      width={20}
                      height={15}
                      style={{ display: 'block', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}
                    />
                  )}
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.08em', color: 'var(--white)', lineHeight: 1 }}>{abbr}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1, fontFamily: 'var(--body)' }}>{c}</span>
                  </span>
                </span>
              )
            })}
          </div>
        )
      })()}

      {/* Bio + clubs */}
      {(athlete?.bio || clubs.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {athlete?.bio && (
            <div style={{
              fontSize: 'var(--text-compact)',
              color: 'rgba(245,245,245,0.72)',
              lineHeight: 1.65,
              borderLeft: '3px solid rgba(var(--orange-ch), 0.4)',
              paddingLeft: '12px',
            }}>
              {athlete.bio}
            </div>
          )}
          {clubs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {clubs.map(c => (
                <span key={c} style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: 'rgba(var(--orange-ch), 0.1)',
                  border: '1px solid rgba(var(--orange-ch), 0.25)',
                  borderRadius: 'var(--radius-pill)', padding: '4px 12px',
                  fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)',
                  fontWeight: 700, letterSpacing: '0.06em',
                  color: 'var(--orange)',
                }}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Focus race */}
      {nextRace && (() => {
        const days = daysUntil(nextRace.date)
        return (
          <div style={st.focusCard}>
            <div style={st.focusLabel}>FOCUS RACE</div>
            <div style={st.focusName}>{nextRace.name}</div>
            <div style={st.focusMeta}>{distLabel(nextRace.distance)} · {fmtDate(nextRace.date)}</div>
            <div style={st.focusDays}>{days === 0 ? 'TODAY' : `${days} days away`}</div>
          </div>
        )
      })()}

      {/* Action buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: athlete?.username && athlete?.isPublic ? '1fr 1fr' : '1fr',
        gap: 'var(--sp-2)',
      }}>
        {athlete?.username && athlete?.isPublic && (
          <button
            style={{
              background: 'rgba(var(--orange-ch), 0.12)',
              border: '1px solid rgba(var(--orange-ch), 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--orange)',
              padding: '10px 16px',
              fontFamily: 'var(--headline)',
              fontWeight: 700,
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
            onClick={() => {
              const url = `${APP_URL}/u/${athlete.username}`
              navigator.clipboard.writeText(url).then(() => showCopyToast()).catch(() => showCopyToast())
            }}
          >
            Share Profile ↗
          </button>
        )}
      </div>
    </div>
    {copyToast && createPortal(
      <div style={{
        position: 'fixed', bottom: 'calc(var(--safe-bottom, 0px) + 80px)', left: '50%',
        transform: 'translateX(-50%)', zIndex: 2000,
        background: 'var(--surface3)', border: '1px solid rgba(var(--orange-ch),0.5)',
        color: 'var(--orange)', borderRadius: 'var(--radius-pill)', padding: '10px 20px',
        fontSize: 'var(--text-sm)', fontFamily: 'var(--headline)', fontWeight: 700,
        letterSpacing: '0.06em', whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        Link copied ✓
      </div>,
      document.body
    )}
    </>
  )
}

// ─── Community medals ─────────────────────────────────────────────────────────

const COMM_CACHE_TTL = 5 * 60 * 1000 // 5 min

/** Matches V1 getRaceKey: slug from race name + year */
function getRaceKey(race: Race): string {
  const year = (race.date || '').slice(0, 4)
  const slug = (race.name || '')
    .replace(/\s+\d{4}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return year ? `${slug}-${year}` : slug
}

/** Returns map of raceKey → photo_url loaded from race_medal_photos table. */
function useCommunityMedals(raceKeys: string[]): Record<string, string> {
  const [photos, setPhotos] = useState<Record<string, string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('fl2_comm_medals') ?? 'null')
      if (raw && typeof raw === 'object' && Date.now() - (raw.ts ?? 0) < COMM_CACHE_TTL) {
        return raw.data ?? {}
      }
    } catch { /* ignore */ }
    return {}
  })
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!raceKeys.length || fetchedRef.current) return
    // Check cache freshness
    try {
      const raw = JSON.parse(localStorage.getItem('fl2_comm_medals') ?? 'null')
      if (raw && typeof raw === 'object' && Date.now() - (raw.ts ?? 0) < COMM_CACHE_TTL) return
    } catch { /* ignore */ }
    fetchedRef.current = true
    supabase
      .from('race_medal_photos')
      .select('race_key, variant, photo_url')
      .in('race_key', raceKeys)
      .then(({ data, error }) => {
        if (error || !data) return
        const map: Record<string, string> = {}
        data.forEach(row => {
          const k = row.variant ? `${row.race_key}::${row.variant}` : row.race_key
          map[k] = row.photo_url
        })
        setPhotos(map)
        localStorage.setItem('fl2_comm_medals', JSON.stringify({ ts: Date.now(), data: map }))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceKeys.join(',')])

  return photos
}

// ─── Medal Wall ───────────────────────────────────────────────────────────────

const MEDAL_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  gold:     { bg: 'rgba(var(--gold-ch),0.12)', border: 'rgba(var(--gold-ch),0.35)', text: 'var(--gold-a)', label: 'GOLD' },
  silver:   { bg: 'rgba(200,212,220,0.12)', border: 'rgba(200,212,220,0.35)', text: '#C8D4DC', label: 'SILVER' },
  bronze:   { bg: 'rgba(205,140,90,0.12)',  border: 'rgba(205,140,90,0.35)',  text: '#CD8C5A', label: 'BRONZE' },
  finisher: { bg: 'rgba(var(--orange-ch),0.10)', border: 'rgba(var(--orange-ch),0.3)', text: 'var(--orange)', label: 'FINISHER' },
}

type MedalTier = 'gold' | 'silver' | 'bronze' | 'finisher'

function medalTier(medal: string): MedalTier {
  const m = medal.toLowerCase()
  if (m === 'gold')     return 'gold'
  if (m === 'silver')   return 'silver'
  if (m === 'bronze')   return 'bronze'
  return 'finisher'
}

function MedalWall() {
  const races  = useRaceStore(selectRaces)
  const [showAll, setShowAll] = useState(false)

  const medalRaces = useMemo(
    () => {
      const rank: Record<string, number> = { gold: 0, silver: 1, bronze: 2, finisher: 3 }
      return races
        .filter(r => r.medal && r.medal !== '')
        .sort((a, b) => {
          const ra = rank[(a.medal ?? '').toLowerCase()] ?? 99
          const rb = rank[(b.medal ?? '').toLowerCase()] ?? 99
          if (ra !== rb) return ra - rb
          return b.date.localeCompare(a.date)
        })
    },
    [races],
  )
  const visibleMedalRaces = showAll ? medalRaces : medalRaces.slice(0, 6)

  // PB map so we can show shimmer on PB races
  const pbMap = useMemo(() => {
    const map: Record<string, string> = {} // distance → best time
    for (const r of races) {
      if (!r.time || !r.distance) continue
      if (r.outcome && r.outcome !== 'Finished') continue
      const rs = parseTimeToSecs(r.time)
      if (rs == null) continue
      if (!map[r.distance] || rs < (parseTimeToSecs(map[r.distance]) ?? Infinity)) map[r.distance] = r.time
    }
    return map
  }, [races])

  // Community photos — keyed by raceKey (or raceKey::variant for Comrades)
  const raceKeys = useMemo(() => medalRaces.map(getRaceKey), [medalRaces])
  const communityPhotos = useCommunityMedals(raceKeys)

  const tierCounts = useMemo(() => {
    const counts: Record<MedalTier, number> = { gold: 0, silver: 0, bronze: 0, finisher: 0 }
    for (const r of medalRaces) {
      const tier = medalTier(r.medal!)
      counts[tier]++
    }
    return counts
  }, [medalRaces])

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 style={st.sectionTitle}>MEDALS</h2>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      {medalRaces.length === 0 ? (
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>★</div>
          <div style={st.emptyText}>Your medal wall is empty. Log a race with a medal to start your collection.</div>
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="medal-row" style={{ marginBottom: '14px' }}>
            {(Object.keys(MEDAL_COLORS) as (keyof typeof MEDAL_COLORS)[]).map(tier => {
              const count = tierCounts[tier as keyof typeof tierCounts]
              if (count === 0) return null
              const col = MEDAL_COLORS[tier]
              return (
                <div key={tier} className={`medal-chip medal-${tier}`} style={{ padding: '6px 14px', fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <span style={{ fontWeight: 900, fontSize: 'var(--text-compact)', lineHeight: 1 }}>{count}</span>
                  <span>{col.label}</span>
                </div>
              )
            })}
          </div>

          {/* Medal grid — 6 most recent by default, expand for the rest */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-2)' }}>
            {visibleMedalRaces.map(r => {
              const tier  = medalTier(r.medal!)
              const col   = MEDAL_COLORS[tier]
              const isPB  = r.time && r.distance && pbMap[r.distance] === r.time
              // Personal upload first; community photo as fallback
              const communityUrl = communityPhotos[getRaceKey(r)] ?? null
              const displayPhoto = r.medalPhoto || communityUrl
              const hasPhoto = !!displayPhoto

              return (
                <div
                  key={r.id}
                  style={{
                    background: hasPhoto ? 'transparent' : col.bg,
                    border: `1px solid ${isPB ? col.border : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    // PB shimmer via box-shadow glow
                    boxShadow: isPB ? `0 0 0 1px ${col.border}, 0 0 16px ${col.bg}` : undefined,
                  }}
                >
                  {/* Medal photo — personal upload or community fallback */}
                  {hasPhoto && (
                    <img
                      src={displayPhoto!}
                      alt={r.name}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, mixBlendMode: 'multiply' }}
                    />
                  )}

                  <div style={{ padding: 'var(--sp-4)', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', flex: 1 }}>
                    {/* Tier badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: col.text }}>
                        {col.label}
                      </span>
                      {isPB && (
                        <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: col.text, background: col.bg, border: `1px solid ${col.border}`, borderRadius: 'var(--radius-pill)', padding: '2px 7px' }}>
                          PB
                        </span>
                      )}
                    </div>

                    {/* Race name */}
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>

                    {/* Meta */}
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
                      {[distLabel(r.distance), r.time].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                      {r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                      {r.city ? ` · ${r.city}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* View more / less toggle */}
          {medalRaces.length > 6 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
              <button
                onClick={() => setShowAll(v => !v)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--muted)',
                  padding: '8px 18px',
                  fontFamily: 'var(--headline)',
                  fontWeight: 700,
                  fontSize: 'var(--text-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {showAll ? 'View Less' : `View More (${medalRaces.length - 6})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Achievements Section ─────────────────────────────────────────────────────

function AchievementsSection() {
  const races   = useRaceStore(selectRaces)
  const athlete = useAthleteStore(selectAthlete)
  const [popup, setPopup] = useState<Achievement | null>(null)

  const unlocked = useMemo(
    () => ACHIEVEMENTS.filter(a => a.check(races, athlete)),
    [races, athlete],
  )

  const unlockedIds = new Set(unlocked.map(a => a.id))
  const specialAll  = ACHIEVEMENTS.filter(a => a.group === 'special')
  const recentPills = unlocked.filter(a => a.group === 'special').slice(-3).reverse()

  // For each ladder family, find highest unlocked tier
  const ladderStatus = useMemo(() => {
    const out: Record<string, { highest: Achievement | null; unlockedCount: number; total: number }> = {}
    for (const fam of LADDER_FAMILIES) {
      const tiers = ACHIEVEMENTS.filter(a => a.family === fam.key).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))
      const unlockedTiers = tiers.filter(a => unlockedIds.has(a.id))
      out[fam.key] = {
        highest: unlockedTiers.length > 0 ? unlockedTiers[unlockedTiers.length - 1] : null,
        unlockedCount: unlockedTiers.length,
        total: tiers.length,
      }
    }
    return out
  }, [unlockedIds])

  // Popup source race
  const popupRace = useMemo(() => {
    if (!popup?.findSourceRace) return null
    return popup.findSourceRace(races, athlete)
  }, [popup, races, athlete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Hero achievement card */}
      <div style={st.achievementHero}>
        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(var(--green-ch), 0.6)', textTransform: 'uppercase', marginBottom: '8px' }}>
          YOUR ACHIEVEMENTS
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)', marginBottom: '10px' }}>
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '56px', color: 'var(--white)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {unlocked.length}
          </span>
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            OF {ACHIEVEMENTS.length} UNLOCKED
          </span>
        </div>
        <div style={{ fontSize: 'var(--text-compact)', color: 'rgba(245,245,245,0.55)', lineHeight: 1.55, marginBottom: '16px', maxWidth: '340px' }}>
          Track special race moments, milestone ladders, and major-event progress from one synced wall.
        </div>
        {recentPills.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {recentPills.map(a => (
              <div key={a.id} style={st.achievementPill}>
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Special achievements grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: '12px 0 10px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            SPECIAL ACHIEVEMENTS
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700 }}>
            {unlocked.filter(a => a.group === 'special').length}/{specialAll.length}
          </span>
        </div>
        <div style={{ ...st.achievementGrid, marginTop: '12px' }}>
          {specialAll.map(a => {
            const isUnlocked = unlockedIds.has(a.id)
            return (
              <div
                key={a.id}
                onClick={() => setPopup(a)}
                style={{ ...st.achievementTile, cursor: 'pointer', opacity: isUnlocked ? 1 : 0.5, borderColor: isUnlocked ? 'rgba(var(--green-ch),0.35)' : 'var(--border)', borderTopWidth: isUnlocked ? '2px' : '1px' }}
              >
                <div style={st.achievementName}>{a.name}</div>
                <div style={{ ...st.achievementStatus, background: isUnlocked ? 'rgba(var(--green-ch), 0.1)' : 'var(--surface)', color: isUnlocked ? 'var(--green)' : 'var(--muted)' }}>
                  {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Performance Ladders */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: '12px 0 10px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            PERFORMANCE LADDERS
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: '12px' }}>
          {LADDER_FAMILIES.map(fam => {
            const status = ladderStatus[fam.key]
            const tiers = ACHIEVEMENTS.filter(a => a.family === fam.key).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))
            return (
              <div key={fam.key} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--orange)', background: 'rgba(var(--orange-ch),0.12)', border: '1px solid rgba(var(--orange-ch),0.25)', borderRadius: 'var(--radius-xs)', padding: '3px 7px', whiteSpace: 'nowrap' }}>{fam.icon}</span>
                    <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
                      {fam.label}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', color: status?.highest ? 'var(--orange)' : 'var(--muted)' }}>
                    {status?.highest ? status.highest.name : 'NOT STARTED'}
                  </span>
                </div>
                {/* Tier progress dots */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {tiers.map(t => {
                    const isUnlocked = unlockedIds.has(t.id)
                    const isHighest = status?.highest?.id === t.id
                    return (
                      <div
                        key={t.id}
                        onClick={() => setPopup(t)}
                        title={t.name}
                        style={{
                          flex: 1, height: '6px', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
                          background: isHighest ? 'var(--orange)' : isUnlocked ? 'rgba(var(--orange-ch),0.4)' : 'var(--surface3)',
                          transition: 'background 0.2s',
                        }}
                      />
                    )
                  })}
                </div>
                {status?.highest && (
                  <div style={{ marginTop: '8px', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    {status.highest.description}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Achievement popup — portal so it renders above bottom nav */}
      {popup && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setPopup(null)}
        >
          <div
            style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-pill) var(--radius-pill) 0 0', padding: '28px 24px 32px', width: '100%', maxHeight: '75vh', overflowY: 'auto', borderTop: '1px solid var(--border2)', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div style={{ width: '40px', height: '4px', background: 'var(--border2)', borderRadius: 'var(--radius-xs)', margin: '0 auto 24px' }} />
            {/* Header — centered */}
            <div style={{ textAlign: 'center', marginBottom: '20px', position: 'relative' }}>
              <button onClick={() => setPopup(null)} style={{ position: 'absolute', right: 0, top: 0, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 'var(--text-xl)', cursor: 'pointer', padding: 'var(--sp-1)', lineHeight: 1 }}>×</button>
              <div style={{ width: '72px', height: '72px', margin: '0 auto 16px', background: 'rgba(var(--orange-ch),0.12)', border: '2px solid rgba(var(--orange-ch),0.4)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AchievementSVGIcon a={popup} size={32} />
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xl)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: '6px' }}>
                {popup.name}
              </div>
              <div style={{ fontSize: 'var(--text-compact)', color: 'rgba(245,245,245,0.65)', lineHeight: 1.6 }}>
                {popup.description}
              </div>
            </div>
            {unlockedIds.has(popup.id) ? (
              <div style={{ background: 'rgba(var(--green-ch),0.08)', border: '1px solid rgba(var(--green-ch),0.25)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.1em', color: 'var(--green)', marginBottom: popupRace ? '10px' : 0 }}>
                  ✓ UNLOCKED
                </div>
                {popupRace && (() => {
                  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  const d = new Date((popupRace.date ?? '') + 'T00:00:00')
                  const dateStr = !isNaN(d.getTime()) ? `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : popupRace.date ?? ''
                  const locParts = [popupRace.city, popupRace.country ? countryToISO3(popupRace.country) : ''].filter(Boolean)
                  const loc = locParts.join(', ')
                  return (
                    <div>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--white)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                        {popupRace.name}
                      </div>
                      {loc && <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(245,245,245,0.65)' }}>{loc}</div>}
                      {dateStr && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>{dateStr}</div>}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                  NOT YET UNLOCKED
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Personal Bests ───────────────────────────────────────────────────────────

const SPORT_ACCENT: Record<string, { color: string; bg: string; glow: string }> = {
  Running:   { color: 'var(--green)', bg: 'rgba(var(--green-ch),0.06)',   glow: 'rgba(var(--green-ch),0.10)' },
  Triathlon: { color: 'var(--purple)', bg: 'rgba(var(--purple-ch),0.08)',  glow: 'rgba(var(--purple-ch),0.10)' },
  Cycling:   { color: '#38BDF8', bg: 'rgba(56,189,248,0.07)',  glow: 'rgba(56,189,248,0.10)' },
  Swimming:  { color: '#22D3EE', bg: 'rgba(34,211,238,0.07)',  glow: 'rgba(34,211,238,0.10)' },
  HYROX:     { color: '#FB923C', bg: 'rgba(251,146,60,0.07)',  glow: 'rgba(251,146,60,0.10)' },
}

function PersonalBests() {
  const races = useRaceStore(selectRaces)
  const allPbs = useMemo(() => buildPBByDist(races), [races])
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => readPBHiddenKeys())
  const [showConfig, setShowConfig] = useState(false)

  const visiblePbs = useMemo(
    () => allPbs.filter(pb => !hiddenKeys.has(pb.key)),
    [allPbs, hiddenKeys],
  )

  function toggleKey(key: string) {
    setHiddenKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      savePBHiddenKeys(next)
      return next
    })
  }

  // Group visible PBs by sport for display
  const groupedVisible = useMemo(() => {
    const groups: Record<string, typeof visiblePbs> = {}
    for (const pb of visiblePbs) {
      const sport = PB_KEY_SPORT.get(pb.key) ?? 'Running'
      if (!groups[sport]) groups[sport] = []
      groups[sport].push(pb)
    }
    return groups
  }, [visiblePbs])

  // Group ALL pbs by sport for config popup
  const groupedAll = useMemo(() => {
    const groups: Record<string, typeof allPbs> = {}
    for (const pb of allPbs) {
      const sport = PB_KEY_SPORT.get(pb.key) ?? 'Running'
      if (!groups[sport]) groups[sport] = []
      groups[sport].push(pb)
    }
    return groups
  }, [allPbs])

  if (allPbs.length === 0) {
    return (
      <div style={st.section}>
        <h2 style={st.sectionTitle}>PERSONAL BESTS</h2>
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>⏱</div>
          <div style={st.emptyText}>No PBs yet. Log a timed race to start tracking.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={st.section}>
      {/* Header row with settings icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={st.sectionTitle}>PERSONAL BESTS</h2>
        <button
          onClick={() => setShowConfig(true)}
          style={{
            background: 'none', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-sm)', padding: '4px 8px',
            color: 'var(--muted)', cursor: 'pointer',
            fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700,
            letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          EDIT
        </button>
      </div>

      {/* PBs grouped by sport */}
      {PB_SPORT_ORDER.filter(sport => groupedVisible[sport]?.length > 0).map(sport => {
        const accent = SPORT_ACCENT[sport] ?? SPORT_ACCENT.Running
        const group = groupedVisible[sport]
        return (
          <div key={sport} style={{ marginBottom: '16px' }}>
            <div style={{
              fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: accent.color, opacity: 0.7,
              marginBottom: '8px', paddingLeft: '2px',
            }}>
              {sport}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', minWidth: 0 }}>
              {group.map(({ key, label, race }) => (
                <div
                  key={key}
                  style={{
                    background: `linear-gradient(145deg, #141414 0%, ${accent.bg} 100%)`,
                    border: '1px solid var(--border2)',
                    borderLeft: `3px solid ${accent.color}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 14px 12px',
                    boxShadow: `inset 0 1px 0 ${accent.glow}, 0 4px 20px rgba(0,0,0,0.4)`,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: 'var(--headline)', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1, marginBottom: '8px', color: accent.color }}>
                    {race.time}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={race.name}>
                    {race.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Config popup */}
      {showConfig && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowConfig(false)}
        >
          <div
            style={{ width: '100%', maxHeight: '75vh', background: 'var(--surface2)', borderRadius: 'var(--radius-pill) var(--radius-pill) 0 0', borderTop: '1px solid var(--border2)', padding: '16px 20px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: 'var(--border2)', borderRadius: 'var(--radius-xs)', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: '4px' }}>
              PERSONAL BESTS
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: '20px' }}>
              Toggle which distances appear on your profile.
            </div>

            {PB_SPORT_ORDER.filter(sport => groupedAll[sport]?.length > 0).map(sport => {
              const accent = SPORT_ACCENT[sport] ?? SPORT_ACCENT.Running
              return (
                <div key={sport} style={{ marginBottom: '18px' }}>
                  <div style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent.color, opacity: 0.8, marginBottom: '10px' }}>
                    {sport}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    {groupedAll[sport].map(({ key, label, race }) => {
                      const isVisible = !hiddenKeys.has(key)
                      return (
                        <div
                          key={key}
                          onClick={() => toggleKey(key)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--surface3)', border: `1px solid ${isVisible ? accent.color + '44' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)', padding: '10px 12px', cursor: 'pointer',
                            opacity: isVisible ? 1 : 0.45,
                          }}
                        >
                          <div>
                            <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)', color: isVisible ? 'var(--white)' : 'var(--muted)' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>
                              {race.time} · {race.name}
                            </div>
                          </div>
                          {/* Toggle pill */}
                          <div style={{
                            width: '40px', height: '22px', borderRadius: 'var(--radius-lg)',
                            background: isVisible ? accent.color : 'var(--border2)',
                            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                          }}>
                            <div style={{
                              position: 'absolute', top: '3px',
                              left: isVisible ? '21px' : '3px',
                              width: '16px', height: '16px', borderRadius: 'var(--radius-round)',
                              background: isVisible ? '#000' : 'var(--muted)',
                              transition: 'left 0.2s',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <button
              onClick={() => setShowConfig(false)}
              style={{ width: '100%', padding: 'var(--sp-4)', background: 'var(--orange)', border: 'none', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.08em', color: '#000', cursor: 'pointer', marginTop: '4px' }}
            >
              DONE
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Signature Distances ──────────────────────────────────────────────────────

function SignatureDistances() {
  const races   = useRaceStore(selectRaces)
  const athlete = useAthleteStore(selectAthlete)

  const age    = useMemo(() => computeAge(athlete?.dob), [athlete?.dob])
  const gender = athlete?.gender

  const top = useMemo(
    () => computeSignatureDistances(races, gender, age),
    [races, gender, age],
  )

  if (top.length === 0) {
    return (
      <div style={st.section}>
        <h2 style={st.sectionTitle}>SIGNATURE DISTANCES</h2>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Log a few more timed races to see which distances are becoming your signature.
        </div>
      </div>
    )
  }

  const rankColors = ['var(--orange)', 'var(--white)', 'var(--muted)']

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: '4px' }}>
        <h2 style={st.sectionTitle}>SIGNATURE DISTANCES</h2>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: '12px', fontFamily: 'var(--headline)', fontWeight: 600, letterSpacing: '0.06em' }}>
        {gender && age ? 'RANKED BY AGE-GRADE WHEN AVAILABLE' : 'RANKED BY PACE / SPEED'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {top.map((item, i) => (
          <div
            key={item.distance}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              background: 'var(--surface2)',
              border: `1px solid ${i === 0 ? 'rgba(var(--orange-ch),0.3)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '12px 14px',
            }}
          >
            <div style={{
              fontFamily: 'var(--headline)',
              fontWeight: 900,
              fontSize: 'var(--text-xl)',
              color: rankColors[i],
              width: '20px',
              flexShrink: 0,
              textAlign: 'center',
              lineHeight: 1,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
                {item.distance}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.race.name ?? ''} · {item.race.time}
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--headline)',
              fontWeight: 800,
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: item.metric === 'age-grade' ? 'var(--orange)' : 'var(--white)',
              flexShrink: 0,
              textAlign: 'right',
            }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Age-Grade Trajectory ─────────────────────────────────────────────────────

function AgeGradeTrajectory() {
  const athlete    = useAthleteStore(selectAthlete)
  const races      = useRaceStore(selectRaces)
  const hasProfile = !!(athlete?.dob && athlete?.gender)
  const age        = useMemo(() => computeAge(athlete?.dob), [athlete?.dob])

  const history = useMemo(
    () => hasProfile ? computeAgeGradeHistory(races, athlete?.gender, age) : [],
    [races, athlete?.gender, age, hasProfile],
  )

  if (!hasProfile) {
    return (
      <div style={st.section}>
        <h2 style={st.sectionTitle}>AGE-GRADE TRAJECTORY</h2>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Add date of birth and gender in profile to see age-grade scores.
        </div>
      </div>
    )
  }

  if (history.length < 2) {
    return (
      <div style={st.section}>
        <h2 style={st.sectionTitle}>AGE-GRADE TRAJECTORY</h2>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Log at least two 5K / 10K / Half / Marathon results to see your age-grade trend.
        </div>
      </div>
    )
  }

  // SVG sparkline
  const W = 300; const H = 56
  const pcts = history.map(h => h.pct)
  const minP = Math.min(...pcts); const maxP = Math.max(...pcts)
  const range = maxP - minP || 1
  const pts = history.map((h, i) => {
    const x = (i / (history.length - 1)) * W
    const y = H - ((h.pct - minP) / range) * (H - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const latestPct = pcts[pcts.length - 1]

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: '4px' }}>
        <h2 style={st.sectionTitle}>AGE-GRADE</h2>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xl)', color: 'var(--orange)', letterSpacing: '0.02em' }}>
          {latestPct.toFixed(1)}%
        </div>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '12px' }}>
        WA ROAD-RACE STANDARD · {history.length} RESULTS
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: `${H}px`, display: 'block', marginBottom: '14px' }}>
        <polyline
          points={pts}
          fill="none"
          stroke="var(--orange)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {history.map((h, i) => {
          const x = (i / (history.length - 1)) * W
          const y = H - ((h.pct - minP) / range) * (H - 8) - 4
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="var(--orange)" />
          )
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {history.slice(-5).reverse().map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--text-xs)' }}>
            <div style={{ color: 'var(--muted)', width: '80px', flexShrink: 0, fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h.raceDate.slice(0, 7)}</div>
            <div style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.distance} · {h.raceName}</div>
            <div style={{ color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-xs)', flexShrink: 0 }}>{h.pct.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Performance Timeline ────────────────────────────────────────────────────

interface TimelineYear {
  year: string
  raceCount: number
  avgSpeedKmh: number
  avgDistKm: number
  metrics: { speed: number; endurance: number; frequency: number }
  labels:  { speed: string; endurance: string; frequency: string }
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function computeTimeline(races: Race[]): TimelineYear[] {
  const byYear: Record<string, Race[]> = {}
  for (const r of races) {
    if (!r.date) continue
    const y = r.date.slice(0, 4)
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(r)
  }
  return Object.entries(byYear)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5)
    .map(([year, yr]) => {
      const timed = yr.filter(r => r.time && r.distance)
      const speeds = timed.map(r => {
        const secs = parseTimeToSecs(r.time)
        const km   = distToKm(r.distance) || 0
        return secs && km ? km / (secs / 3600) : null
      }).filter((v): v is number => v !== null && isFinite(v))

      const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
      const avgDist  = yr.reduce((sum, r) => sum + (distToKm(r.distance) || 0), 0) / yr.length

      return {
        year,
        raceCount: yr.length,
        avgSpeedKmh: avgSpeed,
        avgDistKm: avgDist,
        metrics: {
          speed:     clamp((avgSpeed / 18) * 100),
          endurance: clamp((avgDist  / 50) * 100),
          frequency: clamp((yr.length / 10) * 100),
        },
        labels: {
          speed:     avgSpeed > 0 ? `${Math.round(avgSpeed)} km/h` : '—',
          endurance: avgDist  > 0 ? `${Math.round(avgDist)} km avg` : '—',
          frequency: `${yr.length} race${yr.length !== 1 ? 's' : ''}`,
        },
      }
    })
}

const TIMELINE_METRICS: Array<{ key: keyof TimelineYear['metrics']; label: string }> = [
  { key: 'speed',     label: 'Speed' },
  { key: 'endurance', label: 'Distance' },
  { key: 'frequency', label: 'Races' },
]

function PerformanceTimeline() {
  const races = useRaceStore(selectRaces)
  const timeline = useMemo(() => computeTimeline(races), [races])

  if (timeline.length < 2) {
    return (
      <div style={st.section}>
        <h2 style={st.sectionTitle}>PERFORMANCE TIMELINE</h2>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Log races across two or more seasons to see your performance timeline.
        </div>
      </div>
    )
  }

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: '12px' }}>
        <h2 style={st.sectionTitle}>PERFORMANCE TIMELINE</h2>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {timeline.map(row => (
          <div key={row.year} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '0.04em', color: 'var(--orange)' }}>
              {row.year}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {TIMELINE_METRICS.map(({ key, label }) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 70px', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
                  <div style={{ height: '5px', background: 'var(--surface3)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.metrics[key]}%`, background: 'var(--orange)', borderRadius: 'var(--radius-xs)', transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, color: 'var(--white)', textAlign: 'right' }}>{row.labels[key]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Race Activity Heatmap ────────────────────────────────────────────────────

function RaceActivityHeatmap() {
  const races = useRaceStore(selectRaces)
  const [selectedCell, setSelectedCell] = useState<{ year: number; month: number } | null>(null)

  const months = [0,1,2,3,4,5,6,7,8,9,10,11]
  const MONTH_LABELS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

  // Build race map keyed by YYYY-MM
  const raceMap = useMemo(() => {
    const m: Record<string, Race[]> = {}
    for (const r of races) {
      if (!r.date) continue
      const key = r.date.slice(0, 7) // "YYYY-MM"
      if (!m[key]) m[key] = []
      m[key].push(r)
    }
    return m
  }, [races])

  // Show every year the user has logged a race in, descending (most recent on top).
  // Always include the current year so an empty current year still renders a row.
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const set = new Set<number>([currentYear])
    for (const r of races) {
      if (!r.date) continue
      const y = parseInt(r.date.slice(0, 4), 10)
      if (Number.isFinite(y)) set.add(y)
    }
    return [...set].sort((a, b) => b - a)
  }, [races])

  const selectedKey = selectedCell ? `${selectedCell.year}-${String(selectedCell.month + 1).padStart(2, '0')}` : null
  const selectedRaces = selectedKey ? (raceMap[selectedKey] ?? []) : []

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-md)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
          RACE ACTIVITY
        </div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      <div style={{ background: 'var(--surface3)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', marginTop: '10px' }}>
        {/* Month headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(12, 1fr)', gap: '4px', marginBottom: '6px' }}>
          <div />
          {MONTH_LABELS.map(m => (
            <div key={m} style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--muted)', textAlign: 'center', textTransform: 'uppercase' }}>
              {m}
            </div>
          ))}
        </div>

        {/* Year rows */}
        {years.map(year => (
          <div key={year} style={{ display: 'grid', gridTemplateColumns: '36px repeat(12, 1fr)', gap: '4px', marginBottom: '4px' }}>
            <div style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
              {year}
            </div>
            {months.map(month => {
              const key = `${year}-${String(month + 1).padStart(2, '0')}`
              const count = raceMap[key]?.length ?? 0
              const isSelected = selectedCell?.year === year && selectedCell?.month === month
              const isFuture = new Date(year, month) > new Date()
              return (
                <div
                  key={month}
                  onClick={() => !isFuture && count > 0 && setSelectedCell(isSelected ? null : { year, month })}
                  style={{
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected
                      ? 'var(--green)'
                      : count > 0
                        ? 'rgba(var(--green-ch), 0.5)'
                        : isFuture ? 'rgba(245,245,245,0.03)' : 'var(--surface2)',
                    border: isSelected ? '1px solid var(--green)' : '1px solid transparent',
                    cursor: count > 0 && !isFuture ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {count > 1 && (
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 800, color: isSelected ? '#000' : 'rgba(var(--green-ch), 0.9)' }}>
                      {count}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Selected month details */}
        {selectedCell && selectedRaces.length > 0 && (
          <div style={{ marginTop: '12px', background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-md)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
                {fmtMonthYear(selectedCell.year, selectedCell.month)}
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                {selectedRaces.length} RACE{selectedRaces.length !== 1 ? 'S' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {selectedRaces.sort((a, b) => a.date.localeCompare(b.date)).map(r => (
                <div key={r.id} style={{ background: 'var(--surface3)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.2 }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '3px' }}>
                        {[distLabel(r.distance), r.city, abbreviateCountry(r.country)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.04em' }}>
                        {fmtDDMMMYYYY(r.date)}
                      </div>
                      {r.time && (
                        <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--headline)', fontWeight: 800, color: 'var(--orange)', letterSpacing: '0.04em' }}>
                          {r.time}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Majors & Qualifiers ──────────────────────────────────────────────────────

function MajorsQualifiers() {
  const races = useRaceStore(selectRaces)
  const today = new Date().toISOString().split('T')[0]

  const majorStatus = useMemo(() => {
    return MAJORS.map(major => {
      const allMatches = races.filter(r => matchesMajor(r, major))
      const completed = allMatches.filter(r => r.date <= today)
      const upcoming  = allMatches.filter(r => r.date > today)
      const status = completed.length > 0 ? 'completed' : upcoming.length > 0 ? 'in-progress' : 'not-tracked'
      return { ...major, status, completed, upcoming }
    })
  }, [races, today])

  const completedCount  = majorStatus.filter(m => m.status === 'completed').length
  const inProgressCount = majorStatus.filter(m => m.status === 'in-progress').length

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-md)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
          MAJORS & QUALIFIERS
        </div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      {/* BQ / Championship tracker card */}
      <div style={{ ...st.subsection, marginTop: '12px' }}>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            BQ / CHAMPIONSHIP TRACKER
          </div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-md)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
            WORLD MARATHON MAJORS BOARD
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: '10px', lineHeight: 1.6, maxWidth: '360px', margin: '10px auto 0' }}>
            Every major lives here. Completed races surface your result and details, while upcoming majors stay highlighted in progress with a live countdown. Qualification is tracked where useful, but it is not treated as the only way in. Ballot, charity, tour, and qualifier paths all count.
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '14px' }}>
          {[
            { label: 'COMPLETED',   value: `${completedCount}/${MAJORS.length}` },
            { label: 'IN PROGRESS', value: inProgressCount.toString() },
            { label: 'ENTRY READY', value: '0' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface3)', padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                {s.label}
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', color: 'var(--white)', lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Individual majors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {majorStatus.map(m => (
            <div key={m.id} style={{
              background: 'var(--surface)',
              border: `1px solid ${m.status === 'completed' ? 'rgba(var(--green-ch), 0.3)' : m.status === 'in-progress' ? 'rgba(var(--orange-ch), 0.3)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '52px',
              gap: 'var(--sp-3)',
            }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '0.06em', textTransform: 'uppercase', color: m.status === 'completed' ? 'var(--white)' : m.status === 'in-progress' ? 'var(--orange)' : 'var(--muted)' }}>
                {m.name}
              </div>
              <div style={{
                fontFamily: 'var(--headline)',
                fontWeight: 700,
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
                border: `1px solid ${m.status === 'completed' ? 'rgba(var(--green-ch), 0.3)' : m.status === 'in-progress' ? 'rgba(var(--orange-ch), 0.3)' : 'var(--border2)'}`,
                color: m.status === 'completed' ? 'var(--green)' : m.status === 'in-progress' ? 'var(--orange)' : 'var(--muted)',
                background: 'transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {m.status === 'completed' ? 'COMPLETED' : m.status === 'in-progress' ? 'IN PROGRESS' : 'NOT TRACKED'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Race Personality ─────────────────────────────────────────────────────────

function RacePersonality() {
  const races = useRaceStore(selectRaces)
  const traits = useMemo(() => computePersonality(races), [races])

  return (
    <div style={st.section}>
      {/* Outer card with orange top glow */}
      <div style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderTop: '1px solid rgba(var(--orange-ch), 0.4)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            RACE PERSONALITY
          </div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
            WHAT KIND OF RACER ARE YOU?
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.5 }}>
            A fun but useful read on the traits that keep showing up in your results.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {traits.map(t => (
            <div key={t.trait} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
                  {t.trait}
                </div>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', color: 'var(--orange)', letterSpacing: '0.02em' }}>
                  {t.score}
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Bio / Details Section ────────────────────────────────────────────────────

// ─── Injury Tracker Section ───────────────────────────────────────────────────

function InjuryTrackerSection() {
  const injuries   = useAthleteStore(s => s.injuries)
  const [modal, setModal] = useState<{ open: boolean; injury?: Injury | null }>({ open: false })

  const active   = injuries.filter(i => !i.resolved)
  const resolved = injuries.filter(i => i.resolved)
  const [showResolved, setShowResolved] = useState(false)

  // Strip the parenthetical anatomical name for compact card display
  const bodyPartLabel = (key: string) => (INJURY_BODY_PARTS.find(p => p.key === key)?.label ?? key).replace(/\s*\(.*\)$/, '')
  const phaseLabel    = (key: string) => INJURY_PHASES.find(p => p.key === key)?.label ?? key
  const phaseIndex    = (key: string) => INJURY_PHASES.findIndex(p => p.key === key && p.key !== 'resolved')

  const severityColor = (s: string) =>
    s === 'severe' ? 'var(--orange)' : s === 'moderate' ? '#FFB347' : 'var(--green)'

  return (
    <section aria-label="Injury log" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 4 }}>
            RECOVERY
          </div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
            INJURY LOG
          </div>
        </div>
        <button
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-1) var(--sp-3)', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
          onClick={() => setModal({ open: true, injury: null })}
        >
          + Log
        </button>
      </div>

      {/* Empty state */}
      {active.length === 0 && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', color: 'var(--white)', marginBottom: 4 }}>No active injuries</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>Keep it that way! 🏃</div>
        </div>
      )}

      {/* Active injury cards */}
      {active.map(inj => {
        const phases = INJURY_PHASES.filter(p => p.key !== 'resolved')
        const curIdx = phaseIndex(inj.phase)
        return (
          <div
            key={inj.id}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', cursor: 'pointer' }}
            onClick={() => setModal({ open: true, injury: inj })}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setModal({ open: true, injury: inj })}
            aria-label={`Edit ${bodyPartLabel(inj.bodyPart)} injury`}
          >
            {/* Card header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-3)' }}>
              <div>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', color: 'var(--white)', textTransform: 'uppercase' }}>
                  {bodyPartLabel(inj.bodyPart)}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 2 }}>
                  {inj.injuryType.replace(/_/g, ' ')} · Since {inj.startDate}
                </div>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: severityColor(inj.severity), background: `${severityColor(inj.severity)}22`, border: `1px solid ${severityColor(inj.severity)}55`, borderRadius: 'var(--radius-xs)', padding: '2px 8px' }}>
                {inj.severity}
              </span>
            </div>

            {/* Phase bar */}
            <div style={{ marginBottom: 'var(--sp-2)' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--sp-1)' }}>
                {phases.map((p, i) => (
                  <div
                    key={p.key}
                    style={{ flex: 1, height: 4, borderRadius: 2, background: i <= curIdx ? 'var(--orange)' : 'var(--surface3)' }}
                    aria-label={p.label}
                  />
                ))}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {phaseLabel(inj.phase)}
              </div>
            </div>

            {/* Return date */}
            {inj.returnDate && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--green)' }}>
                Est. return: {inj.returnDate}
              </div>
            )}
          </div>
        )
      })}

      {/* Resolved toggle */}
      {resolved.length > 0 && (
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'left', padding: 0 }}
          onClick={() => setShowResolved(r => !r)}
        >
          {showResolved ? '▼' : '▶'} RECOVERED · {resolved.length}
        </button>
      )}
      {showResolved && resolved.map(inj => (
        <div
          key={inj.id}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', opacity: 0.55, cursor: 'pointer' }}
          onClick={() => setModal({ open: true, injury: inj })}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setModal({ open: true, injury: inj })}
        >
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--white)', textTransform: 'uppercase' }}>
            {bodyPartLabel(inj.bodyPart)} · {inj.injuryType.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 2 }}>
            {inj.startDate}{inj.returnDate ? ` → ${inj.returnDate}` : ''} · Resolved
          </div>
        </div>
      ))}

      {/* Disclaimer */}
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)', margin: 0, lineHeight: 1.5 }}>
        Injury information is for personal tracking only and is not medical advice.
        Consult a physiotherapist or sports doctor for diagnosis and treatment.
      </p>

      {modal.open && (
        <InjuryLogModal
          injury={modal.injury}
          onClose={() => setModal({ open: false })}
        />
      )}
    </section>
  )
}

// ─── Goals Section ────────────────────────────────────────────────────────────

function secsToHMS(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function GoalsSection() {
  const races = useRaceStore(selectRaces)
  const goals = useAthleteStore(s => s.goals)
  const setAnnualGoal = useAthleteStore(s => s.setAnnualGoal)
  const addDistGoal = useAthleteStore(s => s.addDistGoal)
  const deleteDistGoal = useAthleteStore(s => s.deleteDistGoal)

  const year = new Date().getFullYear()
  const ag = goals.annual[String(year)] ?? {}

  const yrRaces = races.filter(r => (r.date ?? '').startsWith(String(year)))
  const yrCount = yrRaces.length
  // Annual distance goal counts completed distance only — exclude DNF/DSQ/DNS.
  // distToKm is label-aware, so the redundant local KM_MAP is gone.
  const yrKm = yrRaces.reduce((sum, r) =>
    (r.outcome && r.outcome !== 'Finished') ? sum : sum + distToKm(r.distance)
  , 0)

  // Per-distance PBs for dist goals
  const pbByDist: Record<string, number> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const secs = r.time.split(':').reduce((s, v, i, a) => s + Number(v) * Math.pow(60, a.length - 1 - i), 0)
    if (!pbByDist[r.distance] || secs < pbByDist[r.distance]) pbByDist[r.distance] = secs
  }

  // Add-goal form state
  const [addMode, setAddMode] = useState<'km' | 'races' | 'dist' | null>(null)
  const [annualVal, setAnnualVal] = useState('')

  // 2-step dist goal picker: sport → distance
  const [goalSport,    setGoalSport]    = useState('Running')
  const [goalDist,     setGoalDist]     = useState('')       // value from GOAL_DISTANCES or '__custom__'
  const [goalCustomKm, setGoalCustomKm] = useState('')       // numeric string
  const [goalCustomUnit, setGoalCustomUnit] = useState<'km' | 'mi'>('km')
  const [goalHMS,      setGoalHMS]      = useState<HMS>({ h: 0, m: 0, s: 0 })
  const [goalDeadline, setGoalDeadline] = useState('')

  const handleGoalSportChange = useCallback((s: string) => {
    setGoalSport(s)
    setGoalDist('')
    setGoalCustomKm('')
  }, [])

  function saveAnnual() {
    const v = parseInt(annualVal)
    if (!v || !addMode || (addMode !== 'km' && addMode !== 'races')) return
    setAnnualGoal(year, { [addMode]: v })
    setAnnualVal('')
    setAddMode(null)
  }

  function saveDist() {
    const secs = goalHMS.h * 3600 + goalHMS.m * 60 + goalHMS.s
    let distVal = goalDist
    if (goalDist === '__custom__') {
      const km = goalCustomUnit === 'mi'
        ? (parseFloat(goalCustomKm) * 1.60934)
        : parseFloat(goalCustomKm)
      if (!km || isNaN(km)) return
      distVal = `${Math.round(km * 10) / 10}km`
    }
    if (!distVal || secs <= 0) return
    // Use the human label for GOAL_DISTANCES entries
    const preset = (GOAL_DISTANCES[goalSport] ?? []).find(o => o.value === distVal)
    const label = preset ? preset.label : distVal
    addDistGoal({ dist: label, targetSecs: secs, deadline: goalDeadline || undefined })
    setGoalDist('')
    setGoalCustomKm('')
    setGoalHMS({ h: 0, m: 0, s: 0 })
    setGoalDeadline('')
    setAddMode(null)
  }

  const inputSt: React.CSSProperties = {
    background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
    color: 'var(--white)', fontSize: 'var(--text-compact)', padding: '0.5rem 0.75rem', fontFamily: 'var(--body)',
  }
  const smallBtn: React.CSSProperties = {
    background: 'var(--orange)', color: 'var(--black)', border: 'none', borderRadius: 'var(--radius-xs)',
    padding: '0.45rem 0.9rem', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)',
    letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
  }

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 style={st.sectionTitle}>GOALS</h2>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      {/* Annual cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: '12px' }}>
        {(['km', 'races'] as const).map(type => {
          const target = type === 'km' ? (ag.km ?? 0) : (ag.races ?? 0)
          const current = type === 'km' ? Math.round(yrKm) : yrCount
          const pct = target ? Math.min(100, Math.round(current / target * 100)) : 0
          const achieved = target > 0 && current >= target
          return (
            <div key={type} style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-3)', position: 'relative' }}>
              <button
                onClick={() => { setAddMode(type); setAnnualVal(target ? String(target) : '') }}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >Edit</button>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {year} · {type === 'km' ? 'KM' : 'RACES'}
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xl)', color: 'var(--white)', lineHeight: 1 }}>
                {current}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontWeight: 400 }}> / {target || '—'}{type === 'km' ? ' km' : ''}</span>
              </div>
              {target > 0 ? (
                <>
                  <div style={{ height: '4px', background: 'var(--surface)', borderRadius: 'var(--radius-xs)', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: achieved ? 'var(--green)' : 'var(--orange)', borderRadius: 'var(--radius-xs)', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: achieved ? 'var(--green)' : 'var(--muted)', marginTop: '4px', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                    {pct}%{achieved ? ' · Achieved!' : ''}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '6px', fontFamily: 'var(--headline)' }}>Tap Edit to set target</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Distance time goals */}
      {goals.distGoals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: '10px' }}>
          {goals.distGoals.map(g => {
            const pb = pbByDist[g.dist]
            const done = pb !== undefined && pb <= g.targetSecs
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', gap: 'var(--sp-2)' }}>
                <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)', color: 'var(--orange)' }}>SUB</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontWeight: 600, lineHeight: 1.2 }}>{g.dist}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>
                    Sub {secsToHMS(g.targetSecs)}{g.deadline ? ` · ${fmtDate(g.deadline)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: done ? 'var(--green)' : 'var(--orange)' }}>
                    {done ? '✓ Done' : pb !== undefined ? secsToHMS(pb) : '—'}
                  </div>
                  <button onClick={() => deleteDistGoal(g.id)} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 'var(--text-xs)', marginTop: '2px' }}>✕ Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add goal button */}
      {!addMode && (
        <button onClick={() => setAddMode('dist')} style={{ ...st.ctaOutline, width: '100%', marginTop: '4px' }}>
          + Add Distance Goal
        </button>
      )}

      {/* Add-goal inline form */}
      {addMode === 'km' && (
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', marginTop: '8px' }}>
          <input type="number" placeholder={`${year} KM target`} value={annualVal} onChange={e => setAnnualVal(e.target.value)} style={{ ...inputSt, flex: 1 }} />
          <button onClick={saveAnnual} style={smallBtn}>Save</button>
          <button onClick={() => setAddMode(null)} style={{ ...smallBtn, background: 'var(--surface3)', color: 'var(--muted)' }}>✕</button>
        </div>
      )}
      {addMode === 'races' && (
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', marginTop: '8px' }}>
          <input type="number" placeholder={`${year} race count target`} value={annualVal} onChange={e => setAnnualVal(e.target.value)} style={{ ...inputSt, flex: 1 }} />
          <button onClick={saveAnnual} style={smallBtn}>Save</button>
          <button onClick={() => setAddMode(null)} style={{ ...smallBtn, background: 'var(--surface3)', color: 'var(--muted)' }}>✕</button>
        </div>
      )}
      {addMode === 'dist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: '8px', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)' }}>

          {/* Step 1 — Sport dropdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Sport</div>
              <select
                value={goalSport}
                onChange={e => handleGoalSportChange(e.target.value)}
                style={{ ...inputSt, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
              >
                {GOAL_SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Step 2 — Distance dropdown */}
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Distance</div>
              <select
                value={goalDist}
                onChange={e => setGoalDist(e.target.value)}
                style={{ ...inputSt, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
              >
                <option value="">Select…</option>
                {(GOAL_DISTANCES[goalSport] ?? []).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {goalSport !== 'HYROX' && <option value="__custom__">Custom…</option>}
              </select>
            </div>
          </div>


          {/* Custom distance input */}
          {goalDist === '__custom__' && (
            <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
              <input
                type="number" min={0} step={0.1}
                placeholder={goalCustomUnit === 'km' ? 'e.g. 30' : 'e.g. 18.6'}
                value={goalCustomKm}
                onChange={e => setGoalCustomKm(e.target.value)}
                style={{ ...inputSt, flex: 1, minWidth: 0 }}
              />
              <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border2)', flexShrink: 0 }}>
                {(['km', 'mi'] as const).map(u => (
                  <button key={u} onClick={() => setGoalCustomUnit(u)} style={{
                    background: goalCustomUnit === u ? 'var(--orange)' : 'var(--surface)',
                    color: goalCustomUnit === u ? 'var(--black)' : 'var(--muted)',
                    border: 'none', padding: '7px 12px',
                    fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                  }}>{u}</button>
                ))}
              </div>
            </div>
          )}

          {/* Target time wheel */}
          {(goalDist !== '') && (
            <>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Target Time</div>
                <TimePickerWheel value={goalHMS} onChange={setGoalHMS} maxHours={99} />
              </div>

              {/* Deadline */}
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Deadline (optional)</div>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={e => setGoalDeadline(e.target.value)}
                  style={{ ...inputSt, width: '100%', boxSizing: 'border-box', maxWidth: '100%', WebkitAppearance: 'none', appearance: 'none' }}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button onClick={saveDist} disabled={!goalDist || (goalDist === '__custom__' && !goalCustomKm)} style={{ ...smallBtn, flex: 1, opacity: (!goalDist || (goalDist === '__custom__' && !goalCustomKm)) ? 0.4 : 1 }}>Add Goal</button>
            <button onClick={() => { setAddMode(null); setGoalDist(''); setGoalCustomKm(''); setGoalHMS({ h:0, m:0, s:0 }); setGoalDeadline('') }} style={{ ...smallBtn, background: 'var(--surface)', color: 'var(--muted)', flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SavedWorkoutsSection() {
  const athlete = useAthleteStore(selectAthlete)
  const savedWorkouts = athlete?.savedWorkouts ?? []
  const feedback = athlete?.workoutFeedback ?? []
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(savedWorkouts[0]?.id ?? null)

  if (!savedWorkouts.length) return null

  const selectedWorkout = savedWorkouts.find(workout => workout.id === selectedWorkoutId) ?? savedWorkouts[0]
  const selectedFeedback = selectedWorkout
    ? feedback.find(entry => entry.workoutId === selectedWorkout.workoutId) ?? null
    : null

  return (
    <section style={st.section}>
      <div style={st.subsection}>
        <h2 style={st.sectionTitle}>Saved Workouts</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {savedWorkouts.slice(0, 5).map(workout => {
            const latestFeedback = feedback.find(entry => entry.workoutId === workout.workoutId)
            const selected = workout.id === selectedWorkout?.id
            return (
              <button
                key={workout.id}
                onClick={() => setSelectedWorkoutId(workout.id)}
                style={{
                  ...st.pbCard,
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: selected ? 'rgba(var(--orange-ch),0.1)' : st.pbCard.background,
                  border: selected ? '1px solid rgba(var(--orange-ch),0.35)' : st.pbCard.border,
                }}
              >
                <div style={st.pbDist}>{workout.title}</div>
                <div style={st.pbTime}>{workout.subtitle}</div>
                <div style={st.pbRaceName}>
                  {workout.totalMinutes} min{workout.benchmarkLabel ? ` · ${workout.benchmarkLabel}` : ''}
                </div>
                {latestFeedback && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)' }}>
                    Feedback: {latestFeedback.feedback.replace('-', ' ')}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {selectedWorkout && (
          <div style={{ ...st.subsection, marginTop: 'var(--sp-2)', background: 'var(--surface3)' }}>
            <h3 style={{ ...st.sectionTitle, fontSize: 'var(--text-sm)' }}>{selectedWorkout.title}</h3>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{selectedWorkout.subtitle}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)' }}>
              {selectedWorkout.totalMinutes} min{selectedWorkout.benchmarkLabel ? ` · ${selectedWorkout.benchmarkLabel}` : ''}{selectedWorkout.savedAt ? ` · saved ${selectedWorkout.savedAt}` : ''}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--white)', lineHeight: 1.5 }}>
              {selectedWorkout.rationale}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {selectedWorkout.segments.map(segment => (
                <div key={`${segment.label}-${segment.detail}`} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {segment.label}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>
                        {segment.detail}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {segment.zone} pace
                      </div>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--orange)', marginTop: '4px' }}>
                        {segment.pace}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700, marginBottom: '6px' }}>
                Session Notes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedWorkout.notes.map(note => (
                  <div key={note} style={{ fontSize: 'var(--text-xs)', color: 'var(--white)', lineHeight: 1.5 }}>
                    {note}
                  </div>
                ))}
              </div>
            </div>
            {selectedFeedback && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)' }}>
                Latest feedback: {selectedFeedback.feedback.replace('-', ' ')} on {selectedFeedback.recordedAt}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

// ─── Onboarding Banner ───────────────────────────────────────────────────────

function getProfileCompleteness(ath: ReturnType<typeof selectAthlete>): { filled: number; total: number } {
  const fields = [
    ath?.firstName, ath?.lastName, ath?.mainSport,
    ath?.city, ath?.country, ath?.dob, ath?.gender,
  ]
  return { filled: fields.filter(Boolean).length, total: fields.length }
}

function OnboardingBanner({ onEdit }: { onEdit: () => void }) {
  const athlete  = useAthleteStore(selectAthlete)
  const navigate = useNavigate()
  const isNew = !!localStorage.getItem('bt_new_user')

  if (!isNew) return null

  const { filled, total } = getProfileCompleteness(athlete)
  const complete = filled >= total

  return (
    <div style={{
      background: complete ? 'rgba(var(--green-ch),0.08)' : 'rgba(var(--orange-ch),0.08)',
      border: `1px solid ${complete ? 'rgba(var(--green-ch),0.3)' : 'rgba(var(--orange-ch),0.3)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--sp-4)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-3)',
      marginBottom: '4px',
    }}>
      <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-round)', background: complete ? 'var(--green)' : 'var(--orange)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', letterSpacing: '0.04em', textTransform: 'uppercase', color: complete ? 'var(--green)' : 'var(--orange)', lineHeight: 1.1 }}>
          {complete ? 'Profile Complete' : `Profile ${filled}/${total} Complete`}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>
          {complete
            ? 'Your profile is ready.'
            : 'Fill in your details to complete your profile.'}
        </div>
      </div>
      <button
        onClick={() => {
          if (complete) {
            localStorage.removeItem('bt_new_user')
            navigate('/')
          } else {
            onEdit()
          }
        }}
        style={{
          flexShrink: 0,
          background: complete ? 'var(--green)' : 'var(--orange)',
          color: '#000',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          padding: '8px 14px',
          fontFamily: 'var(--headline)',
          fontWeight: 800,
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {complete ? 'Go to Dashboard →' : 'Edit Profile'}
      </button>
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export function Profile() {
  const authUser = useAuthStore(selectAuthUser)
  const [showEdit, setShowEdit] = useState(false)

  // Track page view on mount
  useEffect(() => { posthog.capture('page_viewed', { page: 'profile' }) }, [])

  // Auto-open edit modal 300ms after mount for new users (once per device)
  useEffect(() => {
    if (!authUser) return
    if (localStorage.getItem('bt_new_user') && !localStorage.getItem('bt_modal_shown')) {
      const t = setTimeout(() => {
        localStorage.setItem('bt_modal_shown', '1')
        setShowEdit(true)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [authUser])

  // No authUser gate here — AuthGate already verifies Clerk's isSignedIn
  // before rendering this page. Gating on the Zustand authUser races with
  // useClerkSync's async token fetch and shows the sign-in prompt to a
  // signed-in user whenever the token call hasn't resolved yet (or fails
  // silently, e.g. missing JWT template). Sub-components that need authUser
  // can guard themselves.

  return (
    <main role="main" aria-label="Athlete profile" style={st.page}>
      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
      <OnboardingBanner onEdit={() => { localStorage.setItem('bt_modal_shown', '1'); setShowEdit(true) }} />
      <AthleteHero onEdit={() => setShowEdit(true)} />
      <MedalWall />
      <AchievementsSection />
      <PersonalBests />
      <SignatureDistances />
      <AgeGradeTrajectory />
      <PerformanceTimeline />
      <RaceActivityHeatmap />
      <MajorsQualifiers />
      <RacePersonality />
      <InjuryTrackerSection />
      <GoalsSection />
      <SavedWorkoutsSection />
    </main>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  page: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
    padding: 'var(--sp-4)',
    paddingBottom: '96px',
    fontFamily: 'var(--body)',
    color: 'var(--white)',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Hero card
  heroCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--sp-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-5)',
    minWidth: 0,
  } as React.CSSProperties,

  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-4)',
    minWidth: 0,
  } as React.CSSProperties,

  avatar: {
    width: '72px',
    height: '72px',
    borderRadius: 'var(--radius-round)',
    background: 'var(--surface3)',
    border: '2px solid var(--orange)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  avatarInitials: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xl)',
    fontWeight: 900,
    color: 'var(--orange)',
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  avatarInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } as React.CSSProperties,

  athleteName: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xl)',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1.1,
    color: 'var(--white)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  athleteSub: {
    fontSize: 'var(--text-xs)',
    color: 'var(--muted)',
    textTransform: 'capitalize',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  levelBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'rgba(var(--orange-ch), 0.15)',
    border: '1px solid rgba(var(--orange-ch), 0.3)',
    color: 'var(--orange)',
    borderRadius: 'var(--radius-pill)',
    padding: '3px 10px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    letterSpacing: '0.1em',
  } as React.CSSProperties,

  heroStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 'var(--sp-2)',
    minWidth: 0,
  } as React.CSSProperties,

  heroStatCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-1)',
    background: 'linear-gradient(160deg, var(--surface3) 0%, rgba(var(--orange-ch),0.05) 100%)',
    borderRadius: 'var(--radius-lg)',
    padding: '12px 8px',
    minWidth: 0,
  } as React.CSSProperties,

  heroStatValue: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-lg)',
    fontWeight: 900,
    lineHeight: 1,
    color: 'var(--white)',
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  heroStatLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    textAlign: 'center',
  } as React.CSSProperties,

  focusCard: {
    background: 'rgba(var(--orange-ch), 0.08)',
    border: '1px solid rgba(var(--orange-ch), 0.2)',
    borderLeft: '3px solid var(--orange)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--sp-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } as React.CSSProperties,

  focusLabel: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xs)',
    fontWeight: 800,
    letterSpacing: '0.14em',
    color: 'var(--orange)',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  focusName: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-base)',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    lineHeight: 1.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  focusMeta: { fontSize: 'var(--text-xs)', color: 'var(--muted)' } as React.CSSProperties,

  focusDays: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-base)',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--orange)',
    marginTop: '4px',
  } as React.CSSProperties,

  // ── Achievements hero
  achievementHero: {
    background: 'linear-gradient(135deg, rgba(0,40,20,0.9) 0%, rgba(0,25,12,0.95) 60%, rgba(5,15,8,1) 100%)',
    border: '1px solid rgba(var(--green-ch), 0.2)',
    borderRadius: 'var(--radius-lg)',
    padding: '22px',
    minWidth: 0,
  } as React.CSSProperties,

  achievementPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    background: 'rgba(245,245,245,0.06)',
    border: '1px solid rgba(245,245,245,0.12)',
    borderRadius: 'var(--radius-pill)',
    padding: '7px 14px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  achievementGroup: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--sp-4)',
  } as React.CSSProperties,

  achievementGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'var(--sp-2)',
  } as React.CSSProperties,

  achievementTile: {
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    minWidth: 0,
  } as React.CSSProperties,

  achievementIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(245,245,245,0.06)',
  } as React.CSSProperties,

  achievementName: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xs)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    textAlign: 'center',
    lineHeight: 1.3,
  } as React.CSSProperties,

  achievementStatus: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(245,245,245,0.08)',
  } as React.CSSProperties,

  // ── Countries
  countryPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-pill)',
    padding: '7px 16px',
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  // ── Section containers
  section: {
    minWidth: 0,
  } as React.CSSProperties,

  subsection: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--sp-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-3)',
    minWidth: 0,
  } as React.CSSProperties,

  sectionTitle: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-md)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    margin: 0,
  } as React.CSSProperties,

  // ── PB cards
  pbCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--sp-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  } as React.CSSProperties,

  pbDist: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,

  pbTime: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-lg)',
    fontWeight: 900,
    letterSpacing: '0.04em',
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  pbRaceName: {
    fontSize: 'var(--text-xs)',
    color: 'var(--muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  // ── Details
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '10px',
  } as React.CSSProperties,

  detailLabel: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    width: '80px',
    flexShrink: 0,
  } as React.CSSProperties,

  detailValue: {
    fontSize: 'var(--text-sm)',
    color: 'var(--white)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  bio: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    lineHeight: 1.6,
    fontStyle: 'italic',
    padding: '10px 0 0',
  } as React.CSSProperties,

  editBtnSmall: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-pill)',
    color: 'var(--muted)',
    padding: '5px 12px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,

  ctaOutline: {
    marginTop: '4px',
    background: 'transparent',
    color: 'var(--orange)',
    border: '1px solid rgba(var(--orange-ch), 0.5)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 18px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    padding: '28px 16px',
    textAlign: 'center',
  } as React.CSSProperties,

  emptyIcon: { fontSize: 'var(--text-2xl)', lineHeight: 1 } as React.CSSProperties,

  emptyText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    maxWidth: '260px',
    lineHeight: 1.5,
  } as React.CSSProperties,
} as const
