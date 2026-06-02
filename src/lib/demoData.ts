// Seed data for the landing / demo sandbox — drives the REAL app components
// (Dashboard widgets, PB cards, Races map, Medal wall, Profile) with seven
// fully-formed personas. Parsed from docs/demo-data-template.md.
//
// SAFETY: this data is only ever loaded into the Zustand stores on the
// breaktapes.com marketing origin (separate localStorage from the app origin)
// and for logged-out visitors — see useDemoSeed(). It can never overwrite a
// signed-in user's real race data.

import type { Race, Athlete, Split } from '@/types'

export type DemoPersonaId =
  | 'usa-trail'
  | 'uk-hybrid'
  | 'eu-cyclist'
  | 'dubai-everyday'
  | 'sa-marathoner'
  | 'china-masters'
  | 'aus-triathlete'

export interface DemoTestimonial { quote: string; name: string; meta: string }

export interface DemoPersona {
  id: DemoPersonaId
  label: string          // short tab/selector label
  blurb: string          // one-line descriptor
  athlete: Athlete
  races: Race[]          // past results
  upcoming: Race[]       // planned races
  testimonial: DemoTestimonial
}

/* ---------- parsers ---------- */

function num(s?: string): number | undefined {
  if (s == null) return undefined
  const n = parseFloat(s)
  return Number.isNaN(n) ? undefined : n
}

// "56 (custom km)" -> "56"; "100K" -> "100K"; "42.2" -> "42.2"
function cleanDist(tok: string): string {
  return tok.replace(/\(custom km\)/i, '').trim()
}

// strip a trailing "  (comment)" that some lines append after the last field
function stripComment(s: string): string {
  return s.replace(/\s{2,}\(.*\)\s*$/, '').trim()
}

/**
 * Parse one pipe-delimited race line into a real Race.
 * Columns:
 * name | city | country | date | distance | sport | time | placing |
 * genderPlacing | agPlacing | agLabel | medal | surface | terrain |
 * elev | avgHR | shoe | weather(temp/cond) | lat | lng
 */
function parseRace(line: string, id: string): Race {
  const c = line.split('|').map(x => x.trim())
  const weather = c[17] || ''
  const slash = weather.indexOf('/')
  const temp = slash >= 0 ? weather.slice(0, slash) : ''
  const cond = slash >= 0 ? stripComment(weather.slice(slash + 1)) : ''
  const race: Race = {
    id,
    name: c[0] || '',
    city: c[1] || '',
    country: c[2] || '',
    date: c[3] || '',
    distance: cleanDist(c[4] || ''),
    distanceUnit: 'km',
    sport: (c[5] || 'running').toLowerCase(),
    time: c[6] || undefined,
    placing: c[7] || undefined,
    genderPlacing: c[8] || undefined,
    agPlacing: c[9] || undefined,
    agLabel: c[10] || undefined,
    medal: (c[11] || '').toLowerCase() || undefined,
    surface: c[12] || undefined,
    terrain: c[13] || undefined,
    elevation: num(c[14]),
    avgHeartRate: num(c[15]),
    shoe: c[16] || undefined,
    weather: temp ? { temp: num(temp), condition: cond || undefined } : undefined,
    lat: num(c[18]),
    lng: num(c[19]),
    outcome: 'Finished',
  }
  return race
}

/** Parse a "key: value | key: value" upcoming-race line into a Race. */
function parseUpcoming(line: string, id: string): Race {
  const o: Record<string, string> = {}
  line.split('|').forEach(seg => {
    const i = seg.indexOf(':')
    if (i > 0) o[seg.slice(0, i).trim()] = stripComment(seg.slice(i + 1).trim())
  })
  return {
    id,
    name: o.name || '',
    city: o.city || '',
    country: o.country || '',
    date: o.date || '',
    distance: cleanDist(o.distance || ''),
    distanceUnit: 'km',
    sport: (o.sport || 'running').toLowerCase(),
    goalTime: o.goalTime || undefined,
    outcome: 'Upcoming',
  }
}

function strip(block: string): string[] {
  return block
    .split('\n')
    .map(l => l.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean)
}

/* ---------- synthetic splits (so Pacing IQ / Race DNA / split tables work) ---------- */
const KM_OF: Record<string, number> = { IRONMAN: 226, '70.3': 113, Olympic: 51.5, Sprint: 25.75, HYROX: 8, '100 Mile': 160.9, '100K': 100, '50K': 50, Ultra: 60, Marathon: 42.2, 'Half Marathon': 21.1 }
function kmOf(d: string): number { if (KM_OF[d] != null) return KM_OF[d]; const n = parseFloat(d); return Number.isNaN(n) ? 0 : n }
function hmsToSec(t: string): number { const a = t.split(':').map(Number); if (a.some(Number.isNaN)) return 0; return a.length === 3 ? a[0]*3600 + a[1]*60 + a[2] : a.length === 2 ? a[0]*60 + a[1] : 0 }
function fmtSecs(s: number): string { s = Math.round(s); const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}` }
function genSplits(distKm: number, totalSecs: number, bias: 'neg' | 'even' | 'pos'): Split[] {
  const N = Math.max(3, distKm <= 12 ? 4 : distKm <= 45 ? Math.min(9, Math.round(distKm/5)) : Math.min(10, Math.round(distKm/10)))
  const raw: number[] = []
  for (let i = 0; i < N; i++) { const t = N > 1 ? i/(N-1) : 0; const drift = bias === 'neg' ? 0.05 - 0.10*t : bias === 'pos' ? -0.05 + 0.10*t : (i%2 ? 0.015 : -0.015); raw.push(1 + drift) }
  const sum = raw.reduce((a, b) => a + b, 0), segKm = distKm/N
  let cum = 0; const out: Split[] = []
  for (let i = 0; i < N; i++) { const segS = totalSecs*raw[i]/sum; cum += segS; out.push({ label: `${Math.round(segKm*(i+1))}K`, split: fmtSecs(segS), cumulative: fmtSecs(cum) }) }
  return out
}

function buildRaces(pid: string, block: string): Race[] {
  return strip(block).map((l, i) => {
    const r = parseRace(l, `${pid}-r${i + 1}`)
    const km = kmOf(r.distance)
    if (r.time && r.sport === 'running' && km >= 5 && km <= 300) {
      r.splits = genSplits(km, hmsToSec(r.time), (['neg', 'even', 'pos'] as const)[i % 3])
    }
    return r
  })
}
function buildUpcoming(pid: string, block: string): Race[] {
  return strip(block).map((l, i) => parseUpcoming(l, `${pid}-u${i + 1}`))
}

function athlete(a: Omit<Athlete, 'clubs' | 'profileVisibility' | 'isPublic'> & { club?: string }): Athlete {
  return {
    ...a,
    clubs: a.club ? [a.club] : undefined,
    isPublic: true,
    profileVisibility: { races: true, pbs: true, medals: true, upcoming: true, stats: true, wearables: false },
  }
}

/* ===================================================================
   PERSONA 1 — USA · Trail / Ultra (Hannah Brooks)
   =================================================================== */
const USA_RACES = `
Canyons Endurance Runs by UTMB 100K | Auburn | United States | 2025-04-26 | 100K | running | 13:48:20 | 320/600 | 60/220 | 14/40 | F35-39 | finisher | trail | mountainous | 4500 | 150 | Speedgoat 6 | 18/clear | 38.90 | -121.08
Badwater 135 | Death Valley | United States | 2024-07-22 | 100 Mile | running | 39:10:00 | 78/100 | 14/22 | 3/6 | F35-39 | bronze | road | mountainous | 4000 | 142 | Hoka Mafate | 47/extreme | 36.50 | -116.93
Canyons Endurance Runs by UTMB 50K | Auburn | United States | 2023-04-29 | 50K | running | 5:42:55 | 280/800 | 70/280 | 12/60 | F30-34 | finisher | trail | mountainous | 2100 | 156 | Speedgoat 6 | 16/clear | 38.90 | -121.08
HOKA UTMB Mont-Blanc | Chamonix | France | 2024-08-30 | 100 Mile | running | 41:30:00 | 1900/2500 | 220/350 | 40/70 | F35-39 | custom | trail | mountainous | 10000 | 148 | Speedgoat 6 | 12/cold | 45.92 | 6.87
CCC by UTMB | Courmayeur | Italy | 2023-08-31 | 100K | running | 19:05:00 | 1500/2000 | 280/420 | 50/90 | F30-34 | finisher | trail | mountainous | 6100 | 152 | Speedgoat 6 | 14/clear | 45.79 | 6.97
Mountains 2 Beach Marathon | Ventura | United States | 2022-05-29 | 42.2 | running | 3:34:12 | 142/3500 | 28/1600 | 6/180 | F30-34 | finisher | road | rolling | 480 | 162 | Vaporfly 3 | 17/clear | 34.27834 | -119.29317
Salt Lake City Half Marathon | Salt Lake City | United States | 2023-04-22 | 21.1 | running | 1:41:58 | 633/4200 | 121/2100 | 24/350 | F30-34 | finisher | road | rolling | 320 | 168 | Vaporfly 3 | 14/clear | 40.7608 | -111.8910
Mountains 2 Beach 10K | Ventura | United States | 2024-05-25 | 10 | running | 44:07 | 71/1200 | 19/700 | 3/90 | F35-39 | bronze | road | flat | 60 | 174 | Vaporfly 3 | 16/clear | 34.27834 | -119.29317
Presidio 5K | San Francisco | United States | 2023-09-17 | 5 | running | 21:48 | 47/900 | 12/520 | 1/85 | F30-34 | gold | trail | hilly | 90 | 178 | Pegasus 41 | 15/cloudy | 37.7749 | -122.4194
Long Beach Marathon 5K | Long Beach | United States | 2024-10-13 | 5 | running | 22:31 | 188/2400 | 53/1400 | 2/210 | F35-39 | silver | road | flat | 10 | 176 | Pegasus 41 | 19/clear | 33.7670 | -118.1892
`
const USA_UP = `
name: Canyons Endurance Runs by UTMB 100K | date: 2026-06-27 | city: Auburn | country: United States | distance: 100K | sport: running | goalTime: 14:00:00
`

/* ===================================================================
   PERSONA 2 — UK · Hybrid (Jack Reynolds)
   =================================================================== */
const UK_RACES = `
HYROX London (Pro) | London | United Kingdom | 2025-02-22 | HYROX | hyrox | 1:00:35 | 80/2000 | 75/1700 | 14/350 | M30-34 | finisher | road | flat | 0 | 179 | Nano X3 | 18/indoor | 51.51 | 0.03
T100 London | London | United Kingdom | 2025-07-26 | 100 | triathlon | 4:21:40 | 310/1100 | 290/900 | 55/180 | M30-34 | finisher | road | flat | 320 | 158 | Cervelo P5 | 21/clear | 51.5074 | -0.1278   (T100 = 2km swim / 80km bike / 18km run)
London Marathon | London | United Kingdom | 2025-04-27 | 42.2 | running | 2:58:42 | 1840/53000 | 1720/30000 | 240/7000 | M30-34 | custom | road | flat | 60 | 171 | Vaporfly 3 | 12/overcast | 51.5085 | -0.1257
HYROX Manchester | Manchester | United Kingdom | 2024-11-09 | HYROX | hyrox | 1:02:48 | 47/1500 | 44/1300 | 8/300 | M30-34 | bronze | road | flat | 0 | 181 | Nano X3 | 18/indoor | 53.48 | -2.24
Hackney Marshes parkrun | London | United Kingdom | 2025-01-04 | 5 | running | 17:42 | 6/420 | 6/280 | 2/55 | M30-34 | silver | road | flat | 5 | 176 | Vaporfly 3 | 7/cold | 51.548 | -0.038
Great North Run | Newcastle | United Kingdom | 2024-09-08 | 21.1 | running | 1:21:15 | 640/60000 | 600/35000 | 70/6000 | M30-34 | finisher | road | rolling | 120 | 174 | Vaporfly 3 | 16/cloudy | 54.98 | -1.61
Victoria Park parkrun | London | United Kingdom | 2024-10-12 | 5 | running | 18:05 | 11/380 | 11/250 | 3/48 | M30-34 | bronze | road | flat | 4 | 178 | Pegasus 41 | 13/cloudy | 51.5363 | -0.0395
London Landmarks Half Marathon | London | United Kingdom | 2025-03-30 | 21.1 | running | 1:23:58 | 410/16000 | 390/9000 | 48/2400 | M30-34 | finisher | road | flat | 50 | 173 | Vaporfly 3 | 11/overcast | 51.5074 | -0.1278
British 10K London | London | United Kingdom | 2024-07-14 | 10 | running | 33:48 | 40/12000 | 38/8000 | 8/1500 | M30-34 | finisher | road | flat | 20 | 175 | Vaporfly 3 | 19/clear | 51.5074 | -0.1278
Great South Run | Portsmouth | United Kingdom | 2024-10-20 | 16.09 | running | 54:30 | 55/22000 | 52/14000 | 9/2600 | M30-34 | finisher | road | flat | 15 | 173 | Vaporfly 3 | 14/clear | 50.7989 | -1.0912
`
const UK_UP = `
name: HYROX London | date: 2026-06-13 | city: London | country: United Kingdom | distance: HYROX | sport: hyrox | goalTime: 0:58:00
`

/* ===================================================================
   PERSONA 3 — Europe (France) · Cyclist (Camille Dubois)
   =================================================================== */
const EU_RACES = `
Granfondo Colnago Mont Ventoux 135K | Vaison-la-Romaine | France | 2025-06-21 | 135 | cycling | 4:32:30 | 90/2000 | 4/180 | 1/30 | F40-44 | gold | road | mountainous | 3200 | 152 | Colnago V4Rs | 23/clear | 44.24 | 5.07
Granfondo Colnago Luberon Pays d'Apt 139K | Apt | France | 2024-09-15 | 139 | cycling | 4:40:10 | 70/1500 | 3/140 | 1/22 | F40-44 | silver | road | hilly | 2400 | 150 | Colnago V4Rs | 25/clear | 43.88 | 5.40
Gran Fondo Pirineus 144K | Camprodon | Spain | 2024-07-06 | 144 | cycling | 5:02:40 | 50/900 | 2/90 | 1/16 | F40-44 | gold | road | mountainous | 3600 | 154 | Colnago V4Rs | 21/clear | 42.31 | 2.36
Granfondo Serra da Estrela 174K | Manteigas | Portugal | 2023-05-28 | 174 | cycling | 5:58:20 | 60/700 | 5/70 | 1/13 | F35-39 | bronze | road | mountainous | 4100 | 148 | Colnago V4Rs | 19/clear | 40.40 | -7.54
Gran Fondo Les Sybelles La Toussuire 98K | Fontcouverte-la-Toussuire | France | 2024-08-04 | 98 | cycling | 3:28:55 | 40/600 | 2/55 | 1/11 | F40-44 | silver | road | mountainous | 2800 | 156 | Colnago V4Rs | 17/clear | 45.23 | 6.29
Mercan'Tour Madone Peille 78.5K | Peille | France | 2025-06-08 | 78.5 | cycling | 2:51:40 | 62/1400 | 3/160 | 1/28 | F40-44 | gold | road | mountainous | 2600 | 153 | Colnago V4Rs | 20/clear | 43.80296 | 7.40191
Grand Raid of Camargue 30K | Salin-de-Giraud | France | 2024-10-20 | 30 | running | 3:08:25 | 88/650 | 14/180 | 4/35 | F40-44 | custom | trail | flat | 120 | 161 | Terrex Speed | 16/clear | 43.41378 | 4.73202
La Course entre Mer et Forêt - Semi 21.1K | Le Touquet-Paris-Plage | France | 2023-09-24 | 21.1 | running | 1:52:10 | 240/2100 | 38/780 | 9/120 | F35-39 | finisher | road | flat | 30 | 164 | Pegasus 41 | 14/overcast | 50.5243 | 1.5830
Lanzarote Marathon 21.1K | Costa Teguise | Spain | 2025-12-06 | 21.1 | running | 1:49:35 | 150/1800 | 22/520 | 5/95 | F40-44 | finisher | road | rolling | 180 | 162 | Pegasus 41 | 22/clear | 28.9981 | -13.4930
Foulées de Gordes 10K | Gordes | France | 2024-11-10 | 10 | running | 47:30 | 80/900 | 12/350 | 3/70 | F40-44 | bronze | road | rolling | 90 | 162 | Pegasus 41 | 13/clear | 43.9114 | 5.2003
`
const EU_UP = `
name: Granfondo Colnago Mont Ventoux 135K | date: 2026-06-20 | city: Vaison-la-Romaine | country: France | distance: 135 | sport: cycling | goalTime: 4:30:00
name: Mercan'Tour Madone Peille 78.5K | date: 2026-09-06 | city: Peille | country: France | distance: 78.5 | sport: cycling | goalTime: 2:55:00
name: Verona Marathon | date: 2026-10-18 | city: Verona | country: Italy | distance: 42.2 | sport: running | goalTime: 3:48:00
`

/* ===================================================================
   PERSONA 4 — Dubai · Everyday (Marcus Bennett)
   =================================================================== */
const DXB_RACES = `
ADNOC Abu Dhabi Marathon | Abu Dhabi | United Arab Emirates | 2024-12-07 | 10 | running | 52:18 | 600/3000 | 300/1500 | 60/400 | M30-34 | finisher | road | flat | 10 | 172 | Pegasus 41 | 27/clear | 24.45 | 54.38
Ras Al Khaimah Half Marathon | Ras Al Khaimah | United Arab Emirates | 2025-02-15 | 21.1 | running | 2:05:40 | 1800/5000 | 800/2400 | 120/600 | M30-34 | finisher | road | flat | 15 | 168 | Pegasus 41 | 22/clear | 25.79 | 55.94
Dubai Marathon | Dubai | United Arab Emirates | 2024-01-19 | 5 | running | 26:30 | 410/2000 | 200/1000 | 30/200 | M30-34 | finisher | road | flat | 12 | 176 | Pegasus 41 | 21/clear | 25.20 | 55.27
Berlin Marathon | Berlin | Germany | 2025-09-21 | 42.2 | running | 4:22:35 | 28500/47000 | 22000/33000 | 4100/8000 | M30-34 | custom | road | flat | 80 | 169 | Pegasus 41 | 15/overcast | 52.5200 | 13.4050   (bucket-list WMM major)
IRONMAN 70.3 Dubai | Dubai | United Arab Emirates | 2025-02-07 | 70.3 | triathlon | 6:48:20 | 1850/2400 | 1600/2000 | 280/360 | M30-34 | finisher | road | flat | 60 | 158 | Speed Concept | 24/clear | 25.20 | 55.27   (first local triathlon)
Abu Dhabi Triathlon (Sprint) | Abu Dhabi | United Arab Emirates | 2025-03-08 | Sprint | triathlon | 1:32:15 | 540/900 | 480/780 | 3/150 | M30-34 | bronze | road | flat | 20 | 165 | Speed Concept | 26/clear | 24.45 | 54.38   (local sprint tri)
Songkhla Marathon 21.1K | Songkhla | Thailand | 2024-06-16 | 21.1 | running | 2:11:40 | 410/1200 | 320/850 | 55/180 | M30-34 | finisher | road | flat | 12 | 171 | Pegasus 41 | 31/humid | 7.19882 | 100.5951   (Asia)
Venice Marathon 10K | Venice | Italy | 2024-10-27 | 10 | running | 55:10 | 1900/4500 | 1450/2900 | 240/520 | M30-34 | finisher | road | flat | 8 | 170 | Pegasus 41 | 16/clear | 45.4408 | 12.3155   (Europe)
`
const DXB_UP = `
name: Standard Chartered Dubai Marathon | date: 2026-06-11 | city: Dubai | country: United Arab Emirates | distance: 42.2 | sport: running | goalTime: 4:15:00
`

/* ===================================================================
   PERSONA 5 — South Africa · Marathoner (Thabo Nkosi)
   =================================================================== */
const SA_RACES = `
Two Oceans Marathon | Cape Town | South Africa | 2010-04-03 | 56 (custom km) | running | 6:24:50 | 6800/9000 | 5900/6500 | 800/950 | M20-24 | finisher | road | hilly | 600 | 164 | adizero | 18/clear | -33.9258 | 18.4232
Comrades Marathon | Durban | South Africa | 2010-05-30 | 89 (custom km) | running | 11:48:30 | 9800/14500 | 8900/11500 | 1400/1700 | M20-24 | finisher | road | hilly | 1800 | 165 | adizero | 14/clear | -29.8587 | 31.0218
Two Oceans Marathon | Cape Town | South Africa | 2011-04-23 | 56 (custom km) | running | 5:47:30 | 4900/9500 | 4300/6800 | 560/980 | M20-24 | finisher | road | hilly | 600 | 163 | adizero | 17/clear | -33.9258 | 18.4232
Comrades Marathon | Durban | South Africa | 2011-05-29 | 89 (custom km) | running | 10:52:20 | 7200/15000 | 6600/12000 | 1050/1750 | M20-24 | bronze | road | hilly | 1800 | 164 | adizero | 13/clear | -29.8587 | 31.0218
Two Oceans Marathon | Cape Town | South Africa | 2013-03-30 | 56 (custom km) | running | 4:58:20 | 2400/9800 | 2150/7000 | 280/1000 | M20-24 | bronze | road | hilly | 600 | 162 | adizero | 17/clear | -33.9258 | 18.4232
Comrades Marathon | Durban | South Africa | 2013-06-02 | 89 (custom km) | running | 9:58:40 | 4100/16000 | 3800/12500 | 480/1500 | M20-24 | bronze | road | hilly | 1800 | 162 | adizero | 13/clear | -29.8587 | 31.0218
Two Oceans Marathon | Cape Town | South Africa | 2014-04-19 | 56 (custom km) | running | 4:39:10 | 1500/10000 | 1350/7100 | 160/1050 | M20-24 | bronze | road | hilly | 600 | 161 | adizero | 16/clear | -33.9258 | 18.4232
Comrades Marathon | Durban | South Africa | 2014-06-01 | 89 (custom km) | running | 9:06:15 | 2600/16500 | 2400/12800 | 280/1550 | M20-24 | bronze | road | hilly | 1800 | 161 | adizero | 14/clear | -29.8587 | 31.0218
Two Oceans Marathon | Cape Town | South Africa | 2016-03-26 | 56 (custom km) | running | 4:17:40 | 720/10500 | 660/7300 | 60/1150 | M25-29 | bronze | road | hilly | 600 | 161 | adizero | 17/clear | -33.9258 | 18.4232
Comrades Marathon | Durban | South Africa | 2016-05-29 | 89 (custom km) | running | 8:21:50 | 1300/17500 | 1200/13500 | 90/1500 | M25-29 | bronze | road | hilly | 1800 | 160 | adizero | 14/clear | -29.8587 | 31.0218
Standard Chartered Dubai Marathon | Dubai | United Arab Emirates | 2017-01-20 | 42.2 | running | 2:58:20 | 420/14000 | 390/10000 | 70/2500 | M25-29 | finisher | road | flat | 10 | 165 | adizero | 20/clear | 25.20 | 55.27
Two Oceans Marathon | Cape Town | South Africa | 2017-04-15 | 56 (custom km) | running | 4:04:55 | 380/10800 | 350/7500 | 30/1180 | M25-29 | bronze | road | hilly | 600 | 160 | adizero | 16/clear | -33.9258 | 18.4232
Comrades Marathon | Durban | South Africa | 2017-06-04 | 89 (custom km) | running | 7:46:30 | 620/18000 | 580/14000 | 42/1550 | M25-29 | bronze | road | hilly | 1800 | 159 | Adios Pro 3 | 13/clear | -29.8587 | 31.0218
Two Oceans Marathon | Cape Town | South Africa | 2019-04-20 | 56 (custom km) | running | 3:51:30 | 150/11000 | 138/7600 | 12/1200 | M25-29 | silver | road | hilly | 600 | 160 | Adios Pro 3 | 18/clear | -33.9258 | 18.4232
Comrades Marathon | Durban | South Africa | 2019-06-09 | 89 (custom km) | running | 7:22:10 | 280/18500 | 260/14500 | 18/1600 | M25-29 | silver | road | hilly | 1800 | 159 | Adios Pro 3 | 15/clear | -29.8587 | 31.0218
Mumbai Marathon | Mumbai | India | 2020-01-19 | 42.2 | running | 2:48:30 | 110/9000 | 100/7000 | 16/1500 | M25-29 | bronze | road | flat | 20 | 166 | Vaporfly 3 | 28/humid | 19.0760 | 72.8777
Valencia Marathon | Valencia | Spain | 2022-12-04 | 42.2 | running | 2:38:25 | 700/30000 | 660/22000 | 80/3500 | M30-34 | finisher | road | flat | 20 | 166 | Vaporfly 3 | 14/clear | 39.4699 | -0.3763   (marathon PB)
Comrades Marathon | Durban | South Africa | 2022-08-28 | 89 (custom km) | running | 7:09:40 | 200/16000 | 185/12500 | 12/1300 | M30-34 | silver | road | hilly | 1800 | 160 | Adios Pro 3 | 16/clear | -29.8587 | 31.0218
London Marathon | London | United Kingdom | 2023-04-23 | 42.2 | running | 2:42:05 | 1800/50000 | 1600/30000 | 90/4500 | M30-34 | finisher | road | flat | 40 | 165 | Vaporfly 3 | 12/cloudy | 51.51 | -0.13
Comrades Marathon | Durban | South Africa | 2023-06-11 | 89 (custom km) | running | 6:58:20 | 160/17500 | 150/13800 | 9/1500 | M30-34 | silver | road | hilly | 1800 | 161 | Adios Pro 3 | 14/clear | -29.8587 | 31.0218
Knysna Forest Marathon | Knysna | South Africa | 2023-07-08 | 42.2 | running | 2:48:55 | 40/1100 | 38/900 | 6/200 | M30-34 | gold | trail | hilly | 600 | 164 | trail shoes | 16/clear | -34.04 | 23.05
Two Oceans Marathon | Cape Town | South Africa | 2024-03-30 | 56 (custom km) | running | 3:42:20 | 70/11200 | 64/7700 | 5/1320 | M30-34 | silver | road | hilly | 600 | 162 | Adios Pro 3 | 17/clear | -33.9258 | 18.4232
Durban International Marathon | Durban | South Africa | 2024-05-12 | 42.2 | running | 2:44:10 | 60/5000 | 55/4000 | 10/900 | M30-34 | gold | road | flat | 60 | 166 | Adios Pro 3 | 22/humid | -29.86 | 31.02
Comrades Marathon | Durban | South Africa | 2024-06-09 | 89 (custom km) | running | 6:46:50 | 120/18000 | 112/14200 | 6/1600 | M30-34 | silver | road | hilly | 1800 | 162 | Adios Pro 3 | 13/clear | -29.8587 | 31.0218
Berlin Marathon | Berlin | Germany | 2024-09-29 | 42.2 | running | 2:39:40 | 1200/45000 | 1100/30000 | 60/3000 | M30-34 | custom | road | flat | 40 | 167 | Vaporfly 3 | 15/clear | 52.52 | 13.40
Cape Town Marathon | Cape Town | South Africa | 2024-10-20 | 42.2 | running | 2:41:30 | 80/12000 | 70/8000 | 12/2200 | M30-34 | bronze | road | flat | 100 | 165 | Adios Pro 3 | 18/clear | -33.93 | 18.42
Gun Run Half Marathon | Cape Town | South Africa | 2023-10-15 | 21.1 | running | 1:14:20 | 20/8000 | 18/6000 | 3/900 | M30-34 | bronze | road | flat | 40 | 168 | Vaporfly 3 | 18/clear | -33.93 | 18.42
`
const SA_UP = `
name: Cape Town Marathon | date: 2026-10-18 | city: Cape Town | country: South Africa | distance: 42.2 | sport: running | goalTime: 2:38:00
`

/* ===================================================================
   PERSONA 6 — China · Masters 50+ (Wei Zhang)
   =================================================================== */
const CN_RACES = `
Boston Marathon | Boston | United States | 2006-04-17 | 42.2 | running | 2:55:20 | 2200/20000 | 2000/12000 | 60/2200 | M35-39 | custom | road | rolling | 280 | 168 | adizero | 8/clear | 42.36 | -71.06
Beijing Marathon | Beijing | China | 2010-10-24 | 42.2 | running | 3:02:40 | 800/30000 | 740/24000 | 30/3000 | M40-44 | bronze | road | flat | 40 | 162 | adizero | 12/clear | 39.90 | 116.41
Berlin Marathon | Berlin | Germany | 2014-09-28 | 42.2 | running | 3:08:15 | 4000/40000 | 3500/28000 | 40/2400 | M45-49 | finisher | road | flat | 40 | 160 | Adios | 15/clear | 52.52 | 13.40
Shanghai Marathon | Shanghai | China | 2019-11-17 | 42.2 | running | 3:20:50 | 2000/38000 | 1800/26000 | 20/3000 | M50-54 | silver | road | flat | 30 | 158 | Adios Pro 3 | 14/clear | 31.23 | 121.47
Great Wall Marathon | Huangyaguan | China | 2017-05-20 | 42.2 | running | 4:55:30 | 200/2500 | 180/2000 | 6/350 | M45-49 | bronze | trail | mountainous | 1800 | 156 | trail shoes | 22/humid | 40.23 | 117.49
Shanghai Marathon | Shanghai | China | 2024-11-24 | 42.2 | running | 3:26:10 | 3000/38000 | 2800/26000 | 8/3500 | M55-59 | gold | road | flat | 30 | 156 | Adios Pro 3 | 13/clear | 31.23 | 121.47
Macao International Marathon 5K | Macao | China | 2011-12-04 | 5 | running | 21:40 | 60/3000 | 55/2000 | 8/250 | M40-44 | bronze | road | flat | 10 | 158 | adizero | 16/clear | 22.1987 | 113.5439
Great Wall of China Marathon 10K | Beijing | China | 2012-05-19 | 10 | running | 44:10 | 120/1800 | 110/1500 | 10/200 | M40-44 | finisher | trail | hilly | 300 | 160 | adizero | 22/clear | 39.9042 | 116.4074
Dalian International Marathon 21.1K | Dalian | China | 2013-05-12 | 21.1 | running | 1:33:20 | 300/8000 | 280/6000 | 18/700 | M45-49 | finisher | road | flat | 40 | 158 | adizero | 14/clear | 38.9122 | 121.6022
Macao International Marathon 42.2K | Macao | China | 2015-12-06 | 42.2 | running | 3:12:30 | 250/6000 | 235/4500 | 14/600 | M45-49 | bronze | road | flat | 30 | 157 | Adios | 15/clear | 22.1987 | 113.5439
Great Wall of China Marathon 5K | Beijing | China | 2016-05-21 | 5 | running | 22:50 | 80/1500 | 72/1100 | 6/180 | M45-49 | silver | trail | hilly | 200 | 159 | adizero | 21/clear | 39.9042 | 116.4074
Dalian International Marathon 42.2K | Dalian | China | 2018-05-13 | 42.2 | running | 3:18:05 | 280/9000 | 260/6800 | 12/750 | M50-54 | silver | road | flat | 40 | 156 | Adios Pro 3 | 16/clear | 38.9122 | 121.6022
Ultra-Trail Mount Yun by UTMB 48K | Linfen | China | 2019-09-21 | 48 (custom km) | running | 6:40:20 | 90/1200 | 84/1000 | 6/120 | M50-54 | bronze | trail | mountainous | 2400 | 154 | trail shoes | 18/clear | 36.0889 | 111.5189
Shanghai Marathon | Shanghai | China | 2021-11-28 | 42.2 | running | 3:22:40 | 1800/38000 | 1650/26000 | 18/2800 | M50-54 | silver | road | flat | 30 | 156 | Adios Pro 3 | 13/clear | 31.2222 | 121.4581
Great Wall of China Marathon 21.1K | Beijing | China | 2022-05-21 | 21.1 | running | 1:38:50 | 140/1700 | 130/1400 | 8/210 | M50-54 | bronze | trail | hilly | 400 | 157 | Adios Pro 3 | 23/humid | 39.9042 | 116.4074
Ultra-Trail Shudao by UTMB 42K | Chengdu | China | 2023-04-22 | 42 (custom km) | running | 5:55:10 | 110/1400 | 100/1150 | 5/130 | M55-59 | silver | trail | mountainous | 2200 | 153 | trail shoes | 17/clear | 30.9884 | 103.6466
Macao International Marathon 21.1K | Macao | China | 2023-12-03 | 21.1 | running | 1:41:15 | 380/7000 | 350/5200 | 14/650 | M55-59 | bronze | road | flat | 20 | 155 | Adios Pro 3 | 19/clear | 22.1987 | 113.5439
Great Wall of China Marathon 10K | Beijing | China | 2024-05-18 | 10 | running | 47:30 | 160/1800 | 148/1500 | 7/190 | M55-59 | silver | trail | hilly | 300 | 156 | Adios Pro 3 | 24/humid | 39.9042 | 116.4074
Ultra-Trail Mount Yun by UTMB 68K | Linfen | China | 2024-09-21 | 68 (custom km) | running | 10:15:40 | 130/1000 | 120/850 | 9/100 | M55-59 | finisher | trail | mountainous | 3400 | 152 | trail shoes | 15/cold | 36.0889 | 111.5189
Macao International Marathon 5K | Macao | China | 2025-12-07 | 5 | running | 24:10 | 110/3000 | 100/2000 | 10/240 | M55-59 | bronze | road | flat | 10 | 155 | Adios Pro 3 | 18/clear | 22.1987 | 113.5439
Shanghai Marathon | Shanghai | China | 2025-11-30 | 42.2 | running | 3:27:50 | 2400/40000 | 2200/27000 | 14/3000 | M55-59 | silver | road | flat | 30 | 156 | Adios Pro 3 | 12/clear | 31.2222 | 121.4581
`
const CN_UP = `
name: Shanghai Marathon | date: 2026-11-29 | city: Shanghai | country: China | distance: 42.2 | sport: running | goalTime: 3:25:00
`

/* ===================================================================
   PERSONA 7 — Australia · Triathlete (Mia Thompson)
   =================================================================== */
const AUS_RACES = `
IRONMAN Cairns | Cairns | Australia | 2025-06-15 | IRONMAN | triathlon | 10:42:05 | 210/2800 | 18/600 | 3/90 | F35-39 | bronze | road | rolling | 600 | 150 | Cervelo P5 | 26/humid | -16.92 | 145.77
IRONMAN Western Australia | Busselton | Australia | 2024-12-01 | IRONMAN | triathlon | 10:58:40 | 340/3400 | 30/700 | 5/110 | F35-39 | finisher | road | flat | 200 | 148 | Cervelo P5 | 24/clear | -33.65 | 115.35
T100 Gold Coast | Gold Coast | Australia | 2025-02-09 | 70.3 | triathlon | 4:58:12 | 6/1900 | 1/400 | 1/70 | F35-39 | gold | road | flat | 300 | 158 | Cervelo P5 | 27/clear | -28.00 | 153.43
IRONMAN New Zealand | Taupo | New Zealand | 2024-03-02 | IRONMAN | triathlon | 11:05:30 | 280/2500 | 24/550 | 2/100 | F35-39 | silver | road | rolling | 700 | 150 | Cervelo P5 | 19/cloudy | -38.69 | 176.08
IRONMAN World Championship · Kona | Kailua-Kona | United States | 2024-10-26 | IRONMAN | triathlon | 11:20:15 | 900/2400 | 90/700 | 12/120 | F35-39 | custom | road | rolling | 800 | 148 | Cervelo P5 | 30/hot | 19.64 | -155.99
Cairns Marathon Festival 10K | Cairns | Australia | 2018-07-15 | 10 | running | 48:20 | 240/1200 | 90/600 | 20/110 | F30-34 | finisher | road | flat | 40 | 162 | Pegasus | 24/humid | -16.9203 | 145.7710   (year 1)
Gold Coast Marathon 21.1K | Southport | Australia | 2018-07-01 | 21.1 | running | 1:48:10 | 1800/12000 | 700/6000 | 130/1100 | F30-34 | finisher | road | flat | 30 | 160 | Pegasus | 16/clear | -27.9719 | 153.4063
Noosa Triathlon (Olympic) | Noosa Heads | Australia | 2019-11-03 | Olympic | triathlon | 2:48:30 | 900/8000 | 220/2500 | 40/400 | F30-34 | finisher | road | flat | 120 | 158 | road bike | 25/clear | -26.3983 | 153.0905   (first triathlon)
70.3 Geelong | Geelong | Australia | 2020-02-09 | 70.3 | triathlon | 5:42:10 | 800/2200 | 140/500 | 24/85 | F30-34 | finisher | road | rolling | 350 | 152 | Cervelo P5 | 20/clear | -38.1499 | 144.3617   (first 70.3)
Cole Classic Ocean Swim 2K | Sydney | Australia | 2021-02-07 | 2 (custom km) | swim | 38:40 | 320/3500 | 95/1600 | 18/260 | F30-34 | finisher | coastal | flat | 0 | 145 | wetsuit | 23/clear | -33.8915 | 151.2767
70.3 Port Macquarie | Port Macquarie | Australia | 2022-05-01 | 70.3 | triathlon | 5:18:25 | 520/2000 | 90/460 | 14/80 | F30-34 | finisher | road | rolling | 300 | 154 | Cervelo P5 | 21/clear | -31.4333 | 152.9167   (70.3 PB)
IRONMAN Cairns | Cairns | Australia | 2022-06-12 | IRONMAN | triathlon | 11:48:30 | 620/2600 | 70/560 | 12/95 | F30-34 | finisher | road | rolling | 600 | 148 | Cervelo P5 | 26/humid | -16.9203 | 145.7710   (IRONMAN debut)
Pier to Pub Ocean Swim 1.2K | Lorne | Australia | 2023-01-14 | 1.2 (custom km) | swim | 19:55 | 280/4000 | 80/1700 | 14/280 | F35-39 | finisher | coastal | flat | 0 | 150 | wetsuit | 22/clear | -38.5403 | 143.9744
HYROX Melbourne | Melbourne | Australia | 2023-09-16 | HYROX | hyrox | 1:18:40 | 220/1400 | 200/1100 | 30/240 | F35-39 | finisher | road | flat | 0 | 172 | Nano X3 | 18/indoor | -37.8136 | 144.9631   (cross-training)
Gold Coast Marathon 42.2K | Southport | Australia | 2023-07-02 | 42.2 | running | 3:38:20 | 900/9000 | 250/4500 | 45/850 | F35-39 | finisher | road | flat | 30 | 158 | Vaporfly 3 | 15/clear | -27.9719 | 153.4063   (standalone marathon)
Cairns parkrun | Cairns | Australia | 2024-04-13 | 5 | running | 20:05 | 8/350 | 3/180 | 1/40 | F35-39 | gold | road | flat | 5 | 168 | Vaporfly 3 | 24/humid | -16.9203 | 145.7710
`
const AUS_UP = `
name: IRONMAN Cairns | date: 2026-06-14 | city: Cairns | country: Australia | distance: IRONMAN | sport: triathlon | goalTime: 10:30:00
`

/* ---------- recent 2026 results (Recent Races widget) + extra upcoming (Season Planner) ---------- */
const USA_RECENT = `
Way Too Cool 50K | Cool | United States | 2026-03-14 | 50K | running | 5:38:40 | 230/720 | 58/250 | 9/52 | F35-39 | finisher | trail | hilly | 1150 | 156 | Speedgoat 6 | 13/clear | 38.8901 | -121.0124
Lake Sonoma 50 | Healdsburg | United States | 2026-05-02 | Ultra | running | 9:42:15 | 180/420 | 40/120 | 7/26 | F35-39 | finisher | trail | mountainous | 3050 | 152 | Speedgoat 6 | 16/clear | 38.7110 | -123.0010
`
const USA_UPMORE = `
name: Western States 100 | date: 2026-06-27 | city: Olympic Valley | country: United States | distance: 100 Mile | sport: running | goalTime: 26:00:00
name: Broken Arrow Skyrace 46K | date: 2026-08-21 | city: Olympic Valley | country: United States | distance: 46 | sport: running | goalTime: 7:30:00
name: Javelina Jundred | date: 2026-10-24 | city: Fountain Hills | country: United States | distance: 100 Mile | sport: running | goalTime: 24:30:00
`
const UK_RECENT = `
Victoria Park parkrun | London | United Kingdom | 2026-05-09 | 5 | running | 17:35 | 5/410 | 5/270 | 1/52 | M30-34 | gold | road | flat | 4 | 177 | Vaporfly 3 | 11/clear | 51.5363 | -0.0395
HYROX London (Pro) | London | United Kingdom | 2026-03-28 | HYROX | hyrox | 0:59:10 | 60/2100 | 56/1800 | 10/360 | M30-34 | bronze | road | flat | 0 | 180 | Nano X3 | 18/indoor | 51.51 | -0.13
`
const UK_UPMORE = `
name: T100 London | date: 2026-07-25 | city: London | country: United Kingdom | distance: 100 | sport: triathlon | goalTime: 4:15:00
name: Great North Run | date: 2026-09-13 | city: Newcastle | country: United Kingdom | distance: 21.1 | sport: running | goalTime: 1:19:00
name: London Marathon | date: 2026-04-26 | city: London | country: United Kingdom | distance: 42.2 | sport: running | goalTime: 2:55:00
`
const EU_RECENT = `
Granfondo Strade Bianche | Siena | Italy | 2026-03-07 | 130 | cycling | 4:48:20 | 110/2200 | 6/210 | 1/34 | F40-44 | silver | road | hilly | 2900 | 151 | Colnago V4Rs | 14/clear | 43.3188 | 11.3308
La Marseillaise Half Marathon | Marseille | France | 2026-05-17 | 21.1 | running | 1:47:50 | 210/1900 | 30/620 | 7/110 | F40-44 | finisher | road | rolling | 160 | 163 | Pegasus 41 | 19/clear | 43.2965 | 5.3698
`
const EU_UPMORE = `
name: Étape du Tour | date: 2026-07-12 | city: Albertville | country: France | distance: 135 | sport: cycling | goalTime: 5:10:00
name: Granfondo Stelvio Santini | date: 2026-08-30 | city: Bormio | country: Italy | distance: 151 | sport: cycling | goalTime: 5:40:00
`
const DXB_RECENT = `
Dubai Creek Striders Half Marathon | Dubai | United Arab Emirates | 2026-04-03 | 21.1 | running | 2:03:10 | 850/2400 | 400/1150 | 65/290 | M30-34 | finisher | road | flat | 14 | 167 | Pegasus 41 | 24/clear | 25.20 | 55.27
Dubai Spring 10K | Dubai | United Arab Emirates | 2026-05-15 | 10 | running | 51:05 | 560/2800 | 290/1450 | 55/380 | M30-34 | finisher | road | flat | 10 | 170 | Pegasus 41 | 28/clear | 25.20 | 55.27
`
const DXB_UPMORE = `
name: ADNOC Abu Dhabi Marathon | date: 2026-12-06 | city: Abu Dhabi | country: United Arab Emirates | distance: 42.2 | sport: running | goalTime: 4:05:00
name: RAK Half Marathon | date: 2026-08-22 | city: Ras Al Khaimah | country: United Arab Emirates | distance: 21.1 | sport: running | goalTime: 1:58:00
`
const SA_RECENT = `
Two Oceans Marathon | Cape Town | South Africa | 2026-04-04 | 56 (custom km) | running | 3:40:50 | 90/11000 | 82/7600 | 7/1300 | M30-34 | silver | road | hilly | 600 | 162 | Adios Pro 3 | 17/clear | -33.9258 | 18.4232
Cape Town 10K | Cape Town | South Africa | 2026-05-23 | 10 | running | 33:40 | 18/4000 | 17/3100 | 4/700 | M30-34 | bronze | road | flat | 40 | 168 | Vaporfly 3 | 16/clear | -33.93 | 18.42
`
const SA_UPMORE = `
name: Comrades Marathon | date: 2026-06-14 | city: Durban | country: South Africa | distance: 89 | sport: running | goalTime: 6:40:00
name: Berlin Marathon | date: 2026-09-27 | city: Berlin | country: Germany | distance: 42.2 | sport: running | goalTime: 2:37:00
`
const CN_RECENT = `
Wuxi Marathon | Wuxi | China | 2026-03-22 | 42.2 | running | 3:25:40 | 2100/35000 | 1950/24000 | 12/2800 | M55-59 | silver | road | flat | 30 | 156 | Adios Pro 3 | 13/clear | 31.4912 | 120.3119
Great Wall of China Marathon 21.1K | Beijing | China | 2026-05-16 | 21.1 | running | 1:37:20 | 130/1700 | 120/1400 | 7/200 | M55-59 | bronze | trail | hilly | 400 | 157 | Adios Pro 3 | 22/humid | 39.9042 | 116.4074
`
const CN_UPMORE = `
name: Beijing Marathon | date: 2026-11-01 | city: Beijing | country: China | distance: 42.2 | sport: running | goalTime: 3:22:00
name: Ultra-Trail Shudao by UTMB 42K | date: 2026-08-08 | city: Chengdu | country: China | distance: 42 | sport: running | goalTime: 5:50:00
`
const AUS_RECENT = `
Noosa Triathlon (Olympic) | Noosa Heads | Australia | 2026-03-22 | Olympic | triathlon | 2:34:10 | 380/8000 | 90/2500 | 12/400 | F35-39 | finisher | road | flat | 120 | 158 | Cervelo P5 | 25/clear | -26.3983 | 153.0905
Cairns Marathon Festival 10K | Cairns | Australia | 2026-05-10 | 10 | running | 45:50 | 120/1200 | 45/600 | 9/110 | F35-39 | finisher | road | flat | 40 | 161 | Vaporfly 3 | 24/humid | -16.9203 | 145.7710
`
const AUS_UPMORE = `
name: 70.3 Geelong | date: 2026-08-09 | city: Geelong | country: Australia | distance: 70.3 | sport: triathlon | goalTime: 4:52:00
name: IRONMAN Western Australia | date: 2026-12-06 | city: Busselton | country: Australia | distance: IRONMAN | sport: triathlon | goalTime: 10:40:00
`

/* ---------- exact-name repeats (Course Repeats widget needs same race 3+ times) ---------- */
const USA_REPEATS = `
Canyons Endurance Runs by UTMB 50K | Auburn | United States | 2024-04-27 | 50K | running | 5:36:10 | 260/780 | 64/265 | 11/58 | F35-39 | finisher | trail | mountainous | 2100 | 155 | Speedgoat 6 | 15/clear | 38.90 | -121.08
Canyons Endurance Runs by UTMB 50K | Auburn | United States | 2022-04-30 | 50K | running | 5:51:20 | 300/760 | 78/270 | 14/56 | F30-34 | finisher | trail | mountainous | 2100 | 158 | Speedgoat 6 | 16/clear | 38.90 | -121.08
`
const UK_REPEATS = `
HYROX London (Pro) | London | United Kingdom | 2024-02-24 | HYROX | hyrox | 1:03:10 | 130/1800 | 120/1550 | 22/320 | M30-34 | finisher | road | flat | 0 | 182 | Nano X3 | 18/indoor | 51.51 | 0.03
HYROX London (Pro) | London | United Kingdom | 2023-02-18 | HYROX | hyrox | 1:05:45 | 180/1500 | 165/1280 | 28/280 | M25-29 | finisher | road | flat | 0 | 183 | Nano X3 | 18/indoor | 51.51 | 0.03
`
const EU_REPEATS = `
Granfondo Colnago Mont Ventoux 135K | Vaison-la-Romaine | France | 2024-06-22 | 135 | cycling | 4:36:50 | 100/1900 | 5/170 | 1/29 | F40-44 | silver | road | mountainous | 3200 | 152 | Colnago V4Rs | 22/clear | 44.24 | 5.07
Granfondo Colnago Mont Ventoux 135K | Vaison-la-Romaine | France | 2023-06-18 | 135 | cycling | 4:41:05 | 120/1800 | 7/160 | 2/27 | F35-39 | bronze | road | mountainous | 3200 | 150 | Colnago V4Rs | 24/clear | 44.24 | 5.07
`
const DXB_REPEATS = `
Dubai Marathon | Dubai | United Arab Emirates | 2025-01-17 | 5 | running | 25:55 | 380/2100 | 185/1050 | 28/210 | M30-34 | finisher | road | flat | 12 | 175 | Pegasus 41 | 20/clear | 25.20 | 55.27
Dubai Marathon | Dubai | United Arab Emirates | 2023-01-20 | 5 | running | 27:40 | 470/1900 | 230/950 | 38/190 | M25-29 | finisher | road | flat | 12 | 178 | Pegasus 41 | 22/clear | 25.20 | 55.27
`
const AUS_REPEATS = `
IRONMAN Cairns | Cairns | Australia | 2023-06-11 | IRONMAN | triathlon | 11:18:40 | 480/2700 | 52/580 | 9/100 | F35-39 | finisher | road | rolling | 600 | 149 | Cervelo P5 | 26/humid | -16.92 | 145.77
IRONMAN Cairns | Cairns | Australia | 2021-06-13 | IRONMAN | triathlon | 12:02:15 | 640/2500 | 78/540 | 14/95 | F30-34 | finisher | road | rolling | 600 | 147 | Cervelo P5 | 25/humid | -16.92 | 145.77
`

/* ---------- assembled personas ---------- */

export const DEMO_PERSONAS: Record<DemoPersonaId, DemoPersona> = {
  'usa-trail': {
    id: 'usa-trail', label: 'Trail Runner', blurb: 'Mid-pack ultra finisher · Auburn, CA',
    athlete: athlete({ firstName: 'Hannah', lastName: 'Brooks', gender: 'F', dob: '1989-07-09', city: 'Auburn', country: 'United States', mainSport: 'running', units: 'imperial', club: 'Auburn Trail Runners', bio: 'Came to ultras late. In it for the finish line, not the podium.' }),
    races: buildRaces('usa', USA_RACES + USA_RECENT + USA_REPEATS),
    upcoming: buildUpcoming('usa', USA_UP + USA_UPMORE),
    testimonial: { quote: 'The race map turned my training log into something I actually want to show people.', name: 'Hannah Brooks', meta: 'Auburn, CA · Trail & ultra' },
  },
  'uk-hybrid': {
    id: 'uk-hybrid', label: 'Hybrid Athlete', blurb: 'HYROX · sub-3 marathon · T100 · London',
    athlete: athlete({ firstName: 'Jack', lastName: 'Reynolds', gender: 'M', dob: '1993-03-14', city: 'London', country: 'United Kingdom', mainSport: 'hyrox', units: 'metric', club: 'F45 Shoreditch', bio: 'Hybrid. Sub-3 marathon, HYROX podiums, T100 finisher, trains everything.' }),
    races: buildRaces('uk', UK_RACES + UK_RECENT + UK_REPEATS),
    upcoming: buildUpcoming('uk', UK_UP + UK_UPMORE),
    testimonial: { quote: 'Logged a parkrun on Saturday and my 5K PR updated before I’d finished my coffee.', name: 'Jack Reynolds', meta: 'London · Hybrid athlete' },
  },
  'eu-cyclist': {
    id: 'eu-cyclist', label: 'Cyclist', blurb: 'Gran fondo age-group hunter · Provence',
    athlete: athlete({ firstName: 'Camille', lastName: 'Dubois', gender: 'F', dob: '1985-10-30', city: 'Vaison-la-Romaine', country: 'France', mainSport: 'cycling', units: 'metric', club: 'Provence Cyclosport', bio: 'Ventoux at dawn. Podiums her age group, hunts the overall.' }),
    races: buildRaces('eu', EU_RACES + EU_RECENT + EU_REPEATS),
    upcoming: buildUpcoming('eu', EU_UP + EU_UPMORE),
    testimonial: { quote: 'Made running feel like a story instead of a spreadsheet.', name: 'Camille Dubois', meta: 'Provence · Gran fondo & road' },
  },
  'dubai-everyday': {
    id: 'dubai-everyday', label: 'Everyday Athlete', blurb: 'Weekend racer collecting finish lines · Dubai',
    athlete: athlete({ firstName: 'Marcus', lastName: 'Bennett', gender: 'M', dob: '1995-11-20', city: 'Dubai', country: 'United Arab Emirates', mainSport: 'running', units: 'metric', club: 'Dubai Creek Striders', bio: 'Weekend racer in the desert, collecting finish lines.' }),
    races: buildRaces('dxb', DXB_RACES + DXB_RECENT + DXB_REPEATS),
    upcoming: buildUpcoming('dxb', DXB_UP + DXB_UPMORE),
    testimonial: { quote: 'Stopped keeping the Google Sheet the day I imported everything here. It just pulls it all in.', name: 'Marcus Bennett', meta: 'Dubai · Everyday runner' },
  },
  'sa-marathoner': {
    id: 'sa-marathoner', label: 'Marathoner', blurb: 'Sub-2:40 + Comrades Silver · Cape Town',
    athlete: athlete({ firstName: 'Thabo', lastName: 'Nkosi', gender: 'M', dob: '1990-02-11', city: 'Cape Town', country: 'South Africa', mainSport: 'running', units: 'metric', club: 'Cape Town Marathon Club', bio: 'From an 11-hour first Comrades to Silver. 14 years on the road, now chasing sub-2:40.' }),
    races: buildRaces('sa', SA_RACES + SA_RECENT),
    upcoming: buildUpcoming('sa', SA_UP + SA_UPMORE),
    testimonial: { quote: 'I’ve got medals in a shoebox going back nine years. First time I’ve actually seen them all in one place.', name: 'Thabo Nkosi', meta: 'Cape Town · Comrades & Two Oceans' },
  },
  'china-masters': {
    id: 'china-masters', label: 'Veteran Athlete', blurb: '25-year veteran, masters podiums · Shanghai',
    athlete: athlete({ firstName: 'Wei', lastName: 'Zhang', gender: 'M', dob: '1968-07-14', city: 'Shanghai', country: 'China', mainSport: 'running', units: 'metric', club: 'Shanghai Marathon Club', bio: '25 years of racing and still chasing PBs. Age-grade obsessive.' }),
    races: buildRaces('cn', CN_RACES + CN_RECENT),
    upcoming: buildUpcoming('cn', CN_UP + CN_UPMORE),
    testimonial: { quote: 'I stopped guessing whether I was ready. The data’s all in the same screen now.', name: 'Wei Zhang', meta: 'Shanghai · Masters' },
  },
  'aus-triathlete': {
    id: 'aus-triathlete', label: 'Triathlete', blurb: 'First 10K → Kona, 8-yr progression · Cairns',
    athlete: athlete({ firstName: 'Mia', lastName: 'Thompson', gender: 'F', dob: '1988-09-03', city: 'Cairns', country: 'Australia', mainSport: 'triathlon', units: 'metric', club: 'Cairns Crocs Tri', bio: 'Swim · bike · run. Kona is the dream.' }),
    races: buildRaces('aus', AUS_RACES + AUS_RECENT + AUS_REPEATS),
    upcoming: buildUpcoming('aus', AUS_UP + AUS_UPMORE),
    testimonial: { quote: 'The race predictor put my IRONMAN run split closer than my coach did.', name: 'Mia Thompson', meta: 'Cairns · Triathlete' },
  },
}

export const DEMO_PERSONA_LIST: DemoPersona[] = Object.values(DEMO_PERSONAS)

export const DEMO_TESTIMONIALS: DemoTestimonial[] = DEMO_PERSONA_LIST.map(p => p.testimonial)
