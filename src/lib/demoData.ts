// Self-contained demo data for the landing sandbox (/demo). No real stores,
// no auth, no persistence — purely illustrative. Safe to edit freely.

export type MedalTier = 'gold' | 'silver' | 'bronze' | 'finisher'
export type DemoPersonaId = 'marathoner' | 'triathlete' | 'everyday'

export interface DemoRace {
  name: string
  city: string
  lng: number
  lat: number
  date: string        // YYYY-MM-DD
  dist: string        // display label
  time: string        // finish time
  medal?: MedalTier
  place?: string      // e.g. "342 / 5,000"
  pb?: boolean
}
export interface DemoPB { label: string; time: string }
export interface DemoPersona {
  id: DemoPersonaId
  label: string
  name: string
  tagline: string
  next: { race: string; days: number; goal: string }
  stats: { races: number; countries: number; medals: number; topPb: [string, string] }
  momentum: number[]
  races: DemoRace[]
  prs: DemoPB[]
  medals: MedalTier[]
}

export const DEMO_PERSONAS: Record<DemoPersonaId, DemoPersona> = {
  marathoner: {
    id: 'marathoner', label: 'Marathoner', name: 'Alex Rivera',
    tagline: 'Road racer · chasing a Boston Qualifier',
    next: { race: 'Berlin Marathon', days: 12, goal: 'Goal 3:15' },
    stats: { races: 42, countries: 9, medals: 18, topPb: ['3:21:05', 'MARATHON PR'] },
    momentum: [40, 44, 41, 52, 58, 55, 64, 70, 78, 88],
    prs: [
      { label: '5K', time: '18:42' }, { label: '10K', time: '38:50' },
      { label: 'Half Marathon', time: '1:24:10' }, { label: 'Marathon', time: '3:21:05' },
    ],
    medals: ['gold', 'silver', 'bronze', 'finisher', 'gold', 'finisher', 'bronze', 'finisher', 'silver', 'finisher'] as MedalTier[],
    races: [
      { name: 'Boston Marathon', city: 'Boston', lng: -71.06, lat: 42.36, date: '2025-04-21', dist: 'Marathon', time: '3:24:18', medal: 'finisher', place: '4,210 / 30,000' },
      { name: 'Chicago Marathon', city: 'Chicago', lng: -87.63, lat: 41.88, date: '2024-10-13', dist: 'Marathon', time: '3:21:05', medal: 'finisher', place: '3,980 / 48,000', pb: true },
      { name: 'London Marathon', city: 'London', lng: -0.13, lat: 51.51, date: '2024-04-21', dist: 'Marathon', time: '3:27:44', medal: 'finisher', place: '5,120 / 50,000' },
      { name: 'Berlin Half', city: 'Berlin', lng: 13.40, lat: 52.52, date: '2024-04-07', dist: 'Half Marathon', time: '1:24:10', medal: 'bronze', place: '88 / 32,000', pb: true },
      { name: 'Valencia 10K', city: 'Valencia', lng: -0.38, lat: 39.47, date: '2024-01-14', dist: '10K', time: '38:50', medal: 'silver', place: '42 / 12,000' },
      { name: 'Tokyo Marathon', city: 'Tokyo', lng: 139.65, lat: 35.68, date: '2023-03-05', dist: 'Marathon', time: '3:31:02', medal: 'finisher', place: '6,540 / 38,000' },
      { name: 'NYC Marathon', city: 'New York', lng: -74.01, lat: 40.71, date: '2022-11-06', dist: 'Marathon', time: '3:38:55', medal: 'finisher', place: '8,900 / 50,000' },
      { name: 'Parkrun PB', city: 'Bristol', lng: -2.59, lat: 51.45, date: '2022-08-13', dist: '5K', time: '18:42', medal: 'gold', place: '1 / 480', pb: true },
    ],
  },
  triathlete: {
    id: 'triathlete', label: 'Triathlete', name: 'Mara Sato',
    tagline: 'Swim · bike · run — IRONMAN in the books',
    next: { race: 'IRONMAN Nice', days: 26, goal: 'Goal 10:30' },
    stats: { races: 38, countries: 11, medals: 14, topPb: ['10:42:05', 'IRONMAN PR'] },
    momentum: [50, 48, 55, 60, 58, 66, 72, 70, 80, 90],
    prs: [
      { label: 'Olympic', time: '2:14:30' }, { label: '70.3', time: '4:58:12' },
      { label: 'IRONMAN', time: '10:42:05' }, { label: 'Marathon', time: '3:34:20' },
    ],
    medals: ['gold', 'finisher', 'silver', 'finisher', 'bronze', 'finisher', 'finisher', 'gold', 'finisher', 'silver'] as MedalTier[],
    races: [
      { name: 'IRONMAN Nice', city: 'Nice', lng: 7.27, lat: 43.70, date: '2025-06-29', dist: 'IRONMAN', time: '10:42:05', medal: 'finisher', place: '210 / 2,800', pb: true },
      { name: 'Challenge Roth', city: 'Roth', lng: 11.09, lat: 49.14, date: '2024-07-07', dist: 'IRONMAN', time: '10:58:40', medal: 'finisher', place: '340 / 3,400' },
      { name: 'IRONMAN 70.3 Cairns', city: 'Cairns', lng: 145.77, lat: -16.92, date: '2024-06-09', dist: '70.3', time: '4:58:12', medal: 'bronze', place: '6 / 1,900', pb: true },
      { name: 'Taupō Olympic Tri', city: 'Taupō', lng: 176.07, lat: -38.69, date: '2023-12-10', dist: 'Olympic', time: '2:14:30', medal: 'gold', place: '1 / 600', pb: true },
      { name: 'IRONMAN 70.3 Nice', city: 'Nice', lng: 7.27, lat: 43.70, date: '2023-09-17', dist: '70.3', time: '5:06:48', medal: 'finisher', place: '88 / 2,100' },
      { name: 'London Tri Olympic', city: 'London', lng: -0.13, lat: 51.51, date: '2023-08-06', dist: 'Olympic', time: '2:18:55', medal: 'silver', place: '4 / 1,200' },
      { name: 'Kona Swim Series', city: 'Kona', lng: -155.99, lat: 19.64, date: '2022-10-08', dist: 'Swim', time: '0:58:20', medal: 'finisher', place: '120 / 900' },
    ],
  },
  everyday: {
    id: 'everyday', label: 'Everyday runner', name: 'Jordan Kemp',
    tagline: 'Weekend racer · collecting finish lines',
    next: { race: 'City Autumn 10K', days: 9, goal: 'Goal sub-55' },
    stats: { races: 12, countries: 3, medals: 9, topPb: ['52:18', '10K PR'] },
    momentum: [30, 34, 38, 36, 44, 48, 50, 56, 60, 66],
    prs: [
      { label: '5K', time: '26:30' }, { label: '10K', time: '52:18' },
      { label: 'Half Marathon', time: '2:05:40' },
    ],
    medals: ['finisher', 'finisher', 'bronze', 'finisher', 'finisher', 'silver', 'finisher', 'finisher', 'gold'] as MedalTier[],
    races: [
      { name: 'City Spring 10K', city: 'London', lng: -0.13, lat: 51.51, date: '2025-03-30', dist: '10K', time: '52:18', medal: 'finisher', place: '1,240 / 4,000', pb: true },
      { name: 'Royal Parks Half', city: 'London', lng: -0.16, lat: 51.51, date: '2024-10-13', dist: 'Half Marathon', time: '2:05:40', medal: 'finisher', place: '6,800 / 16,000', pb: true },
      { name: 'Amsterdam 10K', city: 'Amsterdam', lng: 4.90, lat: 52.37, date: '2024-10-20', dist: '10K', time: '54:02', medal: 'bronze', place: '900 / 5,000' },
      { name: 'Berlin 5K Run', city: 'Berlin', lng: 13.40, lat: 52.52, date: '2024-05-05', dist: '5K', time: '26:30', medal: 'finisher', place: '410 / 2,000', pb: true },
      { name: 'Paris Color Run', city: 'Paris', lng: 2.35, lat: 48.86, date: '2023-09-09', dist: '5K', time: '28:14', medal: 'finisher', place: '1,500 / 6,000' },
      { name: 'Hometown Turkey Trot', city: 'New York', lng: -74.01, lat: 40.71, date: '2022-11-24', dist: '5K', time: '29:48', medal: 'gold', place: '2 / 320' },
    ],
  },
}

export const DEMO_PERSONA_LIST = Object.values(DEMO_PERSONAS)

export const MEDAL_COLORS: Record<MedalTier, [string, string]> = {
  gold: ['#FFD770', '#B8860B'],
  silver: ['#C8D4DC', '#6A7880'],
  bronze: ['#CD8C5A', '#7A4420'],
  finisher: ['#E8895A', '#A8421A'],
}
