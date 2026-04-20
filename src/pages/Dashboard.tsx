import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useDashStore } from '@/stores/useDashStore'
import { useWearableStore } from '@/stores/useWearableStore'
import { selectRaces, selectNextRace, selectAthlete, selectDashZoneCollapse, selectUpcomingRaces, selectFocusRace, selectFocusRaceId } from '@/stores/selectors'
import { AddRaceModal } from '@/components/AddRaceModal'
import { ViewEditRaceModal } from '@/components/ViewEditRaceModal'
import { TimePickerWheel } from '@/components/TimePickerWheel'
import type { HMS } from '@/components/TimePickerWheel'
import type { Race } from '@/types'
import { useUnits, distUnit } from '@/lib/units'
import {
  bestRiegelTable,
  bestVDOT, equivalentPerformances, paceZones, vdotHistory,
  goalPaceCalc, parseTimeSecs as fParseTimeSecs, parseDistKm as fParseDistKm,
  bestWeatherImpact, distanceMilestones, secsToHMS as fSecsToHMS,
  raceDensityWarnings, findCourseRepeats,
} from '@/lib/raceFormulas'
import { fetchStravaActivities } from '@/lib/strava'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((new Date(dateStr + 'T00:00:00').getTime() - now.getTime()) / 86400000))
}

function daysAgo(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.round((now.getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000)
}

function fmtDateIntl(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}


// Canonical label → km mapping (covers both numeric strings and named distances)
const DIST_LABEL_KM: Record<string, number> = {
  'marathon': 42.195,
  'full marathon': 42.195,
  'half marathon': 21.0975,
  'half': 21.0975,
  'ironman': 226,
  'full ironman': 226,
  'half ironman': 113,
  '70.3': 113,
  'olympic': 51.5,
  'olympic triathlon': 51.5,
  'sprint': 25.75,
  'sprint triathlon': 25.75,
  '5k': 5,
  '10k': 10,
  '15k': 15,
  '20k': 20,
  '25k': 25,
  '30k': 30,
  '50k': 50,
  '60k': 60,
  '80k': 80,
  '90k': 90,
  '100k': 100,
  '160k': 160,
  '50mi': 80.47,
  '100mi': 160.93,
  'ultra': 50,
  'ultramarathon': 50,
  'mile': 1.609,
  '1 mile': 1.609,
  '5 mile': 8.047,
  '10 mile': 16.09,
}

function distanceToKm(d: string | undefined): number {
  if (!d) return 0
  const n = parseFloat(d)
  if (!isNaN(n)) return n
  return DIST_LABEL_KM[d.toLowerCase().trim()] ?? 0
}

// Normalize different representations of the same distance to one canonical key
function normalizeDistKey(d: string | undefined): string {
  if (!d) return ''
  const km = distanceToKm(d)
  if (km <= 0) return d.toLowerCase().trim()
  if (km >= 42 && km <= 42.3) return 'Marathon'
  if (km >= 21 && km <= 21.2) return 'Half Marathon'
  if (km >= 10 && km <= 10.1) return '10K'
  if (km >= 5 && km <= 5.1) return '5K'
  return `${km}`
}

function distBadge(d: string | undefined): string {
  if (!d) return ''
  const n = distanceToKm(d)
  if (n === 0) return d
  if (n >= 225.9 && n <= 226.1) return 'Ironman / Full Distance'
  if (n >= 112.9 && n <= 113.1) return '70.3 / Middle Distance'
  if (n >= 51.4 && n <= 51.6) return 'Olympic'
  if (n >= 42 && n <= 42.3) return 'Marathon'
  if (n >= 21 && n <= 21.2) return 'Half Marathon'
  if (n >= 10 && n <= 10.1) return '10K'
  if (n >= 5 && n <= 5.1) return '5K'
  if (n > 42.3) return 'Ultra Marathon'
  return `${n}K`
}

function buildPBMap(races: Race[]): Record<string, Race> {
  const pb: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const key = normalizeDistKey(r.distance)
    if (!pb[key] || r.time < pb[key].time!) pb[key] = r
  }
  return pb
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'GOOD MORNING'
  if (h < 17) return 'GOOD AFTERNOON'
  return 'GOOD EVENING'
}

function uniqueCountries(races: Race[]) {
  return new Set(races.map(r => r.country).filter(Boolean)).size
}
function totalKm(races: Race[]) {
  return races.reduce((s, r) => s + distanceToKm(r.distance), 0)
}
function medalCount(races: Race[]) {
  return races.filter(r => r.medal && r.medal !== 'finisher').length
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

function parseHMS(str: string): number | null {
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN)) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

function secsToHMS(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function parsePlacing(str: string | undefined): { pos: number; total: number; percentile: number } | null {
  if (!str) return null
  const m = str.match(/(\d+)\s*[/\\]\s*(\d+)/)
  if (!m) return null
  const pos = parseInt(m[1], 10)
  const total = parseInt(m[2], 10)
  if (!pos || !total || total === 0) return null
  return { pos, total, percentile: Math.round((1 - (pos - 1) / total) * 100) }
}

function computeMomentum(races: Race[]): { score: number; badge: string } {
  const past = races.filter(r => r.date <= todayStr() && r.time && r.distance)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (past.length < 2) return { score: 1.0, badge: 'NEUTRAL' }
  const pbMap = buildPBMap(past)
  const last = past[0]
  const pb = pbMap[normalizeDistKey(last.distance)]
  if (!pb?.time || !last.time) return { score: 1.0, badge: 'NEUTRAL' }
  const lastSecs = parseHMS(last.time)
  const pbSecs = parseHMS(pb.time)
  if (!lastSecs || !pbSecs || pbSecs === 0) return { score: 1.0, badge: 'NEUTRAL' }
  const ratio = Math.min(1.0, pbSecs / lastSecs)
  const badge = ratio >= 1.0 ? 'HOT' : ratio >= 0.97 ? 'RISING' : ratio >= 0.93 ? 'NEUTRAL' : 'COOLING'
  return { score: parseFloat(ratio.toFixed(2)), badge }
}

// Official BAA qualifying standards (seconds) by Boston year.
// 2023 and earlier: original standards.
// 2024+: tightened by 5 minutes across all age groups (announced 2023).
const BQ_BY_YEAR: Record<string, Record<string, number>> = {
  '2023': {
    M18: 10800, M35: 11100, M40: 11400, M45: 12000, M50: 12300,
    M55: 12900, M60: 13800, M65: 14700, M70: 15600, M75: 16500, M80: 17400,
    F18: 12600, F35: 12900, F40: 13200, F45: 13800, F50: 14100,
    F55: 14700, F60: 15600, F65: 16500, F70: 17400, F75: 18300, F80: 19200,
  },
  '2024': {
    // 5 minutes faster than 2023 across all age groups
    M18: 10500, M35: 10800, M40: 11100, M45: 11700, M50: 12000,
    M55: 12600, M60: 13500, M65: 14400, M70: 15300, M75: 16200, M80: 17100,
    F18: 12300, F35: 12600, F40: 12900, F45: 13500, F50: 13800,
    F55: 14400, F60: 15300, F65: 16200, F70: 17100, F75: 18000, F80: 18900,
  },
}
// 2025+ assumed same as 2024 until BAA announces new standards
function getBQStandards(bostonYear: number) {
  if (bostonYear <= 2023) return BQ_BY_YEAR['2023']
  return BQ_BY_YEAR['2024']
}

function nextBostonYear(): number {
  const now = new Date()
  const y = now.getFullYear()
  // Boston is ~April 21; if past that date, next race is next year
  return (now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() > 21)) ? y + 1 : y
}

function bqQualWindow(bostonYear: number) {
  // BAA qualifying window: Sept 16 of two years prior → Sept 15 of prior year
  return { start: `${bostonYear - 2}-09-16`, end: `${bostonYear - 1}-09-15` }
}

function getBQTarget(dob: string | undefined, gender: string | undefined, bostonYear: number): number | null {
  const age = computeAge(dob)
  if (age === null || !gender) return null
  const g = gender === 'M' ? 'M' : 'F'
  const brackets = [80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 18]
  const bracket = brackets.find(b => age >= b) ?? 18
  return getBQStandards(bostonYear)[`${g}${bracket}`] ?? null
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    {[4,8,12].flatMap(x => [4,8,12].map(y =>
      <circle key={`${x}${y}`} cx={x} cy={y} r={1.4}/>
    ))}
  </svg>
)

const IconPin = ({ color = 'var(--orange)', size = 12 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
)

const IconEdit = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: '46px', height: '27px',
        background: checked ? 'var(--orange)' : 'var(--surface3)',
        borderRadius: '14px',
        border: `1px solid ${checked ? 'rgba(var(--orange-ch), 0.5)' : 'var(--border2)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '22px' : '3px',
        width: '19px', height: '19px',
        background: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }} />
    </div>
  )
}

// ─── Greeting Card ────────────────────────────────────────────────────────────

type HourlyPill = { time: string; temp: number | null; icon: string; isSun?: 'rise' | 'set' }
type GeoWeather = { temp: number; icon: string; desc: string; low: number; high: number; hourly: HourlyPill[] }

function GreetingCard({ onCustomize }: { onCustomize: () => void }) {
  const athlete   = useAthleteStore(selectAthlete)
  const firstName = (athlete?.firstName ?? 'Athlete').toUpperCase()

  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'loading' | 'ok' | 'denied' | 'error'>('idle')
  const [weather, setWeather]   = useState<GeoWeather | null>(null)

  // On mount: check if we already have cached coords
  useEffect(() => {
    try {
      const cached = localStorage.getItem('fl2_geo_weather')
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        // Cache valid for 30 min AND must have 5 future hourly slots (old cache had only 1 day)
        const futureHours = (data?.hourly ?? []).filter((h: { time: string }) => new Date(h.time).getTime() > Date.now()).length
        if (Date.now() - ts < 30 * 60 * 1000 && futureHours >= 5) { setWeather(data); setGeoState('ok'); return }
      }
      // Check if permission was previously granted
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(p => {
          if (p.state === 'granted') requestWeather()
          else if (p.state === 'denied') setGeoState('denied')
          else setGeoState('asking')
        }).catch(() => setGeoState('asking'))
      } else {
        setGeoState('asking')
      }
    } catch { setGeoState('asking') }
  }, [])

  function requestWeather() {
    setGeoState('loading')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude } = pos.coords
          // Fetch 2 days so we always have 5 future hours even late at night
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=2`)
          const d   = await res.json()
          const wc: number = d?.current?.weather_code ?? 0
          const currentIsDay: boolean = (d?.current?.is_day ?? 1) === 1
          const icon = wcIcon(wc, currentIsDay)
          const desc = wcDesc(wc)
          const temp  = Math.round(d?.current?.temperature_2m ?? 0)
          const low   = temp
          const high  = temp
          // Next 5 hours starting from current hour — compare by timestamp, not hour number
          const times: string[]   = d?.hourly?.time ?? []
          const temps: number[]   = d?.hourly?.temperature_2m ?? []
          const codes: number[]   = d?.hourly?.weather_code ?? []
          const isDays: number[]  = d?.hourly?.is_day ?? []
          const nowMs = Date.now()

          // Sunrise/sunset times for today and tomorrow (daily arrays)
          const sunriseTimes: string[] = d?.daily?.sunrise ?? []
          const sunsetTimes: string[]  = d?.daily?.sunset  ?? []
          const sunEvents: { ms: number; kind: 'rise' | 'set' }[] = [
            ...sunriseTimes.map(t => ({ ms: new Date(t).getTime(), kind: 'rise' as const })),
            ...sunsetTimes.map(t  => ({ ms: new Date(t).getTime(), kind: 'set'  as const })),
          ].filter(e => e.ms >= nowMs - 60 * 60 * 1000)  // only future-ish events

          // Build 5 base hourly slots
          const baseSlots = times
            .map((t, i) => ({ t, ms: new Date(t).getTime(), temp: temps[i], isDay: isDays[i] === 1, code: codes[i] }))
            .filter(x => x.ms >= nowMs - 60 * 60 * 1000)
            .slice(0, 5)

          // Merge sun events into slots: if a sun event falls within a slot's hour, inject it
          const hourly: HourlyPill[] = baseSlots.map(slot => {
            const slotEnd = slot.ms + 3600 * 1000
            const sun = sunEvents.find(e => e.ms >= slot.ms && e.ms < slotEnd)
            if (sun) {
              return {
                time: new Date(sun.ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
                temp: null,
                icon: sun.kind === 'rise' ? '🌅' : '🌇',
                isSun: sun.kind,
              }
            }
            return {
              time: new Date(slot.t).toLocaleTimeString([], { hour: 'numeric', hour12: true }),
              temp: Math.round(slot.temp),
              icon: wcIcon(slot.code, slot.isDay),
            }
          })

          const data: GeoWeather = { temp, icon, desc, low, high, hourly }
          setWeather(data); setGeoState('ok')
          localStorage.setItem('fl2_geo_weather', JSON.stringify({ data, ts: Date.now() }))
        } catch { setGeoState('error') }
      },
      err => { setGeoState(err.code === 1 ? 'denied' : 'error') },
      { timeout: 8000 }
    )
  }

  // WMO weather code helpers — isDay=true for day icons, false for night icons
  function wcIcon(code: number, isDay = true): string {
    if (code === 0) return isDay ? '☀️' : '🌙'
    if (code <= 2)  return isDay ? '⛅' : '🌙'
    if (code <= 3)  return '☁️'
    if (code <= 49) return '🌫'
    if (code <= 67) return isDay ? '🌧' : '🌧'
    if (code <= 77) return '🌨'
    if (code <= 82) return isDay ? '🌦' : '🌧'
    if (code <= 99) return '⛈'
    return isDay ? '🌤' : '🌙'
  }
  function wcDesc(code: number): string {
    if (code === 0) return 'Clear'
    if (code <= 2)  return 'Partly cloudy'
    if (code <= 3)  return 'Overcast'
    if (code <= 49) return 'Foggy'
    if (code <= 67) return 'Rainy'
    if (code <= 77) return 'Snowy'
    if (code <= 82) return 'Showers'
    if (code <= 99) return 'Thunderstorm'
    return 'Mixed'
  }

  return (
    <div style={st.greetingCard}>
      <div style={st.greetingContent}>
        <div style={st.greetingLine}>
          <span style={st.greetingText}>{getGreeting()},&nbsp;</span>
          <span style={st.greetingName}>{firstName}</span>
        </div>

        {/* Weather — 5-hour strip only */}
        {geoState === 'ok' && weather ? (
          <div style={{ marginTop: '10px' }}>
            {weather.hourly.length > 0 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                {weather.hourly.map((h, i) => (
                  <div key={i} style={{
                    flex: 1,
                    background: h.isSun ? 'rgba(var(--orange-ch), 0.10)' : 'var(--surface3)',
                    border: h.isSun ? '1px solid rgba(var(--orange-ch), 0.30)' : '1px solid transparent',
                    borderRadius: '10px',
                    padding: '10px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '5px',
                    minWidth: 0,
                  }}>
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>{h.icon}</span>
                    {h.temp !== null
                      ? <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '14px', color: 'var(--white)', letterSpacing: '0.02em' }}>{h.temp}°</span>
                      : <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '9px', color: 'var(--orange)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h.isSun === 'rise' ? 'RISE' : 'SET'}</span>
                    }
                    <span style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.02em', textAlign: 'center', whiteSpace: 'nowrap' }}>{h.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : geoState === 'asking' ? (
          <button
            onClick={requestWeather}
            style={{ marginTop: '8px', background: 'rgba(var(--orange-ch),0.12)', border: '1px solid rgba(var(--orange-ch),0.35)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            📍 Tap to show local weather
          </button>
        ) : geoState === 'loading' ? (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>Getting your weather…</div>
        ) : geoState === 'denied' ? (
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)' }}>Location blocked · Enable in browser settings</div>
        ) : (
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--muted)' }}>Weather unavailable</div>
        )}
      </div>
      <button style={st.gridBtn} onClick={onCustomize} aria-label="Customise dashboard">
        <IconGrid />
      </button>
    </div>
  )
}

// ─── Pre-Race Briefing ────────────────────────────────────────────────────────

function PreRaceBriefing({ onAddRace }: { onAddRace: () => void }) {
  const races    = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)   // always nearest upcoming — never follows focus pin
  const today    = todayStr()
  const pbMap    = useMemo(() => buildPBMap(races), [races])

  const lastRace = useMemo(
    () => races.filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0],
    [races, today],
  )

  const lastPill = useMemo(() => {
    if (!lastRace?.time) return null
    const isPB = pbMap[lastRace.distance]?.id === lastRace.id
    return { text: `Last: ${lastRace.time} ${distBadge(lastRace.distance)}`, isPB }
  }, [lastRace, pbMap])

  if (!nextRace) {
    if (lastRace && daysAgo(lastRace.date) <= 7) {
      const d = daysAgo(lastRace.date)
      const dLabel = d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`
      return (
        <div style={st.briefingCard}>
          <div style={st.briefingInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IconPin />
              <span style={st.briefingTag}>JUST RACED</span>
            </div>
            <div style={st.briefingTitle}>{(lastRace.name ?? '').toUpperCase()}</div>
            <div style={st.briefingMeta}>{dLabel} · {distBadge(lastRace.distance) || (lastRace.distance + 'K')}</div>
            {lastRace.time && <div style={st.lastRacePill}>Finish: {lastRace.time}</div>}
            <button style={{ ...st.ctaPrimary, marginTop: '12px' }} onClick={onAddRace}>+ Add Next Race</button>
          </div>
        </div>
      )
    }
    return (
      <div style={st.briefingCard}>
        <div style={st.briefingInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <IconPin />
            <span style={st.briefingTag}>{races.length === 0 ? 'ADD YOUR FIRST RACE' : 'WHAT\'S NEXT?'}</span>
          </div>
          <div style={st.briefingTitle}>{races.length === 0 ? 'Your race story awaits' : 'No upcoming race'}</div>
          <button style={st.ctaPrimary} onClick={onAddRace}>+ Log First Race</button>
        </div>
      </div>
    )
  }

  const days = daysUntil(nextRace.date)
  const dayLabel = days === 0 ? 'TODAY!' : days === 1 ? 'IN 1 DAY' : `IN ${days} DAYS`

  return (
    <div style={st.briefingCard}>
      <div style={st.briefingInner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <IconPin />
          <span style={st.briefingTag}>NEXT RACE</span>
        </div>
        <div style={st.briefingTitle}>
          {(nextRace.name ?? '').toUpperCase()}
        </div>
        <div style={st.briefingTitle}>
          {dayLabel}
        </div>
        <div style={st.briefingMeta}>
          {fmtDateIntl(nextRace.date)}
          {nextRace.distance ? ` · ${distBadge(nextRace.distance) || nextRace.distance + 'K'}` : ''}
        </div>
        {lastPill && (
          <div style={st.lastRacePill}>
            {lastPill.text}
            {lastPill.isPB && <span style={{ marginLeft: '5px' }}>↑ PB</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Countdown Card ───────────────────────────────────────────────────────────

// ─── Edit Upcoming Race Sheet ────────────────────────────────────────────────

function EditUpcomingRaceSheet({ race, onClose, zIndex = 900 }: { race: Race; onClose: () => void; zIndex?: number }) {
  const updateRace    = useRaceStore(s => s.updateRace)
  const deleteRace    = useRaceStore(s => s.deleteRace)
  const setFocusRaceId = useRaceStore(s => s.setFocusRaceId)
  const focusRaceId   = useRaceStore(selectFocusRaceId)

  const [priority, setPriority] = useState<string>(race.priority ?? 'A')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Parse existing goalTime string (H:MM:SS) into HMS for the wheel
  const [goalHMS, setGoalHMS] = useState<HMS>(() => {
    const parts = (race.goalTime ?? '').split(':').map(Number)
    return { h: parts[0] || 0, m: parts[1] || 0, s: parts[2] || 0 }
  })

  const isFocused = focusRaceId === race.id

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleSave() {
    const hasGoal = goalHMS.h > 0 || goalHMS.m > 0 || goalHMS.s > 0
    const goalTime = hasGoal
      ? `${goalHMS.h}:${String(goalHMS.m).padStart(2,'0')}:${String(goalHMS.s).padStart(2,'0')}`
      : undefined
    updateRace(race.id, { priority: priority as Race['priority'], goalTime })
    onClose()
  }

  function handleDelete() {
    deleteRace(race.id)
    onClose()
  }

  const PRIORITIES = [
    { key: 'A', label: 'A RACE', desc: 'Season goal' },
    { key: 'B', label: 'B RACE', desc: 'Strong effort' },
    { key: 'C', label: 'C RACE', desc: 'Training run' },
  ]

  return (
    <div style={{ ...st.modalOverlay, zIndex }} onClick={onClose}>
      <div style={{ ...st.customizeSheet, maxHeight: '85vh', paddingBottom: '0', overflowY: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '0 auto 20px', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
              {race.name ?? 'Upcoming Race'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {fmtDateIntl(race.date)}{race.city ? ` · ${race.city}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }} aria-label="Close">✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 0 12px' }}>

          {/* Priority */}
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>
              RACE PRIORITY
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PRIORITIES.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPriority(p.key)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    borderRadius: '10px',
                    border: priority === p.key ? '2px solid var(--orange)' : '1.5px solid var(--border2)',
                    background: priority === p.key ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--headline)',
                    fontWeight: 900,
                    fontSize: '18px',
                    color: priority === p.key ? 'var(--orange)' : 'var(--white)',
                    letterSpacing: '0.04em',
                  }}>{p.key}</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', color: priority === p.key ? 'var(--orange)' : 'var(--muted)', textTransform: 'uppercase' }}>{p.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: 1.3 }}>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Goal time — scroll wheel, 0–99h */}
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px' }}>
              GOAL TIME <span style={{ opacity: 0.5, fontWeight: 400, textTransform: 'lowercase', letterSpacing: 0 }}>(optional)</span>
            </div>
            <TimePickerWheel value={goalHMS} onChange={setGoalHMS} maxHours={99} />
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
              Scroll to set · Used by Gap To Goal widget
            </div>
          </div>

          {/* Focus race toggle */}
          <button
            onClick={() => { setFocusRaceId(isFocused ? null : race.id); onClose() }}
            style={{
              width: '100%',
              background: isFocused ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
              border: isFocused ? '1.5px solid rgba(var(--orange-ch),0.5)' : '1.5px solid var(--border2)',
              borderRadius: '10px',
              color: isFocused ? 'var(--orange)' : 'var(--white)',
              fontFamily: 'var(--headline)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isFocused ? '📌 Focused Race (tap to unpin)' : '📌 Set as Focus Race'}
          </button>

          {/* Delete */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                background: 'transparent',
                border: '1.5px solid rgba(255,80,80,0.35)',
                borderRadius: '10px',
                color: '#ff6b6b',
                fontFamily: 'var(--headline)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '12px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              🗑 Remove Race
            </button>
          ) : (
            <div style={{ background: 'rgba(255,80,80,0.08)', border: '1.5px solid rgba(255,80,80,0.35)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '13px', color: '#ff6b6b', marginBottom: '12px', fontWeight: 600 }}>
                Remove {race.name ?? 'this race'} from your calendar?
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border2)', background: 'var(--surface3)', color: 'var(--white)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', letterSpacing: '0.06em' }}>
                  CANCEL
                </button>
                <button onClick={handleDelete} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#ff4444', color: '#fff', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', cursor: 'pointer', letterSpacing: '0.06em' }}>
                  YES, REMOVE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save button sticky footer */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--surface2)' }}>
          <button onClick={handleSave} style={{
            width: '100%', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: '10px',
            padding: '14px', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px',
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  )
}

function CountdownCard({ race, onShowAll, upcomingRaces, onSelectRace }: { race: Race; onShowAll: () => void; upcomingRaces: Race[]; onSelectRace: (id: string) => void }) {
  const [now, setNow]         = useState(() => Date.now())
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff = Math.max(0, new Date(race.date + 'T00:00:00').getTime() - now)
  const days = Math.floor(diff / 86400000)
  const hrs  = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  const p2   = (n: number) => n.toString().padStart(2, '0')
  const priority = race.priority ?? 'A'

  return (
    <>
      {showEdit && <EditUpcomingRaceSheet race={race} onClose={() => setShowEdit(false)} />}
      <div style={st.countdownCard}>
        {/* Header row */}
        <div style={st.countdownHeader}>
          <div style={st.countdownHeaderLeft}>
            <span style={st.countdownDash}>—</span>
            <span style={st.aBadge}>{priority}</span>
            <span style={st.aRaceLabel}>{priority} RACE</span>
          </div>
          <button style={st.editBtn} onClick={() => setShowEdit(true)}>
            <IconEdit />
            <span>EDIT</span>
          </button>
        </div>

        {/* Race picker chips — shown only when there are multiple upcoming races */}
        {upcomingRaces.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' as const }}>
            {[...upcomingRaces].sort((a, b) => a.date.localeCompare(b.date)).map(r => (
              <button key={r.id} onClick={() => onSelectRace(r.id)} style={{
                flexShrink: 0,
                padding: '4px 10px',
                borderRadius: '20px',
                border: `1px solid ${r.id === race.id ? 'var(--orange)' : 'var(--border2)'}`,
                background: r.id === race.id ? 'rgba(var(--orange-ch),0.15)' : 'transparent',
                color: r.id === race.id ? 'var(--orange)' : 'var(--muted)',
                fontSize: '11px',
                fontFamily: 'var(--headline)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
              }}>
                {(r.name ?? '').toUpperCase().slice(0, 20)}
              </button>
            ))}
          </div>
        )}

        {/* Race name */}
        <div style={st.countdownRaceName}>{(race.name ?? '').toUpperCase()}</div>

        {/* Location */}
        <div style={st.countdownLocation}>
          <IconPin size={11} />
          <span style={{ color: 'var(--orange)' }}>
            {[race.city, race.country].filter(Boolean).join(', ')}
          </span>
          {race.distance && (
            <span style={{ color: 'var(--muted)' }}>
              &nbsp;·&nbsp;{distBadge(race.distance) || race.distance + 'K'}
            </span>
          )}
          <span style={{ color: 'var(--muted)' }}>&nbsp;·&nbsp;{fmtDateIntl(race.date)}</span>
        </div>

        {/* Countdown digits */}
        <div style={st.countdownRow}>
          <div style={st.countdownUnit}>
            <div style={st.countdownNum}>{days}</div>
            <div style={st.countdownUnitLabel}>DAYS</div>
          </div>
          <div style={st.countdownSep}>:</div>
          <div style={st.countdownUnit}>
            <div style={st.countdownNum}>{p2(hrs)}</div>
            <div style={st.countdownUnitLabel}>HRS</div>
          </div>
          <div style={st.countdownSep}>:</div>
          <div style={st.countdownUnit}>
            <div style={st.countdownNum}>{p2(mins)}</div>
            <div style={st.countdownUnitLabel}>MINS</div>
          </div>
          <div style={st.countdownSep}>:</div>
          <div style={st.countdownUnit}>
            <div style={st.countdownNum}>{p2(secs)}</div>
            <div style={st.countdownUnitLabel}>SECS</div>
          </div>
        </div>

        <div style={st.countdownDivider} />
        <button style={st.allRacesBtn} onClick={onShowAll}>ALL UPCOMING RACES →</button>
      </div>
    </>
  )
}

// ─── Course Info Card ─────────────────────────────────────────────────────────

function CourseInfoCard({ race }: { race: Race }) {
  const tags = useMemo(() => {
    const t: string[] = []
    if (race.surface) t.push(race.surface.toUpperCase())
    if (typeof race.elevation === 'number') t.push(race.elevation > 300 ? 'HILLY' : 'FLAT')
    return t
  }, [race])

  if (!race.notes && tags.length === 0) return null

  return (
    <div style={st.infoCard}>
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {tags.map(tag => <span key={tag} style={st.terrainTag}>{tag}</span>)}
        </div>
      )}
      {race.notes && <p style={st.infoText}>{race.notes}</p>}
    </div>
  )
}

// ─── Weather Card ─────────────────────────────────────────────────────────────

// Climate norms lookup cache (keyed by "city,country,month")
const _climateCache: Record<string, { min: number; max: number; precip: number; icon: string } | null> = {}

async function fetchClimatNorms(city: string, country: string, month: number): Promise<{ min: number; max: number; precip: number; icon: string } | null> {
  const cacheKey = `${city},${country},${month}`
  if (cacheKey in _climateCache) return _climateCache[cacheKey]

  try {
    // Step 1 — geocode city via Open-Meteo geocoding API
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
    const geoData = await geoRes.json()
    const loc = geoData?.results?.[0]
    if (!loc) { _climateCache[cacheKey] = null; return null }
    const { latitude, longitude } = loc

    // Step 2 — fetch historical data for same month in last 5 years via archive API
    const year = new Date().getFullYear()
    const pad  = (n: number) => n.toString().padStart(2, '0')
    // Query a 3-day window centred on the 15th of that month across 5 years
    const requests = [1,2,3,4,5].map(y => {
      const yr = year - y
      const start = `${yr}-${pad(month)}-13`
      const end   = `${yr}-${pad(month)}-17`
      return fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`)
        .then(r => r.json())
    })
    const results = await Promise.all(requests)

    let totalMax = 0, totalMin = 0, totalPrecip = 0, count = 0
    for (const r of results) {
      const maxArr: number[] = r?.daily?.temperature_2m_max ?? []
      const minArr: number[] = r?.daily?.temperature_2m_min ?? []
      const preArr: number[] = r?.daily?.precipitation_sum ?? []
      for (let i = 0; i < maxArr.length; i++) {
        if (maxArr[i] != null && minArr[i] != null) {
          totalMax += maxArr[i]; totalMin += minArr[i]
          totalPrecip += (preArr[i] ?? 0)
          count++
        }
      }
    }
    if (count === 0) { _climateCache[cacheKey] = null; return null }

    const avgMax    = Math.round(totalMax / count)
    const avgMin    = Math.round(totalMin / count)
    const avgPrecip = totalPrecip / count

    // Pick icon by temp + precip
    let icon = '☀️'
    if (avgPrecip > 4)          icon = '🌧'
    else if (avgPrecip > 1.5)   icon = '🌦'
    else if (avgMax < 5)        icon = '🥶'
    else if (avgMax < 15)       icon = '⛅'
    else if (avgMax > 32)       icon = '🌡'

    const result = { min: avgMin, max: avgMax, precip: Math.round(avgPrecip * 10) / 10, icon }
    _climateCache[cacheKey] = result
    return result
  } catch {
    _climateCache[cacheKey] = null
    return null
  }
}

function WeatherCard({ race }: { race: Race }) {
  const days     = daysUntil(race.date)
  const location = [race.city, race.country].filter(Boolean).join(', ').toUpperCase()
  const isLive   = days <= 14

  // Climate estimate state (used when >14 days)
  const [climate, setClimate] = useState<{ min: number; max: number; precip: number; icon: string } | null | 'loading'>('loading')

  // Live forecast state (used when ≤14 days)
  const [forecast, setForecast] = useState<{ min: number; max: number; icon: string } | null>(null)

  useEffect(() => {
    if (isLive) {
      // Actual 14-day forecast via Open-Meteo (same logic as before but targeted at race date)
      if (!race.city && !race.country) return
      const city = race.city ?? race.country ?? ''
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
        .then(r => r.json())
        .then(async geo => {
          const loc = geo?.results?.[0]
          if (!loc) return
          const { latitude, longitude } = loc
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`)
          const data = await res.json()
          // Find the day that matches race date
          const dates: string[] = data?.daily?.time ?? []
          const idx = dates.findIndex((d: string) => d === race.date)
          if (idx === -1) return
          const max  = Math.round(data.daily.temperature_2m_max[idx])
          const min  = Math.round(data.daily.temperature_2m_min[idx])
          const prec: number = data.daily.precipitation_probability_max?.[idx] ?? 0
          let icon = '☀️'
          if (prec > 60)       icon = '🌧'
          else if (prec > 30)  icon = '🌦'
          else if (max < 5)    icon = '🥶'
          else if (max < 15)   icon = '⛅'
          else if (max > 32)   icon = '🌡'
          setForecast({ min, max, icon })
        })
        .catch(() => {})
    } else {
      // Climate estimate
      if (!race.city && !race.country) { setClimate(null); return }
      const city    = race.city ?? ''
      const country = race.country ?? ''
      const month   = new Date(race.date + 'T00:00:00').getMonth() + 1
      setClimate('loading')
      fetchClimatNorms(city, country, month).then(setClimate)
    }
  }, [race.date, race.city, race.country, isLive])

  return (
    <div style={st.weatherCard}>
      <div style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
        {location}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '32px', lineHeight: 1, flexShrink: 0 }}>
          {isLive
            ? (forecast?.icon ?? '🌤')
            : (climate && climate !== 'loading' ? climate.icon : '🌤')}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isLive ? (
            forecast ? (
              <>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '18px', color: 'var(--white)', letterSpacing: '0.02em' }}>
                  {forecast.min}° – {forecast.max}°C
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--orange)', marginTop: '2px', lineHeight: 1.4, fontWeight: 600 }}>
                  RACE DAY FORECAST
                </div>
              </>
            ) : (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4 }}>Loading forecast…</div>
            )
          ) : (
            climate && climate !== 'loading' ? (
              <>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '18px', color: 'var(--white)', letterSpacing: '0.02em' }}>
                  {climate.min}° – {climate.max}°C
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>
                  Typical for {new Date(race.date + 'T00:00:00').toLocaleString('default', { month: 'long' })} · ~{climate.precip}mm/day
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '1px', lineHeight: 1.4 }}>
                  Forecast from {days - 14}d out
                </div>
              </>
            ) : (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
                {climate === 'loading' ? 'Loading climate data…' : 'Climate data unavailable'}
              </div>
            )
          )}
        </div>
        <div style={st.daysPill}>{days} DAYS</div>
      </div>
    </div>
  )
}

// ─── Recent Races ─────────────────────────────────────────────────────────────

function RecentRaces({ onAddRace }: { onAddRace: () => void }) {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const pbMap = useMemo(() => buildPBMap(races), [races])
  const recent = useMemo(() => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return races
      .filter(r => r.date <= today && r.date >= cutoffStr)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [races, today])

  if (races.length === 0) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>RECENT RACES</div>
        <div style={st.emptyState}>
          <div style={{ fontSize: '28px' }}>🏁</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '240px', lineHeight: 1.5, textAlign: 'center' }}>No races logged yet.</div>
          <button style={st.ctaOutline} onClick={onAddRace}>+ Log a Race</button>
        </div>
      </div>
    )
  }

  if (recent.length === 0) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>RECENT RACES</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '8px' }}>
          No races in the last 3 months.
        </div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={st.widgetLabel}>RECENT RACES</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
        {recent.map((r, i) => {
          const isPB = !!r.time && pbMap[normalizeDistKey(r.distance)]?.id === r.id
          const d = new Date(r.date + 'T00:00:00')
          const dateStr = d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: '2-digit' })
          const city = [r.city, r.country].filter(Boolean).join(', ')
          const label = distBadge(r.distance)
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 0',
              borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Left: name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name ?? 'Untitled'}
                  </span>
                  {isPB && (
                    <span style={{ fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: '#C8963C', background: 'rgba(200,150,60,0.12)', border: '1px solid rgba(200,150,60,0.3)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>PB</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                  {dateStr}{city ? ` · ${city}` : ''}{label ? ` · ${label}` : ''}
                </div>
              </div>
              {/* Right: time */}
              {r.time && (
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', color: isPB ? '#C8963C' : 'var(--orange)', flexShrink: 0, letterSpacing: '0.02em' }}>
                  {r.time}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip() {
  const races = useRaceStore(selectRaces)
  const units = useUnits()

  const stats = useMemo(() => {
    const km = totalKm(races)
    const dist = units === 'imperial'
      ? Math.round(km * 0.621371).toLocaleString()
      : Math.round(km).toLocaleString()
    const pbCount = Object.keys(buildPBMap(races)).length
    const avgTime = (() => {
      const timed = races.filter(r => r.time)
      if (!timed.length) return null
      const avg = timed.reduce((s, r) => s + (parseHMS(r.time!) ?? 0), 0) / timed.length
      return secsToHMS(Math.round(avg))
    })()
    return [
      { label: 'RACES',     value: races.length.toString(),   sub: 'logged' },
      { label: 'COUNTRIES', value: uniqueCountries(races).toString(), sub: 'visited' },
      { label: distUnit(units), value: dist, sub: 'total dist' },
      { label: 'PBs',       value: pbCount.toString(),        sub: 'distances' },
      { label: 'MEDALS',    value: medalCount(races).toString(), sub: 'earned' },
      ...(avgTime ? [{ label: 'AVG TIME', value: avgTime, sub: 'per race' }] : []),
    ]
  }, [races, units])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
      {stats.map(s => (
        <div key={s.label} className="card-v3 card-orange" style={{ padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--headline)', fontSize: '20px', fontWeight: 900, lineHeight: 1, color: 'var(--white)', letterSpacing: '0.02em' }}>
            {s.value}
          </div>
          <div style={{ fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--orange)', marginTop: '3px' }}>
            {s.label}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '1px' }}>{s.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Season Planner Widget ────────────────────────────────────────────────────

function SeasonPlannerWidget({ onAddRace }: { onAddRace: () => void }) {
  const upcoming = useRaceStore(selectUpcomingRaces)
  const navigate = useNavigate()
  const today = todayStr()

  const upcoming90 = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 90)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return upcoming.filter(r => r.date >= today && r.date <= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [upcoming, today])

  const taperFor = (dist: string) => {
    const n = distanceToKm(dist)
    if (n >= 42) return { taper: 14, recover: 12 }
    if (n >= 21) return { taper: 10, recover: 7 }
    if (n >= 10) return { taper: 7, recover: 5 }
    return { taper: 5, recover: 3 }
  }

  const badge = upcoming90.length >= 3 ? 'HIGH' : upcoming90.length >= 1 ? 'MEDIUM' : 'LOW'
  const badgeColors = { HIGH: 'var(--orange)', MEDIUM: 'var(--gold)', LOW: 'var(--muted)' }
  const bc = badgeColors[badge]

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>SEASON PLANNER</div>
          <div style={st.widgetTitle}>NEXT 90 DAYS</div>
        </div>
        <span style={{ ...st.badgePill, background: `${bc}22`, color: bc, border: `1px solid ${bc}55`, flexShrink: 0 }}>{badge}</span>
      </div>

      {upcoming90.length === 0 ? (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.6 }}>
          No races in the next 90 days.
          <br />
          <button style={st.ghostLink} onClick={onAddRace}>+ Add a race</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {upcoming90.slice(0, 3).map(r => {
              const { taper, recover } = taperFor(r.distance)
              const p = r.priority ?? 'C'
              return (
                <div key={r.id} style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ color: p === 'A' ? 'var(--white)' : p === 'B' ? 'rgba(245,245,245,0.6)' : 'var(--muted)' }}>{p}</span>
                  {` · ${r.name} · taper ${taper}d / recover ${recover}d`}
                </div>
              )
            })}
          </div>
          <div style={st.widgetDivider} />
          <button style={st.ghostOutlineBtn} onClick={() => navigate('/races')}>OPEN PLANNER</button>
        </>
      )}
    </div>
  )
}

// ─── Recovery Intelligence Widget ────────────────────────────────────────────

function RecoveryIntelWidget() {
  const races       = useRaceStore(selectRaces)
  const stravaToken = useWearableStore(s => s.stravaToken)
  const today       = todayStr()

  const [stravaActs, setStravaActs] = useState<Awaited<ReturnType<typeof fetchStravaActivities>>>([])

  useEffect(() => {
    if (!stravaToken?.access_token) return
    fetchStravaActivities(50).then(setStravaActs)
  }, [stravaToken])

  const lastRace = useMemo(
    () => races.filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0],
    [races, today],
  )

  // Strava-based recovery when no race data
  const stravaRecovery = useMemo(() => {
    if (!stravaToken?.access_token || stravaActs.length === 0) return null
    const sorted = [...stravaActs].sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
    const lastAct = sorted[0]
    if (!lastAct) return null
    const daysSinceAct = daysAgo(lastAct.start_date_local.slice(0, 10))

    // Load ratio: last 7d vs avg of prior 3 weeks
    const now = Date.now()
    const week7 = 7 * 86400000
    const last7km  = stravaActs.filter(a => now - new Date(a.start_date_local).getTime() < week7)
      .reduce((s, a) => s + (a.distance ?? 0) / 1000, 0)
    const prior3wk = stravaActs.filter(a => {
      const age = now - new Date(a.start_date_local).getTime()
      return age >= week7 && age < 4 * week7
    }).reduce((s, a) => s + (a.distance ?? 0) / 1000, 0)
    const avgWeekKm = prior3wk / 3
    const loadRatio = avgWeekKm > 0 ? Math.round((last7km / avgWeekKm) * 10) / 10 : null

    return { daysSinceAct, loadRatio, lastActName: lastAct.name || lastAct.type }
  }, [stravaActs, stravaToken])

  if (!lastRace && !stravaRecovery) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>RECOVERY INTELLIGENCE</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '6px' }}>Log your first race or connect Strava to track recovery.</div>
      </div>
    )
  }

  // Strava-based view (no race logged yet, or use as primary signal)
  if (!lastRace && stravaRecovery) {
    const { daysSinceAct, loadRatio } = stravaRecovery
    const badge = daysSinceAct >= 2 ? 'RESTED' : 'ACTIVE'
    const bc = badge === 'RESTED' ? 'var(--green)' : 'var(--orange)'
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={st.widgetLabel}>RECOVERY INTELLIGENCE</div>
          <span style={{ ...st.badgePill, background: `${bc}22`, color: bc, border: `1px solid ${bc}55`, flexShrink: 0 }}>{badge}</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '68px', lineHeight: 1, color: 'var(--white)', letterSpacing: '-0.02em' }}>
            {daysSinceAct}d
          </div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
            DAYS SINCE LAST ACTIVITY
          </div>
        </div>
        {loadRatio !== null && (
          <>
            <div style={st.widgetDivider} />
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
              LOAD: {loadRatio}× normal — {loadRatio > 1.2 ? 'above baseline, consider recovery' : loadRatio < 0.8 ? 'below baseline, building back' : 'on target'}
            </div>
          </>
        )}
      </div>
    )
  }

  const dist = distanceToKm(lastRace!.distance)
  const recoveryDays = dist >= 42 ? 14 : dist >= 21 ? 7 : dist >= 10 ? 3 : 2
  const daysSince = daysAgo(lastRace!.date)
  const daysLeft = Math.max(0, recoveryDays - daysSince)
  const loadScore = Math.min(100, Math.round(dist * 2))
  const badge = recoveryDays >= 14 ? 'HIGH' : recoveryDays >= 7 ? 'MEDIUM' : 'LOW'
  const bc = badge === 'HIGH' ? 'var(--orange)' : badge === 'MEDIUM' ? 'var(--gold)' : 'var(--green)'

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>RECOVERY INTELLIGENCE</div>
          <div style={st.widgetTitle}>{(lastRace!.name ?? '').toUpperCase()}</div>
        </div>
        <span style={{ ...st.badgePill, background: `${bc}22`, color: bc, border: `1px solid ${bc}55`, flexShrink: 0 }}>{badge}</span>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '68px', lineHeight: 1, color: 'var(--white)', letterSpacing: '-0.02em' }}>
          {daysLeft}d
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
          ESTIMATED RECOVERY
        </div>
      </div>

      <div style={st.widgetDivider} />

      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
        {stravaRecovery ? (
          <>Last activity {stravaRecovery.daysSinceAct}d ago{stravaRecovery.loadRatio !== null ? ` · LOAD: ${stravaRecovery.loadRatio}× normal` : ''}. Race load score: {loadScore}.</>
        ) : (
          <>Recent race load score: {loadScore}. Use this to avoid stacking hard events too closely.</>
        )}
      </div>
    </div>
  )
}

// ─── Training Correlation Widget ─────────────────────────────────────────────

function TrainingCorrelWidget() {
  const stravaToken = useWearableStore(s => s.stravaToken)
  const races       = useRaceStore(selectRaces)
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof fetchStravaActivities>>>([])

  useEffect(() => {
    if (!stravaToken?.access_token) return
    fetchStravaActivities(200).then(setActivities)
  }, [stravaToken])

  if (!stravaToken?.access_token) {
    return (
      <div style={{ ...st.glowCard, border: '1px dashed var(--border2)' }}>
        <div style={st.widgetLabel}>TRAINING CORRELATION</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginTop: '6px' }}>
          Connect Strava and build a few matched race windows to see how load tracks with outcomes.
        </div>
      </div>
    )
  }

  const pbMap = useMemo(() => buildPBMap(races), [races])

  const dataPoints = useMemo(() => {
    const timedRaces = races
      .filter(r => r.time && r.date && r.distance)
      .sort((a, b) => b.date.localeCompare(a.date))

    return timedRaces.map(r => {
      const raceTs   = new Date(r.date + 'T00:00:00').getTime()
      const windowEnd   = raceTs - 7 * 86400000
      const windowStart = raceTs - 49 * 86400000
      const loadKm = activities
        .filter(a => {
          const t = new Date(a.start_date_local).getTime()
          return t >= windowStart && t <= windowEnd
        })
        .reduce((s, a) => s + (a.distance ?? 0) / 1000, 0)
      const raceSecs = parseHMS(r.time!)
      const pb = pbMap[r.distance ?? '']
      const pbSecs = pb ? parseHMS(pb.time!) : null
      const delta = (raceSecs && pbSecs && pbSecs > 0)
        ? Math.round((pbSecs - raceSecs) / pbSecs * 100)
        : null
      return { name: r.name ?? r.date, loadKm: Math.round(loadKm), delta }
    }).filter(p => p.loadKm > 0 && p.delta !== null) as { name: string; loadKm: number; delta: number }[]
  }, [races, activities, pbMap])

  if (dataPoints.length < 3) {
    const need = 3 - dataPoints.length
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>TRAINING CORRELATION</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginTop: '6px' }}>
          Need more data — log {need} more race{need !== 1 ? 's' : ''} with times to see your training correlation.
        </div>
      </div>
    )
  }

  const sorted   = [...dataPoints].sort((a, b) => b.delta - a.delta)
  const best     = sorted[0]
  const worst    = sorted[sorted.length - 1]
  const recent   = dataPoints[0]
  const maxLoad  = Math.max(best.loadKm, worst.loadKm, recent.loadKm, 1)

  const Row = ({ label, point }: { label: string; point: typeof best }) => {
    const barW = Math.round(point.loadKm / maxLoad * 100)
    const aboveAvg = point.delta >= 0
    const deltaColor = aboveAvg ? 'var(--green)' : 'var(--orange)'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ fontSize: '10px', color: deltaColor, fontWeight: 700, fontFamily: 'var(--headline)' }}>{point.delta >= 0 ? '+' : ''}{point.delta}% vs PB pace</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{point.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '6px', background: 'var(--surface)', borderRadius: '3px' }}>
            <div style={{ width: `${barW}%`, height: '100%', background: 'var(--orange)', borderRadius: '3px', opacity: 0.7 }} />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, flexShrink: 0 }}>{point.loadKm}km load</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={st.widgetLabel}>TRAINING CORRELATION</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
        <Row label="Best result" point={best} />
        <div style={st.widgetDivider} />
        <Row label="Worst result" point={worst} />
        <div style={st.widgetDivider} />
        <Row label="Most recent" point={recent} />
      </div>
    </div>
  )
}

// ─── Boston Qualifier Widget ──────────────────────────────────────────────────

// Typical recent cutoff buffer: ~7 min under the BQ standard to safely get in
const BQ_BUFFER_SECS = 420

function BostonQualWidget() {
  const athlete    = useAthleteStore(selectAthlete)
  const races      = useRaceStore(selectRaces)
  const hasProfile = !!(athlete?.dob && athlete?.gender)

  const bostonYear                  = useMemo(() => nextBostonYear(), [])
  const { start: qualStart, end: qualEnd } = useMemo(() => bqQualWindow(bostonYear), [bostonYear])
  const bqTarget                    = useMemo(() => getBQTarget(athlete?.dob, athlete?.gender, bostonYear), [athlete, bostonYear])

  // Marathons inside the qualifying window, newest first
  const qualRaces = useMemo(() =>
    races
      .filter(r => {
        const d = distanceToKm(r.distance)
        return d >= 42 && d <= 42.3 && !!r.time && r.date >= qualStart && r.date <= qualEnd
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
    [races, qualStart, qualEnd],
  )

  // Fastest time among qualifying-window races
  const bestQual = useMemo(() =>
    [...qualRaces].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0] ?? null,
    [qualRaces],
  )

  const fmtWindow = (d: string) => {
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[+m - 1]} ${+day}, ${y}`
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>B.A.A.</div>
          <div style={st.widgetTitle}>BOSTON QUALIFIER</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch),0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch),0.3)', flexShrink: 0 }}>
          {bostonYear}
        </span>
      </div>

      {!hasProfile ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>PROFILE NEEDED</div>
          <div style={st.lockedText}>Add date of birth and gender in your athlete profile to unlock your official BQ target.</div>
        </div>
      ) : !bqTarget ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* BQ standard + safe-buffer target side by side */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '28px', color: 'var(--white)', lineHeight: 1 }}>
                {secsToHMS(bqTarget)}
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '3px' }}>
                BQ STANDARD
              </div>
            </div>
            <div style={{ paddingBottom: '1px' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '18px', color: 'var(--muted)', lineHeight: 1 }}>
                {secsToHMS(bqTarget - BQ_BUFFER_SECS)}
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted2)', textTransform: 'uppercase', marginTop: '3px' }}>
                SAFE BUFFER (−7 MIN)
              </div>
            </div>
          </div>

          {/* Qualifying window */}
          <div style={{ fontSize: '11px', color: 'var(--muted2)', letterSpacing: '0.02em' }}>
            Qualifying window: {fmtWindow(qualStart)} – {fmtWindow(qualEnd)}
          </div>

          {/* Gap summary from best qualifying race */}
          {bestQual && (() => {
            const pbSecs = parseHMS(bestQual.time!)
            if (!pbSecs) return null
            const gapStd    = pbSecs - bqTarget
            const gapBuffer = pbSecs - (bqTarget - BQ_BUFFER_SECS)
            const safelyIn  = gapBuffer <= 0
            const qualified = gapStd <= 0
            const color = safelyIn ? 'var(--green)' : qualified ? 'var(--gold)' : 'var(--orange)'
            const label = safelyIn
              ? `${secsToHMS(Math.abs(gapBuffer))} inside safe buffer ✓`
              : qualified
              ? `BQ met — ${secsToHMS(Math.abs(gapBuffer))} short of safe buffer`
              : `${secsToHMS(gapStd)} to BQ · ${secsToHMS(gapBuffer)} to safe buffer`
            return <div style={{ fontSize: 'var(--text-sm)', color, fontWeight: 600 }}>{label}</div>
          })()}

          {/* Last 3 races in qualifying window */}
          {qualRaces.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                QUALIFYING RACES ({qualRaces.length})
              </div>
              {qualRaces.slice(0, 3).map(r => {
                const secs = parseHMS(r.time!)
                if (!secs) return null
                const gap       = secs - bqTarget
                const qualified = gap <= 0
                const rowColor  = qualified ? 'var(--green)' : 'var(--muted)'
                return (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--surface)', borderRadius: '7px', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name || distBadge(r.distance)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted2)', marginTop: '1px' }}>{r.date}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--headline)', lineHeight: 1 }}>{r.time}</div>
                      <div style={{ fontSize: '10px', color: rowColor, fontWeight: 700, marginTop: '2px' }}>
                        {qualified ? `${secsToHMS(Math.abs(gap))} under ✓` : `${secsToHMS(gap)} over`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
              No marathons yet in the {bostonYear} qualifying window.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Pacing IQ Widget ─────────────────────────────────────────────────────────

function PacingIQWidget() {
  const races = useRaceStore(selectRaces)

  const analysis = useMemo(() => {
    const withSplits = races.filter(r => r.splits && r.splits.length >= 2)
    if (!withSplits.length) return null
    let faded = 0, negative = 0, even = 0
    for (const r of withSplits) {
      const splits = (r.splits ?? []).filter(s => s.split)
      if (splits.length < 2) continue
      const first = parseHMS(splits[0].split!) ?? 0
      const last  = parseHMS(splits[splits.length - 1].split!) ?? 0
      if (last > first * 1.02) faded++
      else if (last < first * 0.98) negative++
      else even++
    }
    const total = faded + negative + even
    if (total === 0) return null
    const dominant = faded > negative && faded > even ? 'FADER' :
      negative > even ? 'NEGATIVE SPLITTER' : 'EVEN PACER'
    return { faded, negative, even, total, dominant }
  }, [races])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>PACING IQ</div>
          <div style={st.widgetTitle}>RACE RHYTHM</div>
        </div>
        <span style={st.iconBox}>🧠</span>
      </div>

      {!analysis ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>UNLOCK YOUR PACING PATTERN</div>
          <div style={st.lockedText}>Add splits when logging races to reveal whether you pace aggressively, evenly, or fade late.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: 'var(--green)', letterSpacing: '0.04em' }}>
            {analysis.dominant}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
            Based on {analysis.total} races with split data.
            Fade rate: {Math.round((analysis.faded / analysis.total) * 100)}%.
            Negative splits: {Math.round((analysis.negative / analysis.total) * 100)}%.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Career Momentum Widget ───────────────────────────────────────────────────

function CareerMomentumWidget() {
  const races = useRaceStore(selectRaces)
  const { score, badge } = useMemo(() => computeMomentum(races), [races])

  const bc = badge === 'HOT' ? 'var(--orange)' : badge === 'RISING' ? 'var(--gold)' :
    badge === 'NEUTRAL' ? 'var(--muted)' : 'rgba(var(--orange-ch), 0.4)'

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>CAREER MOMENTUM</div>
          <div style={st.widgetTitle}>FORM TREND</div>
        </div>
        <span style={{ ...st.badgePill, background: `${bc}22`, color: bc, border: `1px solid ${bc}55`, flexShrink: 0 }}>{badge}</span>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '64px', lineHeight: 1, color: 'var(--green)', letterSpacing: '-0.02em' }}>
          {score.toFixed(2)}
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
          MOMENTUM
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>→ vs last block</div>
        <div style={{ height: '3px', background: 'var(--surface3)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(score * 100)}%`, background: 'var(--green)', borderRadius: '2px' }} />
        </div>
      </div>

      <div style={st.widgetDivider} />
      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
        Weighted against your recent personal-best equivalents, this shows whether your results are trending stronger or softer over time.
      </div>
    </div>
  )
}

// ─── Age Grade Widget ─────────────────────────────────────────────────────────

function AgeGradeWidget() {
  const athlete = useAthleteStore(selectAthlete)
  const hasProfile = !!(athlete?.dob && athlete?.gender)

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>AGE-GRADE SCORE</div>
          <div style={st.widgetTitle}>PERFORMANCE CONTEXT</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>WA</span>
      </div>

      {!hasProfile ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>PROFILE NEEDED</div>
          <div style={st.lockedText}>Add your date of birth and gender in athlete profile to unlock age-grade scoring.</div>
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Age-grade analysis requires race times. Keep logging!</div>
      )}
    </div>
  )
}

// ─── Race DNA Widget ──────────────────────────────────────────────────────────

function RaceDNAWidget() {
  const races  = useRaceStore(selectRaces)
  const today  = todayStr()
  const past   = useMemo(() => races.filter(r => r.date <= today), [races, today])

  const { fadeRate, travelCount } = useMemo(() => {
    const withSplits = past.filter(r => (r.splits ?? []).length >= 2)
    let faded = 0
    for (const r of withSplits) {
      const splits = (r.splits ?? []).filter(s => s.split)
      if (splits.length < 2) continue
      const first = parseHMS(splits[0].split!) ?? 0
      const last  = parseHMS(splits[splits.length - 1].split!) ?? 0
      if (last > first * 1.02) faded++
    }
    const fr = withSplits.length > 0 ? Math.round((faded / withSplits.length) * 100) : 0
    const tc = past.filter(r => r.country && r.country !== (past[0]?.country ?? '')).length
    return { fadeRate: fr, travelCount: tc }
  }, [past])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>RACE DNA</div>
          <div style={st.widgetTitle}>TEMPERATURE FIT</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>{past.length} RACES</span>
      </div>

      {past.length === 0 ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NO DATA YET</div>
          <div style={st.lockedText}>Log your first race to start building your race DNA profile.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            Negative split rate: {100 - fadeRate}%<br />
            Fade rate: {fadeRate}%<br />
            {travelCount > 0 && <>{travelCount} travel races<br /></>}
            No hot-weather baseline
          </div>
          <div style={st.widgetDivider} />
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {past.length < 5 ? `Log ${5 - past.length} more races to unlock temperature fit analysis.` : 'No comeback tags yet.'}
          </div>
          <button style={st.ghostOutlineBtn}>EXPLAIN WITH AI</button>
        </div>
      )}
    </div>
  )
}

// ─── Pattern Scan Widget ──────────────────────────────────────────────────────

function PatternScanWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const past  = useMemo(() => races.filter(r => r.date <= today), [races, today])

  const negSplitRate = useMemo(() => {
    const w = past.filter(r => (r.splits ?? []).length >= 2)
    if (!w.length) return 0
    const neg = w.filter(r => {
      const s = (r.splits ?? []).filter(x => x.split)
      if (s.length < 2) return false
      const first = parseHMS(s[0].split!) ?? 0
      const last  = parseHMS(s[s.length - 1].split!) ?? 0
      return last < first * 0.98
    })
    return Math.round((neg.length / w.length) * 100)
  }, [past])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>DEEP TRENDS</div>
          <div style={st.widgetTitle}>PATTERN SCAN</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>{past.length}</span>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
        Negative split rate: {negSplitRate}%<br />
        Fade rate: {100 - negSplitRate}%<br />
        {past.length} total races logged<br />
        No hot-weather baseline
      </div>

      <div style={st.widgetDivider} />

      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
        {past.length < 3 ? 'Log more races to see deep pattern analysis.' : 'No comeback tags yet.'}
      </div>
      <button style={st.ghostOutlineBtn}>EXPLAIN WITH AI</button>
    </div>
  )
}

// ─── Why Result Widget ────────────────────────────────────────────────────────

function WhyResultWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const lastRace = useMemo(
    () => races.filter(r => r.date <= today && r.time).sort((a, b) => b.date.localeCompare(a.date))[0],
    [races, today],
  )

  if (!lastRace) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>WHY RESULT</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Log a timed race to unlock result analysis.</div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>WHY RESULT</div>
          <div style={st.widgetTitle}>{(lastRace.name ?? '').toUpperCase()}</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>EXPLAIN</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Best: execution and context aligned well</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Tough day: course and pacing demands stacked up</div>
      </div>

      <div style={st.widgetDivider} />
      <button style={st.ghostOutlineBtn}>COACH BRIEF</button>
    </div>
  )
}

// ─── Activity Feed Preview Widget ────────────────────────────────────────────


const WHOOP_SPORT_NAMES: Record<number, string> = {
  0: 'Activity', 1: 'Running', 2: 'Cycling', 3: 'Swimming',
  44: 'Weightlifting', 45: 'Yoga', 63: 'Hiking', 71: 'Triathlon',
  72: 'Rowing', 73: 'Walking', 74: 'HIIT',
}

function stravaIcon(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('run')) return '🏃'
  if (t.includes('ride') || t.includes('cycling')) return '🚴'
  if (t.includes('swim')) return '🏊'
  if (t.includes('walk')) return '🚶'
  if (t.includes('weight') || t.includes('strength')) return '🏋'
  return '⚡'
}

function ActivityPreviewWidget() {
  const stravaToken = useWearableStore(s => s.stravaToken)
  const garminToken = useWearableStore(s => s.garminToken)
  const whoopToken  = useWearableStore(s => s.whoopToken)
  const whoopActs   = useWearableStore(s => s.whoopActivities)

  const [stravaActs, setStravaActs] = useState<Awaited<ReturnType<typeof fetchStravaActivities>>>([])

  useEffect(() => {
    if (!stravaToken?.access_token) return
    fetchStravaActivities(10).then(setStravaActs)
  }, [stravaToken])

  if (!stravaToken && !garminToken && !whoopToken) {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '12px', padding: '14px' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
          Activity Feed
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Connect Strava, Garmin, or WHOOP to see recent training.</div>
      </div>
    )
  }

  const items = useMemo(() => {
    const merged: Array<{ icon: string; name: string; meta: string; date: string; sortKey: string }> = []
    for (const a of stravaActs) {
      const km = Math.round((a.distance ?? 0) / 100) / 10
      const mins = Math.round((a.elapsed_time ?? 0) / 60)
      merged.push({
        icon: stravaIcon(a.type),
        name: a.name || a.type,
        meta: [km > 0 ? `${km} km` : '', mins > 0 ? `${mins} min` : ''].filter(Boolean).join(' · '),
        date: (a.start_date_local ?? '').slice(0, 10),
        sortKey: a.start_date_local ?? '',
      })
    }
    for (const a of whoopActs) {
      const mins = a.end ? Math.round((new Date(a.end).getTime() - new Date(a.start).getTime()) / 60000) : 0
      merged.push({
        icon: '💚',
        name: WHOOP_SPORT_NAMES[a.sport_id] ?? 'Activity',
        meta: mins > 0 ? `${mins} min` : '',
        date: a.start.slice(0, 10),
        sortKey: a.start,
      })
    }
    return merged.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, 5)
  }, [stravaActs, whoopActs])

  if (!items.length) return null

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '12px', padding: '14px' }}>
      <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
        Recent Training
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: i < items.length - 1 ? '6px' : 0, borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>{a.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: 'var(--white)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{[a.date, a.meta].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── On This Day Widget ───────────────────────────────────────────────────────

function OnThisDayWidget() {
  const races = useRaceStore(selectRaces)

  const race = useMemo(() => {
    const now = new Date()
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const thisYear = now.getFullYear()
    const matches = races.filter(r => r.date && r.date.slice(5) === mmdd && parseInt(r.date.slice(0, 4)) < thisYear)
    if (!matches.length) return null
    return matches[Math.floor(Date.now() / 86400000) % matches.length]
  }, [races])

  if (!race) return null

  const years = new Date().getFullYear() - parseInt(race.date.slice(0, 4))
  const yearStr = years === 1 ? '1 year ago' : `${years} years ago`

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0 }}>📅</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
          On This Day
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: 'var(--white)', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {race.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
          {yearStr}{race.city ? ` · ${race.city}` : ''}{race.country ? `, ${race.country}` : ''}
        </div>
        {race.time && (
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', color: 'var(--orange)', marginTop: '4px' }}>
            {race.time}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Race Readiness Widget ────────────────────────────────────────────────────

function RaceReadinessWidget() {
  const races        = useRaceStore(selectRaces)
  const whoopRecovery = useWearableStore(s => s.whoopRecovery)
  const today        = todayStr()

  const { signal, score, detail } = useMemo(() => {
    // WHOOP-based recovery
    if (whoopRecovery.length > 0) {
      const latest = whoopRecovery.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      const s = latest?.score?.recovery_score ?? 50
      const signal = s >= 67 ? 'READY' : s >= 34 ? 'BUILDING' : 'UNDERCOOKED'
      return { signal, score: s, detail: `WHOOP recovery score: ${s}%` }
    }
    // Derive from days since last race
    const past = races.filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))
    const last = past[0]
    if (!last) return { signal: 'BUILDING', score: 50, detail: 'Log your first race to track readiness.' }
    const dist = distanceToKm(last.distance)
    const recoveryDays = dist >= 42 ? 14 : dist >= 21 ? 7 : dist >= 10 ? 3 : 2
    const daysSince = daysAgo(last.date)
    const ratio = Math.min(1, daysSince / recoveryDays)
    const s = Math.round(ratio * 100)
    const signal = s >= 85 ? 'READY' : s >= 50 ? 'BUILDING' : 'UNDERCOOKED'
    return { signal, score: s, detail: `${daysSince}d since ${distBadge(last.distance)} · recovery window: ${recoveryDays}d` }
  }, [races, whoopRecovery, today])

  const sigColor = signal === 'READY' ? 'var(--green)' : signal === 'BUILDING' ? 'var(--gold)' : 'var(--orange)'

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>READINESS</div>
          <div style={st.widgetTitle}>RACE READINESS</div>
        </div>
        <span style={{ ...st.badgePill, background: `${sigColor}22`, color: sigColor, border: `1px solid ${sigColor}55`, flexShrink: 0 }}>{signal}</span>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '64px', lineHeight: 1, color: sigColor, letterSpacing: '-0.02em' }}>
          {score}%
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
          READINESS SCORE
        </div>
        <div style={{ height: '3px', background: 'var(--surface3)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score}%`, background: sigColor, borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>
      </div>

      <div style={st.widgetDivider} />
      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>{detail}</div>
    </div>
  )
}

// ─── Gap To Goal Widget ───────────────────────────────────────────────────────

function GapToGoalWidget() {
  const races   = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectFocusRace)   // follows user's pinned focus race
  const today   = todayStr()

  const result = useMemo(() => {
    if (!nextRace?.goalTime) return null
    const goalSecs = parseHMS(nextRace.goalTime)
    if (!goalSecs) return null
    const key = normalizeDistKey(nextRace.distance)
    const pbMap = buildPBMap(races.filter(r => r.date <= today))
    const pb = pbMap[key]
    if (!pb?.time) return { goal: secsToHMS(goalSecs), pb: null, gap: null, raceName: nextRace.name }
    const pbSecs = parseHMS(pb.time)
    if (!pbSecs) return { goal: secsToHMS(goalSecs), pb: pb.time, gap: null, raceName: nextRace.name }
    const gap = goalSecs - pbSecs
    return { goal: secsToHMS(goalSecs), pb: pb.time, gap, raceName: nextRace.name }
  }, [races, nextRace, today])

  if (!nextRace) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>GAP TO GOAL</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Add an upcoming race to track your gap to goal.</div>
      </div>
    )
  }

  if (!result?.goal) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>GAP TO GOAL</div>
        <div style={st.widgetTitle}>{(nextRace.name ?? '').toUpperCase()}</div>
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NO GOAL SET</div>
          <div style={st.lockedText}>Set a goal time on your next race to track your gap.</div>
        </div>
      </div>
    )
  }

  const gapColor = result.gap == null ? 'var(--muted)' : result.gap <= 0 ? 'var(--green)' : 'var(--orange)'
  const gapLabel = result.gap == null
    ? 'No PB logged for this distance yet'
    : result.gap <= 0
      ? `${secsToHMS(Math.abs(result.gap))} AHEAD OF GOAL`
      : `${secsToHMS(result.gap)} BEHIND GOAL`

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>GAP TO GOAL</div>
          <div style={st.widgetTitle}>{distBadge(nextRace.distance) || 'NEXT RACE'}</div>
          {nextRace.name && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px', fontFamily: 'var(--body)', fontWeight: 500 }}>
              {nextRace.name}
            </div>
          )}
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch),0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch),0.3)', flexShrink: 0 }}>
          🎯
        </span>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '28px', color: 'var(--white)', lineHeight: 1 }}>{result.goal}</div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '3px' }}>GOAL TIME</div>
        </div>
        {result.pb && (
          <div style={{ paddingBottom: '1px' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '18px', color: 'var(--muted)', lineHeight: 1 }}>{result.pb}</div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted2)', textTransform: 'uppercase', marginTop: '3px' }}>CURRENT PB</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 'var(--text-sm)', color: gapColor, fontWeight: 600 }}>{gapLabel}</div>
    </div>
  )
}

// ─── Surface Profile Widget ───────────────────────────────────────────────────

function SurfaceProfileWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const surfaces = useMemo(() => {
    const past = races.filter(r => r.date <= today && r.placing)
    if (past.length < 3) return null
    const grouped: Record<string, number[]> = {}
    for (const r of past) {
      const s = (r.surface ?? 'road').toLowerCase()
      const p = parsePlacing(r.placing)
      if (!p) continue
      if (!grouped[s]) grouped[s] = []
      grouped[s].push(p.percentile)
    }
    return Object.entries(grouped)
      .map(([surface, pcts]) => ({
        surface,
        avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
        count: pcts.length,
      }))
      .sort((a, b) => b.avg - a.avg)
  }, [races, today])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>SURFACE PROFILE</div>
          <div style={st.widgetTitle}>WHERE YOU THRIVE</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch),0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch),0.3)', flexShrink: 0 }}>
          {surfaces ? surfaces.length : '—'}
        </span>
      </div>

      {!surfaces ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NOT ENOUGH DATA</div>
          <div style={st.lockedText}>Log 3+ races with placing data to see your surface breakdown.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {surfaces.slice(0, 4).map((s, i) => {
            const barColor = i === 0 ? 'var(--green)' : 'var(--orange)'
            return (
              <div key={s.surface}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--headline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: i === 0 ? 'var(--white)' : 'var(--muted)' }}>
                    {s.surface}
                    {i === 0 && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--green)' }}>BEST</span>}
                  </span>
                  <span style={{ fontSize: '12px', color: i === 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>
                    Top {100 - s.avg + 1}% avg
                  </span>
                </div>
                <div style={{ height: '3px', background: 'var(--surface3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.avg}%`, background: barColor, borderRadius: '2px' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Pressure Performer Widget ────────────────────────────────────────────────

function PressurePerformerWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const result = useMemo(() => {
    const past = races.filter(r => r.date <= today && r.placing)
    if (past.length < 3) return null

    const aRaces = past.filter(r => r.priority === 'A' || r.isArace)
    const otherRaces = past.filter(r => r.priority !== 'A' && !r.isArace)

    const avgPct = (list: Race[]) => {
      const ps = list.map(r => parsePlacing(r.placing)?.percentile ?? null).filter((p): p is number => p !== null)
      if (!ps.length) return null
      return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length)
    }

    const aPct = avgPct(aRaces)
    const otherPct = avgPct(otherRaces)

    if (aPct === null && otherPct === null) return null

    let label = 'CONSISTENT'
    if (aPct !== null && otherPct !== null) {
      if (aPct > otherPct + 5) label = 'CLUTCH'
      else if (otherPct > aPct + 5) label = 'RELAXED RACER'
      else label = 'CONSISTENT'
    }

    return { aPct, otherPct, label, aCount: aRaces.length, otherCount: otherRaces.length }
  }, [races, today])

  const labelColor = result?.label === 'CLUTCH' ? 'var(--green)' : result?.label === 'RELAXED RACER' ? 'var(--gold)' : 'var(--orange)'

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>PRESSURE PERFORMER</div>
          <div style={st.widgetTitle}>A-RACE IQ</div>
        </div>
        {result && <span style={{ ...st.badgePill, background: `${labelColor}22`, color: labelColor, border: `1px solid ${labelColor}55`, flexShrink: 0 }}>{result.label}</span>}
      </div>

      {!result ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NOT ENOUGH DATA</div>
          <div style={st.lockedText}>Log 3+ races with placing data and mark A-races to see your pressure profile.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
          {result.aPct !== null && (
            <div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '32px', color: 'var(--white)', lineHeight: 1 }}>
                Top {100 - result.aPct + 1}%
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '3px' }}>A-RACES ({result.aCount})</div>
            </div>
          )}
          {result.otherPct !== null && (
            <div style={{ paddingBottom: '2px' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '20px', color: 'var(--muted)', lineHeight: 1 }}>
                Top {100 - result.otherPct + 1}%
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted2)', textTransform: 'uppercase', marginTop: '3px' }}>B/C RACES ({result.otherCount})</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Travel Load Widget ───────────────────────────────────────────────────────

function TravelLoadWidget() {
  const races   = useRaceStore(selectRaces)
  const athlete = useAthleteStore(selectAthlete)
  const today   = todayStr()

  const result = useMemo(() => {
    const past = races.filter(r => r.date <= today && r.placing)
    if (past.length < 3) return null

    const homeCountry = (athlete?.country ?? '').toLowerCase().trim()
    const local = past.filter(r => homeCountry && r.country?.toLowerCase().trim() === homeCountry)
    const away  = past.filter(r => !homeCountry || r.country?.toLowerCase().trim() !== homeCountry)

    const avgPct = (list: Race[]) => {
      const ps = list.map(r => parsePlacing(r.placing)?.percentile ?? null).filter((p): p is number => p !== null)
      if (!ps.length) return null
      return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length)
    }

    return {
      localPct: avgPct(local),
      awayPct: avgPct(away),
      localCount: local.length,
      awayCount: away.length,
    }
  }, [races, athlete, today])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>TRAVEL LOAD</div>
          <div style={st.widgetTitle}>HOME vs AWAY</div>
        </div>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>✈️</span>
      </div>

      {!result ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NOT ENOUGH DATA</div>
          <div style={st.lockedText}>Log 3+ races and set your home country in athlete profile.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {result.localPct !== null && (
            <div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '32px', color: 'var(--green)', lineHeight: 1 }}>
                Top {100 - result.localPct + 1}%
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '3px' }}>
                HOME ({result.localCount})
              </div>
            </div>
          )}
          {result.awayPct !== null && (
            <div style={{ paddingBottom: '2px' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '20px', color: 'var(--muted)', lineHeight: 1 }}>
                Top {100 - result.awayPct + 1}%
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted2)', textTransform: 'uppercase', marginTop: '3px' }}>
                AWAY ({result.awayCount})
              </div>
            </div>
          )}
          {result.localPct !== null && result.awayPct !== null && (
            <>
              <div style={st.widgetDivider} />
              <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
                {result.localPct > result.awayPct + 5
                  ? 'You perform better at home-country races.'
                  : result.awayPct > result.localPct + 5
                  ? 'You actually thrive away from home.'
                  : 'Consistent performer wherever you race.'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Race Density Widget ──────────────────────────────────────────────────────

function RaceDensityWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const result = useMemo(() => {
    const past = races.filter(r => r.date <= today).sort((a, b) => a.date.localeCompare(b.date))
    if (past.length < 2) return null

    const gaps: number[] = []
    for (let i = 1; i < past.length; i++) {
      const gap = Math.round(
        (new Date(past[i].date + 'T00:00:00').getTime() - new Date(past[i - 1].date + 'T00:00:00').getTime()) / 86400000
      )
      gaps.push(gap)
    }

    const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    const min = Math.min(...gaps)
    const tightCount = gaps.filter(g => g < 14).length

    return { avg, min, tightCount, total: past.length }
  }, [races, today])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>RACE DENSITY</div>
          <div style={st.widgetTitle}>RACE SPACING</div>
        </div>
        {result && (
          <span style={{ ...st.badgePill, background: result.tightCount > 0 ? 'rgba(var(--orange-ch),0.12)' : 'rgba(0,255,136,0.1)', color: result.tightCount > 0 ? 'var(--orange)' : 'var(--green)', border: `1px solid ${result.tightCount > 0 ? 'rgba(var(--orange-ch),0.3)' : 'rgba(0,255,136,0.3)'}`, flexShrink: 0 }}>
            {result.tightCount > 0 ? 'TIGHT' : 'SPACED'}
          </span>
        )}
      </div>

      {!result ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NOT ENOUGH DATA</div>
          <div style={st.lockedText}>Log 2+ races to see your race spacing analysis.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '32px', color: 'var(--white)', lineHeight: 1 }}>{result.avg}d</div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '3px' }}>AVG GAP</div>
            </div>
            <div style={{ paddingBottom: '2px' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '20px', color: result.min < 14 ? 'var(--orange)' : 'var(--muted)', lineHeight: 1 }}>{result.min}d</div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted2)', textTransform: 'uppercase', marginTop: '3px' }}>SHORTEST</div>
            </div>
          </div>
          {result.tightCount > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--orange)', lineHeight: 1.5 }}>
              ⚠ {result.tightCount} race{result.tightCount > 1 ? 's' : ''} stacked within 14 days of another.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Best Conditions Widget ───────────────────────────────────────────────────

function BestConditionsWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const result = useMemo(() => {
    const past = races.filter(r => r.date <= today && r.placing && r.weather?.temp != null)
    if (past.length < 3) return null

    // Bucket by temp range and find best avg percentile
    const buckets: { label: string; min: number; max: number; pcts: number[] }[] = [
      { label: '< 5°C', min: -999, max: 5, pcts: [] },
      { label: '5–10°C', min: 5, max: 10, pcts: [] },
      { label: '10–15°C', min: 10, max: 15, pcts: [] },
      { label: '15–20°C', min: 15, max: 20, pcts: [] },
      { label: '20–25°C', min: 20, max: 25, pcts: [] },
      { label: '> 25°C', min: 25, max: 999, pcts: [] },
    ]

    for (const r of past) {
      const t = r.weather!.temp!
      const p = parsePlacing(r.placing)
      if (!p) continue
      const bucket = buckets.find(b => t >= b.min && t < b.max)
      if (bucket) bucket.pcts.push(p.percentile)
    }

    const ranked = buckets
      .filter(b => b.pcts.length > 0)
      .map(b => ({ label: b.label, avg: Math.round(b.pcts.reduce((a, c) => a + c, 0) / b.pcts.length), count: b.pcts.length }))
      .sort((a, b) => b.avg - a.avg)

    if (!ranked.length) return null

    // Best surface
    const surfMap: Record<string, number[]> = {}
    for (const r of past) {
      const s = r.surface ?? 'road'
      const p = parsePlacing(r.placing)
      if (!p) continue
      if (!surfMap[s]) surfMap[s] = []
      surfMap[s].push(p.percentile)
    }
    const bestSurf = Object.entries(surfMap)
      .map(([s, ps]) => ({ s, avg: Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) }))
      .sort((a, b) => b.avg - a.avg)[0]

    return { tempBuckets: ranked.slice(0, 3), bestSurf, totalWithWeather: past.length }
  }, [races, today])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>BEST CONDITIONS</div>
          <div style={st.widgetTitle}>YOUR OPTIMAL RACE</div>
        </div>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>☀️</span>
      </div>

      {!result ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NOT ENOUGH DATA</div>
          <div style={st.lockedText}>Log 3+ races with weather and placing data to find your sweet spot.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {result.bestSurf && (
            <div style={{ fontSize: '13px', color: 'var(--white)', fontWeight: 600 }}>
              Best surface: <span style={{ color: 'var(--green)' }}>{result.bestSurf.s.toUpperCase()}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {result.tempBuckets.map((b, i) => (
              <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontFamily: 'var(--headline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: i === 0 ? 'var(--white)' : 'var(--muted)' }}>
                  {b.label} {i === 0 && '★'}
                </span>
                <span style={{ fontSize: '12px', color: i === 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>
                  Top {100 - b.avg + 1}% ({b.count})
                </span>
              </div>
            ))}
          </div>
          <div style={st.widgetDivider} />
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Based on {result.totalWithWeather} races with weather data</div>
        </div>
      )}
    </div>
  )
}

// ─── Course Fit Score Widget ──────────────────────────────────────────────────

function CourseFitWidget() {
  const races    = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)
  const today    = todayStr()

  const result = useMemo(() => {
    if (!nextRace) return null
    const past = races.filter(r => r.date <= today && r.placing)
    if (past.length < 3) return null

    // Surface fit: how well does athlete do on this surface?
    const nextSurface = (nextRace.surface ?? 'road').toLowerCase()
    const surfaceRaces = past.filter(r => (r.surface ?? 'road').toLowerCase() === nextSurface)
    const allPcts = past.map(r => parsePlacing(r.placing)?.percentile ?? null).filter((p): p is number => p !== null)
    const surfPcts = surfaceRaces.map(r => parsePlacing(r.placing)?.percentile ?? null).filter((p): p is number => p !== null)

    const overallAvg = allPcts.length ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : 50
    const surfAvg = surfPcts.length ? surfPcts.reduce((a, b) => a + b, 0) / surfPcts.length : overallAvg

    // Elevation fit: flat specialist vs hilly
    let elevFit = 50
    if (typeof nextRace.elevation === 'number') {
      const isHilly = nextRace.elevation > 300
      const hillyRaces = past.filter(r => typeof r.elevation === 'number' && r.elevation > 300)
      const flatRaces  = past.filter(r => typeof r.elevation === 'number' && r.elevation <= 300)
      const hillyPcts  = hillyRaces.map(r => parsePlacing(r.placing)?.percentile ?? null).filter((p): p is number => p !== null)
      const flatPcts   = flatRaces.map(r => parsePlacing(r.placing)?.percentile ?? null).filter((p): p is number => p !== null)
      if (isHilly && hillyPcts.length) elevFit = hillyPcts.reduce((a, b) => a + b, 0) / hillyPcts.length
      else if (!isHilly && flatPcts.length) elevFit = flatPcts.reduce((a, b) => a + b, 0) / flatPcts.length
    }

    const score = Math.round((surfAvg * 0.6 + elevFit * 0.4))
    const label = score >= 70 ? 'GREAT FIT' : score >= 50 ? 'SOLID FIT' : 'TOUGH COURSE'
    const color = score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--gold)' : 'var(--orange)'

    return { score, label, color, nextSurface, surfaceRaceCount: surfaceRaces.length }
  }, [races, nextRace, today])

  if (!nextRace) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>COURSE FIT</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Add an upcoming race to calculate your course fit score.</div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>COURSE FIT</div>
          <div style={st.widgetTitle}>{(nextRace.name ?? 'NEXT RACE').toUpperCase()}</div>
        </div>
        {result && <span style={{ ...st.badgePill, background: `${result.color}22`, color: result.color, border: `1px solid ${result.color}55`, flexShrink: 0 }}>{result.label}</span>}
      </div>

      {!result ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Log 3+ races with placing data to unlock course fit score.</div>
      ) : (
        <>
          <div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '64px', lineHeight: 1, color: result.color, letterSpacing: '-0.02em' }}>
              {result.score}
            </div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
              / 100 COURSE FIT
            </div>
            <div style={{ height: '3px', background: 'var(--surface3)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${result.score}%`, background: result.color, borderRadius: '2px' }} />
            </div>
          </div>
          <div style={st.widgetDivider} />
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
            Surface: {result.nextSurface.toUpperCase()}
            {result.surfaceRaceCount > 0 ? ` · ${result.surfaceRaceCount} prior ${result.nextSurface} races` : ' · no prior races on this surface'}
          </div>
        </>
      )}
    </div>
  )
}

// ─── PB Probability Widget ────────────────────────────────────────────────────

function PBProbabilityWidget() {
  const races    = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)
  const today    = todayStr()

  const result = useMemo(() => {
    if (!nextRace) return null
    const past = races.filter(r => r.date <= today && r.time)
    if (past.length < 2) return null

    const key = normalizeDistKey(nextRace.distance)
    const pbMap = buildPBMap(past)
    const pb = pbMap[key]

    // Form trend (30%)
    const { score: momentumScore } = computeMomentum(past)
    const formScore = Math.round(momentumScore * 100)

    // Surface fit (25%) — how often they race well on this surface
    const nextSurface = (nextRace.surface ?? 'road').toLowerCase()
    const surfRaces = past.filter(r => (r.surface ?? 'road').toLowerCase() === nextSurface && r.placing)
    const allRacesWithPlacing = past.filter(r => r.placing)
    const surfPct = surfRaces.length
      ? surfRaces.map(r => parsePlacing(r.placing)?.percentile ?? 50).reduce((a, b) => a + b, 0) / surfRaces.length
      : allRacesWithPlacing.length
        ? allRacesWithPlacing.map(r => parsePlacing(r.placing)?.percentile ?? 50).reduce((a, b) => a + b, 0) / allRacesWithPlacing.length
        : 50
    const surfScore = Math.round(surfPct)

    // Rest gap (15%) — was there enough recovery?
    const lastRace = past.sort((a, b) => b.date.localeCompare(a.date))[0]
    const lastDist = lastRace ? distanceToKm(lastRace.distance) : 0
    const minRecovery = lastDist >= 42 ? 14 : lastDist >= 21 ? 7 : 3
    const daysSinceLast = lastRace ? daysAgo(lastRace.date) : 999
    const restScore = daysSinceLast >= minRecovery ? 100 : Math.round((daysSinceLast / minRecovery) * 100)

    // Has PB for this distance (20%)
    const hasPBForDist = !!pb
    const pbScore = hasPBForDist ? 60 : 40

    const weighted = Math.round(formScore * 0.30 + surfScore * 0.25 + restScore * 0.15 + pbScore * 0.20 + 10)
    const clamped = Math.max(5, Math.min(95, weighted))

    const label = clamped >= 65 ? 'HIGH' : clamped >= 40 ? 'MODERATE' : 'LOW'
    const color = clamped >= 65 ? 'var(--green)' : clamped >= 40 ? 'var(--gold)' : 'var(--orange)'

    return { probability: clamped, label, color, hasPBForDist }
  }, [races, nextRace, today])

  if (!nextRace) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>PB PROBABILITY</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Add an upcoming race to estimate your PB chance.</div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>PB PROBABILITY</div>
          <div style={st.widgetTitle}>{(nextRace.name ?? 'NEXT RACE').toUpperCase()}</div>
        </div>
        {result && <span style={{ ...st.badgePill, background: `${result.color}22`, color: result.color, border: `1px solid ${result.color}55`, flexShrink: 0 }}>{result.label}</span>}
      </div>

      {!result ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Log 2+ races to calculate PB probability.</div>
      ) : (
        <>
          <div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '64px', lineHeight: 1, color: result.color, letterSpacing: '-0.02em' }}>
              {result.probability}%
            </div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
              PB CHANCE
            </div>
            <div style={{ height: '3px', background: 'var(--surface3)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${result.probability}%`, background: result.color, borderRadius: '2px' }} />
            </div>
          </div>
          <div style={st.widgetDivider} />
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
            {!result.hasPBForDist
              ? 'No PB logged for this distance — every finish is a new PB.'
              : 'Based on form trend, surface fit, and recent recovery.'}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Streak Risk Widget ───────────────────────────────────────────────────────

function StreakRiskWidget() {
  const garminActivities = useWearableStore(s => s.garminActivities)
  const whoopActivities  = useWearableStore(s => s.whoopActivities)
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const result = useMemo(() => {
    // Build a set of active days from wearables or recent races
    const activeDays = new Set<string>()
    garminActivities.forEach(a => { if (a.startTimeGmt) activeDays.add(a.startTimeGmt.split('T')[0].split(' ')[0]) })
    whoopActivities.forEach(a => { if (a.start) activeDays.add(a.start.split('T')[0]) })

    // Fallback to recent races if no wearable data
    if (activeDays.size === 0) {
      races.filter(r => r.date <= today).forEach(r => activeDays.add(r.date))
    }

    if (activeDays.size === 0) return null

    // Compute current streak (consecutive days back from today)
    let streak = 0
    let d = new Date(); d.setHours(0, 0, 0, 0)
    while (true) {
      const ds = d.toISOString().split('T')[0]
      if (!activeDays.has(ds)) break
      streak++
      d.setDate(d.getDate() - 1)
    }

    const isRisk = streak >= 14
    const label = isRisk ? 'RISK' : streak >= 7 ? 'BUILDING' : 'HEALTHY'
    const color = isRisk ? 'var(--orange)' : streak >= 7 ? 'var(--gold)' : 'var(--green)'
    const note = isRisk
      ? `${streak}-day streak — consider a rest day to avoid overtraining.`
      : streak >= 7
      ? `${streak}-day streak — monitor for fatigue signs.`
      : streak > 0
      ? `${streak}-day active streak. Keep it consistent.`
      : 'No recent activity streak detected.'

    return { streak, label, color, note }
  }, [garminActivities, whoopActivities, races, today])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>STREAK RISK</div>
          <div style={st.widgetTitle}>TRAINING LOAD</div>
        </div>
        {result && <span style={{ ...st.badgePill, background: `${result.color}22`, color: result.color, border: `1px solid ${result.color}55`, flexShrink: 0 }}>{result.label}</span>}
      </div>

      {!result ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NO ACTIVITY DATA</div>
          <div style={st.lockedText}>Connect Garmin or WHOOP to track your training streak risk.</div>
        </div>
      ) : (
        <>
          <div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '64px', lineHeight: 1, color: result.color, letterSpacing: '-0.02em' }}>
              {result.streak}d
            </div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
              CURRENT STREAK
            </div>
          </div>
          <div style={st.widgetDivider} />
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>{result.note}</div>
        </>
      )}
    </div>
  )
}

// ─── Advanced Race DNA Widget (Pro) ──────────────────────────────────────────

function AdvancedRaceDNAWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const past  = useMemo(() => races.filter(r => r.date <= today && r.placing), [races, today])

  const data = useMemo(() => {
    const withHumidity = past.filter(r => r.weather?.humidity != null)
    const withElev = past.filter(r => typeof r.elevation === 'number')

    let humidityInsight: string | null = null
    if (withHumidity.length >= 2) {
      const lo = withHumidity.filter(r => r.weather!.humidity! < 60)
      const hi = withHumidity.filter(r => r.weather!.humidity! >= 60)
      const avg = (rs: Race[]) => rs.length ? rs.reduce((s, r) => s + (parsePlacing(r.placing)?.percentile ?? 50), 0) / rs.length : null
      const avgLo = avg(lo), avgHi = avg(hi)
      if (avgLo != null && avgHi != null) {
        humidityInsight = avgLo > avgHi ? 'Better in dry conditions (<60% humidity)' : 'Handles humidity well (60%+)'
      }
    }

    let elevInsight: string | null = null
    if (withElev.length >= 2) {
      const flat  = withElev.filter(r => r.elevation! < 200)
      const hilly = withElev.filter(r => r.elevation! >= 200)
      const avg = (rs: Race[]) => rs.length ? rs.reduce((s, r) => s + (parsePlacing(r.placing)?.percentile ?? 50), 0) / rs.length : null
      const avgFlat = avg(flat), avgHilly = avg(hilly)
      if (avgFlat != null && avgHilly != null) {
        elevInsight = avgFlat > avgHilly ? 'Flat course specialist' : 'Performs well on hills'
      }
    }

    return { withHumidity: withHumidity.length, withElev: withElev.length, humidityInsight, elevInsight }
  }, [past])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>ADVANCED RACE DNA</div>
          <div style={st.widgetTitle}>CONDITION ANALYSIS</div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>🧬</span>
      </div>
      {past.length < 2 ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          Log 2+ races with placing data to unlock advanced condition analysis.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {data.humidityInsight && (
            <div style={{ padding: '8px', background: 'var(--surface3)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px' }}>HUMIDITY</div>
              <div style={{ fontSize: '12px', color: 'var(--white)' }}>{data.humidityInsight}</div>
            </div>
          )}
          {data.elevInsight && (
            <div style={{ padding: '8px', background: 'var(--surface3)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px' }}>ELEVATION</div>
              <div style={{ fontSize: '12px', color: 'var(--white)' }}>{data.elevInsight}</div>
            </div>
          )}
          {!data.humidityInsight && !data.elevInsight && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Add humidity and elevation data to your logged races to unlock insights.
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
            {data.withHumidity} humidity · {data.withElev} elevation records
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Weather Fit Score Widget (Pro) ──────────────────────────────────────────

function WeatherFitWidget() {
  const races    = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)
  const today    = todayStr()

  const result = useMemo(() => {
    const past = races.filter(r => r.date <= today && r.placing && r.weather?.temp != null)
    if (past.length < 2) return null

    // Bucket performance by temp
    const buckets: { label: string; min: number; max: number; pcts: number[]; emoji: string }[] = [
      { label: 'Cold (<5°C)',  min: -99, max:  5, pcts: [], emoji: '🥶' },
      { label: 'Cool (5–12)', min:   5, max: 12, pcts: [], emoji: '🌤' },
      { label: 'Mild (12–18)',min:  12, max: 18, pcts: [], emoji: '☀️' },
      { label: 'Warm (18–24)',min:  18, max: 24, pcts: [], emoji: '🌡' },
      { label: 'Hot (>24°C)', min:  24, max: 99, pcts: [], emoji: '🔥' },
    ]

    for (const r of past) {
      const t = r.weather!.temp!
      const p = parsePlacing(r.placing)
      if (!p) continue
      const b = buckets.find(b => t >= b.min && t < b.max)
      if (b) b.pcts.push(p.percentile)
    }

    const ranked = buckets
      .filter(b => b.pcts.length > 0)
      .map(b => ({ ...b, avg: Math.round(b.pcts.reduce((a, c) => a + c, 0) / b.pcts.length) }))
      .sort((a, b) => b.avg - a.avg)

    if (!ranked.length) return null

    const best = ranked[0]

    // Estimate next race month's typical temp (rough heuristic by month)
    let fitLabel = 'UNKNOWN'
    let fitColor = 'var(--muted)'
    if (nextRace?.date) {
      const m = parseInt(nextRace.date.split('-')[1] ?? '6')
      // rough northern-hemisphere estimate
      const estTemp = [2, 3, 7, 11, 16, 20, 23, 22, 17, 12, 6, 3][m - 1]
      const matchBucket = ranked.find(b => estTemp >= b.min && estTemp < b.max)
      if (matchBucket) {
        const rank = ranked.indexOf(matchBucket)
        if (rank === 0) { fitLabel = 'IDEAL CONDITIONS'; fitColor = 'var(--green)' }
        else if (rank === 1) { fitLabel = 'GOOD CONDITIONS'; fitColor = '#7CFC00' }
        else { fitLabel = 'CHALLENGING CONDITIONS'; fitColor = 'var(--orange)' }
      }
    }

    return { ranked: ranked.slice(0, 3), best, fitLabel, fitColor, total: past.length }
  }, [races, nextRace, today])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>WEATHER FIT SCORE</div>
          <div style={st.widgetTitle}>
            {result ? result.fitLabel : 'YOUR CLIMATE PROFILE'}
          </div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>🌤</span>
      </div>

      {!result ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          Log 2+ races with placing data to build your weather performance profile.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          {nextRace && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '13px', color: result.fitColor, letterSpacing: '0.08em' }}>
                {result.fitLabel}
              </span>
            </div>
          )}
          <div style={st.widgetDivider} />
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            YOUR BEST PERFORMING CONDITIONS
          </div>
          {result.ranked.map((b, i) => (
            <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: i === 0 ? 'var(--white)' : 'var(--muted)', fontWeight: i === 0 ? 700 : 400 }}>
                {b.emoji} {b.label}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: i === 0 ? 'var(--green)' : 'var(--muted)' }}>
                Top {100 - b.avg}% {i === 0 && '★'}
              </span>
            </div>
          ))}
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
            Based on {result.total} races with weather + placing data
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Race Gap Analysis Widget (Pro) ──────────────────────────────────────────

function RaceGapAnalysisWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const past = useMemo(() => races.filter(r => r.date <= today).sort((a, b) => a.date.localeCompare(b.date)), [races, today])
  const tightStacks = useMemo(() => {
    let count = 0
    for (let i = 1; i < past.length; i++) {
      const gap = Math.round((new Date(past[i].date + 'T00:00:00').getTime() - new Date(past[i - 1].date + 'T00:00:00').getTime()) / 86400000)
      const d = distanceToKm(past[i - 1].distance)
      if (d >= 10 && gap < 14) count++
    }
    return count
  }, [past])
  const gapData = useMemo(() => {
    if (past.length < 2) return null
    const gaps = past.slice(1).map((r, i) => {
      const gapDays = Math.round((new Date(r.date + 'T00:00:00').getTime() - new Date(past[i].date + 'T00:00:00').getTime()) / 86400000)
      const d = distanceToKm(past[i].distance)
      return { race: r, prev: past[i], gapDays, isTight: d >= 10 && gapDays < 14 }
    })
    const avgGap = Math.round(gaps.reduce((s, g) => s + g.gapDays, 0) / gaps.length)
    return { avgGap, tightCount: tightStacks, recentGaps: gaps.slice(-3).reverse() }
  }, [past, tightStacks])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>RACE GAP / RECOVERY</div>
          <div style={st.widgetTitle}>{gapData ? `AVG ${gapData.avgGap}d BETWEEN RACES` : 'RECOVERY ANALYSIS'}</div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>⏱</span>
      </div>
      {!gapData ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          Log 2+ races to analyse recovery and race-spacing patterns.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {gapData.tightCount > 0 && (
            <div style={{ padding: '8px', background: 'rgba(var(--orange-ch),0.1)', border: '1px solid rgba(var(--orange-ch),0.25)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--orange)' }}>⚠️ {gapData.tightCount} tight stack{gapData.tightCount !== 1 ? 's' : ''} — races within 14 days</div>
            </div>
          )}
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>RECENT GAPS</div>
          {gapData.recentGaps.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {g.prev.name ?? g.prev.date} → {g.race.name ?? g.race.date}
              </span>
              <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: g.isTight ? 'var(--orange)' : 'var(--green)', flexShrink: 0, marginLeft: '8px' }}>
                {g.gapDays}d
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Why You PR'd Widget (Pro) ────────────────────────────────────────────────

function WhyPRdWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const pbMap = useMemo(() => buildPBMap(races.filter(r => r.date <= today)), [races, today])
  const pbRaces = useMemo(() => Object.values(pbMap), [pbMap])

  const insights = useMemo(() => {
    if (!pbRaces.length) return null
    const surfaces: Record<string, number> = {}
    const months: Record<number, number> = {}
    for (const r of pbRaces) {
      const s = r.surface ?? 'Road'; surfaces[s] = (surfaces[s] ?? 0) + 1
      const m = parseInt(r.date.split('-')[1]); months[m] = (months[m] ?? 0) + 1
    }
    const topSurface = Object.entries(surfaces).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topMonthNum = Object.entries(months).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0]
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const topMonth = topMonthNum ? MONTHS[parseInt(topMonthNum) - 1] : null
    const withTemp = pbRaces.filter(r => r.weather?.temp != null)
    const avgTemp = withTemp.length ? Math.round(withTemp.reduce((s, r) => s + r.weather!.temp!, 0) / withTemp.length) : null
    return { topSurface, topMonth, avgTemp }
  }, [pbRaces])

  if (!pbRaces.length) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>WHY YOU PR'D</div>
        <div style={st.widgetTitle}>NO PBs YET</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>Log races to discover the conditions behind your best performances.</div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>WHY YOU PR'D</div>
          <div style={st.widgetTitle}>{pbRaces.length} PERSONAL BEST{pbRaces.length !== 1 ? 'S' : ''}</div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>🏆</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
        {insights?.topSurface && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>🏃 Best surface</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--white)' }}>{insights.topSurface}</span>
          </div>
        )}
        {insights?.topMonth && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>📅 Peak month</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--white)' }}>{insights.topMonth}</span>
          </div>
        )}
        {insights?.avgTemp != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>🌡 Avg race temp</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--white)' }}>{insights.avgTemp}°C</span>
          </div>
        )}
        <div style={st.widgetDivider} />
        {pbRaces.slice(0, 3).map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{r.name ?? r.date}</span>
            <span style={{ color: '#C8963C', fontFamily: 'var(--mono)', flexShrink: 0 }}>{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Why You Faded Widget (Pro) ───────────────────────────────────────────────

function WhyFadedWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const fadedRaces = useMemo(() => {
    return races
      .filter(r => r.date <= today && (r.splits ?? []).length >= 2)
      .map(r => {
        const splits = (r.splits ?? []).filter(s => s.split)
        if (splits.length < 2) return null
        const first = parseHMS(splits[0].split!) ?? 0
        const last  = parseHMS(splits[splits.length - 1].split!) ?? 0
        if (last <= first * 1.05) return null
        const fadePct = Math.round(((last - first) / Math.max(first, 1)) * 100)
        return { r, fadePct }
      })
      .filter(Boolean)
      .sort((a, b) => b!.fadePct - a!.fadePct) as { r: Race; fadePct: number }[]
  }, [races, today])

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>WHY YOU FADED</div>
          <div style={st.widgetTitle}>{fadedRaces.length > 0 ? `${fadedRaces.length} FADE${fadedRaces.length !== 1 ? 'S' : ''} DETECTED` : 'NO FADES DETECTED'}</div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>📉</span>
      </div>
      {fadedRaces.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          No significant pace drops found. Log races with splits to track pacing patterns.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginTop: '8px' }}>
          {fadedRaces.slice(0, 4).map(({ r, fadePct }) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{r.name ?? r.date}</span>
              <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--orange)', flexShrink: 0 }}>+{fadePct}% fade</span>
            </div>
          ))}
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>Detected from split-time data</div>
        </div>
      )}
    </div>
  )
}

// ─── Race Comparer Widget (Pro) ───────────────────────────────────────────────

function RaceComparerWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const past  = useMemo(() => races.filter(r => r.date <= today && r.time).sort((a, b) => b.date.localeCompare(a.date)), [races, today])
  const [idxA, setIdxA] = useState(0)
  const [idxB, setIdxB] = useState(Math.min(1, Math.max(0, past.length - 1)))
  const raceA = past[idxA]
  const raceB = past[idxB]

  const diff = useMemo(() => {
    if (!raceA?.time || !raceB?.time) return null
    const a = parseHMS(raceA.time) ?? 0
    const b = parseHMS(raceB.time) ?? 0
    if (!a || !b) return null
    return { secs: Math.abs(a - b), faster: a < b ? 'A' : 'B' }
  }, [raceA, raceB])

  if (past.length < 2) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>RACE COMPARER</div>
        <div style={st.widgetTitle}>LOG 2+ RACES</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>Need at least 2 timed races to compare.</div>
      </div>
    )
  }

  const selStyle: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px', color: 'inherit' }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div>
        <div style={st.widgetLabel}>RACE COMPARER</div>
        <div style={st.widgetTitle}>SIDE BY SIDE</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
        <div style={{ background: 'var(--surface3)', borderRadius: '8px', padding: '8px' }}>
          <select value={idxA} onChange={e => setIdxA(Number(e.target.value))} style={{ ...selStyle, color: 'var(--orange)' }}>
            {past.map((r, i) => <option key={r.id} value={i}>{r.name ?? r.date}</option>)}
          </select>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: diff?.faster === 'A' ? 'var(--green)' : 'var(--white)' }}>{raceA?.time ?? '—'}</div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{raceA?.date ?? ''}</div>
        </div>
        <div style={{ background: 'var(--surface3)', borderRadius: '8px', padding: '8px' }}>
          <select value={idxB} onChange={e => setIdxB(Number(e.target.value))} style={{ ...selStyle, color: 'var(--muted)' }}>
            {past.map((r, i) => <option key={r.id} value={i}>{r.name ?? r.date}</option>)}
          </select>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: diff?.faster === 'B' ? 'var(--green)' : 'var(--white)' }}>{raceB?.time ?? '—'}</div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{raceB?.date ?? ''}</div>
        </div>
      </div>
      {diff && (
        <div style={{ marginTop: '8px', padding: '8px', background: 'var(--surface3)', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}>{secsToHMS(diff.secs)}</span>
          <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>faster in Race {diff.faster}</span>
        </div>
      )}
    </div>
  )
}

// ─── Race Stack Planner Widget (Pro) ─────────────────────────────────────────

function RaceStackWidget() {
  const nextRace = useRaceStore(selectNextRace)

  const checklist = useMemo(() => {
    if (!nextRace) return null

    const dist    = distanceToKm(nextRace.distance)
    const surface = (nextRace.surface ?? 'road').toLowerCase()
    const sport   = (nextRace.sport   ?? 'run').toLowerCase()
    const isTri   = sport.includes('tri') || sport.includes('iron') || sport === 'duathlon'
    const isUltra = dist > 50
    const isTrail = surface.includes('trail') || surface.includes('mountain')
    const month   = nextRace.date ? parseInt(nextRace.date.split('-')[1] ?? '6') : 6
    const isHot   = [5, 6, 7, 8, 9].includes(month)
    const isCold  = [11, 12, 1, 2].includes(month)

    const categories: { label: string; emoji: string; items: string[] }[] = []

    // Core running kit
    const core: string[] = [
      isTrail ? 'Trail shoes' : 'Race flats / carbon shoes',
      'Race kit (top + shorts/tights)',
      'Race bib + safety pins',
      'GPS watch + charged',
    ]
    if (isHot)  core.push('Cap / visor', 'Sunscreen SPF50+', 'Extra electrolytes')
    if (isCold) core.push('Arm warmers', 'Gloves', 'Throwaway top for start')
    categories.push({ label: 'RACE KIT', emoji: '👟', items: core })

    // Nutrition
    const nutrition: string[] = []
    if (dist >= 21)  nutrition.push('Gels × ' + Math.ceil(dist / 10), 'Electrolyte tabs')
    if (dist >= 42)  nutrition.push('Real food / bars', 'Hydration vest or belt')
    if (isUltra)     nutrition.push('Drop bags packed', 'Headtorch + spare batteries')
    if (nutrition.length) categories.push({ label: 'NUTRITION', emoji: '⚡', items: nutrition })

    // Triathlon-specific
    if (isTri) {
      const triItems = [
        'Wetsuit + wetsuit lube', 'Goggles (+ spare pair)',
        'Transition bag', 'Helmet (must)', 'Cycling shoes + cleats',
        'Race number belt', 'Flat kit (tube, CO2, tyre levers)',
      ]
      categories.push({ label: 'TRIATHLON', emoji: '🏊', items: triItems })
    }

    // Trail-specific
    if (isTrail && !isTri) {
      const trailItems = ['Poles (check rules)', 'Mandatory kit bag', 'Buff / beanie']
      if (dist >= 42) trailItems.push('Emergency blanket', 'Whistle')
      categories.push({ label: 'TRAIL EXTRAS', emoji: '⛰', items: trailItems })
    }

    // Day-before / travel
    const prep = ['Lay out kit tonight', 'Charge all devices', 'Check bib pickup time']
    if (nextRace.city) prep.push('Route to venue saved offline')
    categories.push({ label: 'DAY BEFORE', emoji: '📋', items: prep })

    return categories
  }, [nextRace])

  const [openCat, setOpenCat] = useState<string | null>('RACE KIT')

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>RACE STACK PLANNER</div>
          <div style={st.widgetTitle}>
            {nextRace ? (nextRace.name ?? 'RACE DAY').toUpperCase() : 'ADD A RACE'}
          </div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>🎒</span>
      </div>

      {!checklist ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          Add an upcoming race to generate your personalised race-day kit list.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {checklist.map(cat => (
            <div key={cat.label}>
              <button
                onClick={() => setOpenCat(openCat === cat.label ? null : cat.label)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}
              >
                <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.12em', color: 'var(--white)', textTransform: 'uppercase' as const }}>
                  {cat.emoji} {cat.label}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{openCat === cat.label ? '▲' : '▼'} {cat.items.length}</span>
              </button>
              {openCat === cat.label && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingBottom: '6px' }}>
                  {cat.items.map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                      <span style={{ color: 'var(--orange)', flexShrink: 0, marginTop: '1px' }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              )}
              <div style={st.widgetDivider} />
            </div>
          ))}
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
            Tailored for {distBadge(nextRace?.distance) || nextRace?.distance || 'your race'} · {(nextRace?.surface ?? 'road')}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Adaptive Goals Widget (Pro) ─────────────────────────────────────────────

function AdaptiveGoalsWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const data = useMemo(() => {
    const past = races.filter(r => r.date <= today)
    const pbMap = buildPBMap(past)
    return races
      .filter(r => r.goalTime)
      .map(r => {
        const key = normalizeDistKey(r.distance)
        const pb = pbMap[key]
        const goalSecs = parseHMS(r.goalTime!)
        const pbSecs = pb?.time ? parseHMS(pb.time) : null
        if (!goalSecs) return null
        return { r, goalSecs, pbSecs }
      })
      .filter(Boolean)
      .slice(0, 3) as { r: Race; goalSecs: number; pbSecs: number | null }[]
  }, [races, today])

  if (!data.length) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>ADAPTIVE GOALS</div>
        <div style={st.widgetTitle}>NO GOALS SET</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          Set goal times on upcoming races to track your gap.
        </div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div>
        <div style={st.widgetLabel}>ADAPTIVE GOALS</div>
        <div style={st.widgetTitle}>GOAL TRACKER</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        {data.map(({ r, goalSecs, pbSecs }) => {
          const gap = pbSecs != null ? goalSecs - pbSecs : null
          const color = gap == null ? 'var(--muted)' : gap <= 0 ? 'var(--green)' : 'var(--orange)'
          return (
            <div key={r.id} style={{ padding: '8px', background: 'var(--surface3)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{r.name ?? distBadge(r.distance)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', color: 'var(--white)' }}>{r.goalTime}</span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '4px' }}>GOAL</span>
                </div>
                {gap != null && (
                  <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color }}>
                    {gap <= 0 ? `${secsToHMS(Math.abs(gap))} ahead` : `${secsToHMS(gap)} behind`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Break Tape Moments Widget (Pro) ─────────────────────────────────────────

function BreakTapeWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const past  = useMemo(() => races.filter(r => r.date <= today).sort((a, b) => a.date.localeCompare(b.date)), [races, today])

  const milestones = useMemo(() => {
    const m: { icon: string; label: string; detail: string }[] = []
    if (past.length > 0) m.push({ icon: '🏁', label: 'FIRST RACE', detail: past[0].name ?? past[0].date })

    const distanceSeen = new Set<string>()
    for (const r of past) {
      const key = normalizeDistKey(r.distance)
      const badge = distBadge(r.distance)
      if (key && badge && !distanceSeen.has(key) && badge !== `${distanceToKm(r.distance)}K`) {
        distanceSeen.add(key)
        if (m.length < 6) m.push({ icon: '⭐', label: `FIRST ${badge.toUpperCase()}`, detail: r.name ?? r.date })
      }
    }

    // Biggest single-race time improvement
    const byDist: Record<string, Race[]> = {}
    for (const r of past) {
      if (!r.time) continue
      const key = normalizeDistKey(r.distance)
      if (!key) continue
      ;(byDist[key] = byDist[key] ?? []).push(r)
    }
    let biggestDrop: { label: string; drop: number; race: Race } | null = null
    for (const [key, rs] of Object.entries(byDist)) {
      if (rs.length < 2) continue
      for (let i = 1; i < rs.length; i++) {
        const prev = parseHMS(rs[i - 1].time!) ?? 0
        const curr = parseHMS(rs[i].time!) ?? 0
        const drop = prev - curr
        if (drop > 0 && (!biggestDrop || drop > biggestDrop.drop)) {
          biggestDrop = { label: key, drop, race: rs[i] }
        }
      }
    }
    if (biggestDrop && m.length < 6) {
      m.push({ icon: '📉', label: `BIGGEST DROP — ${biggestDrop.label}`, detail: `-${secsToHMS(biggestDrop.drop)} · ${biggestDrop.race.name ?? biggestDrop.race.date}` })
    }

    return m
  }, [past])

  if (!milestones.length) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>BREAK TAPE MOMENTS</div>
        <div style={st.widgetTitle}>LOG YOUR FIRST RACE</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          Your iconic milestones will appear here as you race.
        </div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>BREAK TAPE MOMENTS</div>
          <div style={st.widgetTitle}>{milestones.length} MILESTONE{milestones.length !== 1 ? 'S' : ''}</div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>🎖</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
        {milestones.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>{m.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--orange)', textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{m.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── What To Race Next Widget (Pro) ──────────────────────────────────────────

function WhatToRaceNextWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const upcoming = useMemo(() => races.filter(r => r.date > today).sort((a, b) => a.date.localeCompare(b.date)), [races, today])
  const past     = useMemo(() => races.filter(r => r.date <= today && r.time), [races, today])

  const recommendation = useMemo(() => {
    if (!past.length) return null
    const pbRaces = Object.values(buildPBMap(past))
    const surfaces: Record<string, number> = {}
    for (const r of pbRaces) { const s = r.surface ?? 'Road'; surfaces[s] = (surfaces[s] ?? 0) + 1 }
    return Object.entries(surfaces).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }, [past])

  if (!upcoming.length) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>WHAT TO RACE NEXT</div>
        <div style={st.widgetTitle}>NO UPCOMING RACES</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '4px' }}>
          Add upcoming races to get recommendations based on your performance trends.
        </div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>WHAT TO RACE NEXT</div>
          <div style={st.widgetTitle}>{upcoming.length} RACE{upcoming.length !== 1 ? 'S' : ''} UPCOMING</div>
        </div>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>🎯</span>
      </div>
      {recommendation && (
        <div style={{ padding: '8px', background: 'rgba(var(--green-ch),0.08)', border: '1px solid rgba(var(--green-ch),0.2)', borderRadius: '8px', marginTop: '8px' }}>
          <div style={{ fontSize: '10px', color: 'var(--green)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>SURFACE MATCH</div>
          <div style={{ fontSize: '12px', color: 'var(--white)', marginTop: '2px' }}>Your PBs align with {recommendation.toLowerCase()} — prioritise {recommendation.toLowerCase()} events.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginTop: '8px' }}>
        {upcoming.slice(0, 3).map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name ?? 'Unnamed Race'}</div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{r.date} · {distBadge(r.distance) || r.distance}</div>
            </div>
            {r.priority && (
              <span style={{ fontSize: '10px', color: r.priority === 'A' ? 'var(--orange)' : 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, flexShrink: 0, marginLeft: '8px' }}>
                {r.priority}-RACE
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Story Mode widget ────────────────────────────────────────────────────────

function StoryModeWidget() {
  const races = useRaceStore(selectRaces)
  const year  = new Date().getFullYear()

  const story = useMemo(() => {
    if (!races.length) return null
    const thisYear = races.filter(r => (r.date ?? '').startsWith(String(year)))
    if (!thisYear.length) return null
    const countries = new Set(thisYear.map(r => r.country).filter(Boolean)).size
    const medals    = thisYear.filter(r => r.medal && r.medal !== '').length
    return {
      raceCount: thisYear.length,
      countries,
      medals,
      headline: `${thisYear.length} race${thisYear.length !== 1 ? 's' : ''} across ${countries || 1} countr${countries === 1 ? 'y' : 'ies'}`,
    }
  }, [races, year])

  if (!story) {
    return (
      <div className="card-v3 card-orange">
        <div style={st.widgetLabel}>STORY MODE</div>
        <div style={st.widgetTitle}>{year} RECAP</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: 4 }}>
          Log races through the year to unlock annual recaps and season highlights.
        </div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={st.widgetLabel}>STORY MODE</div>
          <div style={st.widgetTitle}>{year} RECAP</div>
        </div>
        <span style={{ fontSize: 22 }}>📖</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--white)', lineHeight: 1.5, marginTop: 6 }}>{story.headline}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {[
          { label: 'RACES', value: story.raceCount },
          { label: 'COUNTRIES', value: story.countries || 1 },
          { label: 'MEDALS', value: story.medals },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, background: 'var(--surface3)', borderRadius: 6, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 20, color: 'var(--orange)' }}>{value}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Annual recap and season cards build on this data.
      </div>
    </div>
  )
}

// ─── Coach Activity widget ────────────────────────────────────────────────────

function CoachActivityWidget() {
  const coachRelationships: unknown[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('fl2_coach_relationships') ?? '[]') } catch { return [] }
  }, [])
  const coachComments: unknown[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('fl2_coach_comments') ?? '[]') } catch { return [] }
  }, [])

  const relCount = coachRelationships.length
  const comCount = coachComments.length

  return (
    <div className="card-v3 card-orange">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={st.widgetLabel}>COACH ACTIVITY</div>
          <div style={st.widgetTitle}>SHARED VIEW</div>
        </div>
        <span style={{ fontSize: 22, background: 'rgba(var(--orange-ch),0.1)', borderRadius: 8, padding: '4px 8px' }}>{relCount}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: 6 }}>
        {relCount
          ? `${relCount} coach connection${relCount > 1 ? 's' : ''} active.`
          : 'Coach mode scaffold ready for shared athlete review.'}
      </div>
      {comCount > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          {comCount} coach comment{comCount > 1 ? 's' : ''} logged.
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', background: 'var(--surface3)', borderRadius: 6, padding: '8px 10px' }}>
        Coach mode coming soon — shared views, annotations, and training comments.
      </div>
    </div>
  )
}

// ─── Zone accordion ───────────────────────────────────────────────────────────

interface ZoneProps {
  id:       'now' | 'recently' | 'trending' | 'context'
  tag:      string
  label:    string
  children: React.ReactNode
}

function DashZone({ id, tag, label, children }: ZoneProps) {
  const zoneCollapse    = useDashStore(selectDashZoneCollapse)
  const setZoneCollapse = useDashStore(s => s.setZoneCollapse)
  const isCollapsed     = zoneCollapse[id] ?? false

  return (
    <div style={st.zone}>
      <button
        style={st.zoneBtn}
        onClick={() => setZoneCollapse(id, !isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={st.zoneTag}>{tag}</span>
          <span style={st.zoneLabel}>{label}</span>
        </div>
        <span style={{ ...st.zoneChevron, transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {!isCollapsed && <div style={st.zoneContent}>{children}</div>}
    </div>
  )
}

// ─── Personal Bests Widget ────────────────────────────────────────────────────

function PersonalBestsWidget() {
  const races = useRaceStore(selectRaces)
  const pbMap = useMemo(() => buildPBMap(races), [races])
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)

  // Group PBs by sport
  const groups = useMemo(() => {
    const run: { key: string; r: Race }[] = []
    const tri: { key: string; r: Race }[] = []
    const other: { key: string; r: Race }[] = []

    const distOrder: Record<string, number> = {
      '5K': 1, '10K': 2, 'Half Marathon': 3, 'Marathon': 4,
      'Ultra Marathon': 5, 'Olympic': 6, '70.3': 7, 'Ironman': 8,
    }

    for (const [key, r] of Object.entries(pbMap)) {
      const sport = (r.sport ?? 'Running').toLowerCase()
      const entry = { key, r }
      if (sport.includes('tri') || sport.includes('iron')) tri.push(entry)
      else if (sport.includes('run') || sport.includes('cycling') || sport.includes('swim')) run.push(entry)
      else other.push(entry)
    }

    const sortFn = (a: { key: string }, b: { key: string }) =>
      (distOrder[a.key] ?? 99) - (distOrder[b.key] ?? 99)

    return [
      ...(run.length ? [{ sport: 'Running', dot: '#00FF88', dotGlow: 'rgba(0,255,136,0.6)', entries: run.sort(sortFn) }] : []),
      ...(tri.length ? [{ sport: 'Triathlon', dot: '#7C3AED', dotGlow: 'rgba(124,58,237,0.6)', entries: tri.sort(sortFn) }] : []),
      ...(other.length ? [{ sport: 'Other', dot: 'var(--orange)', dotGlow: 'rgba(232,78,27,0.6)', entries: other.sort(sortFn) }] : []),
    ]
  }, [pbMap])

  if (!groups.length) {
    return (
      <div className="card-v3 card-orange" style={st.glowCard}>
        <div style={st.widgetLabel}>PERSONAL BESTS</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '8px' }}>
          Log timed races to build your PB board.
        </div>
      </div>
    )
  }

  return (
    <div className="card-v3 card-orange" style={st.glowCard}>
      <div style={st.widgetLabel}>PERSONAL BESTS</div>
      {groups.map(g => (
        <div key={g.sport} style={{ marginTop: '14px' }}>
          {/* Sport header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid var(--border)', marginBottom: '14px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: g.dot, boxShadow: `0 0 8px ${g.dotGlow}`, display: 'inline-block', animation: 'breathe 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--headline)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)' }}>{g.sport}</span>
          </div>

          {/* Horizontal scrolling PB cards */}
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as any }}>
            {g.entries.map(({ key, r }) => {
              const isTri = g.sport === 'Triathlon'
              const accentColor = isTri ? '#7C3AED' : '#00FF88'
              const accentBg = isTri ? 'rgba(124,58,237,0.08)' : 'rgba(0,255,136,0.06)'
              const accentGlow = isTri ? 'rgba(124,58,237,0.10)' : 'rgba(0,255,136,0.10)'
              const displayKey = distBadge(r.distance) || key.toUpperCase()
              return (
                <div
                  key={key}
                  onClick={() => setSelectedRace(r)}
                  style={{
                    position: 'relative',
                    minWidth: '160px', maxWidth: '160px',
                    background: `linear-gradient(145deg, #141414 0%, ${accentBg} 100%)`,
                    border: `1px solid var(--border2)`,
                    borderLeft: `3px solid ${accentColor}`,
                    borderRadius: '14px',
                    padding: '14px 14px 12px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                    boxShadow: `inset 0 1px 0 ${accentGlow}, 0 4px 20px rgba(0,0,0,0.4)`,
                  }}
                >
                  {/* Distance label */}
                  <div style={{ fontFamily: 'var(--headline)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                    {displayKey}
                  </div>
                  {/* Time */}
                  <div style={{ fontFamily: 'var(--headline)', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1, marginBottom: '8px', color: accentColor }}>
                    {r.time}
                  </div>
                  {/* Race name */}
                  <div style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.name ?? r.date}
                  </div>
                  {/* Date */}
                  <div style={{ fontSize: '10px', color: 'var(--muted2)', marginTop: '2px' }}>
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {selectedRace && (
        <ViewEditRaceModal
          race={selectedRace}
          onClose={() => setSelectedRace(null)}
        />
      )}
    </div>
  )
}

// ─── All Upcoming Races Modal ─────────────────────────────────────────────────

function AllUpcomingModal({ onClose, onAddRace }: { onClose: () => void; onAddRace: () => void }) {
  const upcoming        = useRaceStore(selectUpcomingRaces)
  const focusRaceId     = useRaceStore(selectFocusRaceId)
  const setFocusRaceId  = useRaceStore(s => s.setFocusRaceId)
  const today           = todayStr()
  const [editingId, setEditingId] = useState<string | null>(null)

  function selectFocus(id: string) {
    setFocusRaceId(focusRaceId === id ? null : id)  // tap again to deselect
    onClose()
  }

  const sorted = useMemo(
    () => [...upcoming].filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [upcoming, today],
  )
  const editing = editingId ? sorted.find(r => r.id === editingId) ?? null : null

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      {editing && (
        <EditUpcomingRaceSheet
          race={editing}
          onClose={() => setEditingId(null)}
          zIndex={1000}
        />
      )}
      <div style={st.modalOverlay} onClick={onClose}>
        <div style={{ ...st.customizeSheet, maxHeight: '80vh', paddingBottom: '0', overflowY: 'hidden' }} onClick={e => e.stopPropagation()}>
          {/* Handle pill */}
          <div style={{ width: '40px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '0 auto 20px', flexShrink: 0 }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '20px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
              UPCOMING RACES
              <span style={{ marginLeft: '8px', fontFamily: 'var(--body)', fontWeight: 600, fontSize: '13px', color: 'var(--muted)', letterSpacing: 0, textTransform: 'none' }}>
                {sorted.length > 0 ? `${sorted.length} race${sorted.length !== 1 ? 's' : ''}` : ''}
              </span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }} aria-label="Close">✕</button>
          </div>

          {/* Race list — scrollable */}
          <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, overscrollBehavior: 'contain', flex: 1, display: 'flex', flexDirection: 'column', gap: '0', paddingBottom: '12px' }}>
            {sorted.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: '14px' }}>
                No upcoming races yet.
              </div>
            ) : sorted.map((r, idx) => {
              const d       = daysUntil(r.date)
              const isA     = r.priority === 'A'
              const prev    = sorted[idx - 1]
              const gapDays = prev
                ? Math.round((new Date(r.date + 'T00:00:00').getTime() - new Date(prev.date + 'T00:00:00').getTime()) / 86400000)
                : null

              return (
                <div key={r.id}>
                  {/* Gap divider */}
                  {gapDays !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
                      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                      <span style={{ fontFamily: 'var(--body)', fontSize: '11px', fontWeight: 600, color: gapDays < 21 ? '#ff9966' : 'var(--muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {gapDays < 21 ? '⚠ ' : ''}{gapDays}d gap
                      </span>
                      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    </div>
                  )}

                  {/* A-race — large highlighted card */}
                  {isA ? (
                    <div onClick={() => selectFocus(r.id)} style={{ background: 'linear-gradient(135deg, rgba(var(--orange-ch),0.18) 0%, rgba(var(--orange-ch),0.08) 100%)', border: focusRaceId === r.id ? '2px solid var(--orange)' : '1.5px solid rgba(var(--orange-ch),0.5)', borderRadius: '12px', padding: '16px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: 'var(--orange)', borderRadius: '12px 0 0 12px' }} />
                      {focusRaceId === r.id && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#000', fontWeight: 900 }}>✓</div>
                      )}
                      <div style={{ paddingLeft: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <span style={{ background: 'var(--orange)', color: '#000', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '10px', letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>A RACE</span>
                            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{r.name ?? 'Unnamed race'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={e => { e.stopPropagation(); setEditingId(r.id) }} style={{ background: 'rgba(var(--orange-ch),0.15)', border: '1px solid rgba(var(--orange-ch),0.4)', borderRadius: '6px', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.06em', padding: '5px 10px', cursor: 'pointer', flexShrink: 0 }}>EDIT</button>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                          {[r.city, r.country].filter(Boolean).join(', ')}
                          {r.distance ? ` · ${distBadge(r.distance) || r.distance + 'K'}` : ''}
                          {' · '}{fmtDateIntl(r.date)}
                          {r.goalTime ? <span style={{ color: 'var(--orange)', marginLeft: '6px' }}>🎯 {r.goalTime}</span> : ''}
                        </div>
                        <div style={{ marginTop: '10px' }}>
                          <span style={{ display: 'inline-block', background: d === 0 ? 'var(--orange)' : 'rgba(var(--orange-ch),0.2)', color: d === 0 ? '#000' : 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.06em', padding: '4px 12px', borderRadius: '6px' }}>
                            {d === 0 ? 'TODAY' : `${d} DAYS`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Standard B/C card */
                    <div onClick={() => selectFocus(r.id)} style={{ background: focusRaceId === r.id ? 'rgba(var(--orange-ch),0.08)' : 'var(--surface3)', border: focusRaceId === r.id ? '1px solid rgba(var(--orange-ch),0.5)' : '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.priority && r.priority !== 'A' && <span style={{ color: 'var(--muted)', marginRight: '6px', fontSize: '11px' }}>{r.priority}</span>}
                          {r.name ?? 'Unnamed race'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                          {[r.city, r.country].filter(Boolean).join(', ')}
                          {r.distance ? ` · ${distBadge(r.distance) || r.distance + 'K'}` : ''}
                          {' · '}{fmtDateIntl(r.date)}
                          {r.goalTime ? <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>· 🎯 {r.goalTime}</span> : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color: d === 0 ? 'var(--orange)' : 'var(--muted)', letterSpacing: '0.04em' }}>
                          {d === 0 ? 'TODAY' : `${d}D`}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={e => { e.stopPropagation(); setEditingId(r.id) }} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '5px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', padding: '3px 8px', cursor: 'pointer' }}>EDIT</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add race — sticky footer */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--surface2)' }}>
            <button onClick={() => { onClose(); onAddRace() }} style={{ width: '100%', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: '10px', padding: '14px', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              + ADD UPCOMING RACE
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── No Upcoming Race CTA ─────────────────────────────────────────────────────

function NoUpcomingRaceCTA({ onAddRace }: { onAddRace: () => void }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%)',
      border: '1px dashed rgba(var(--orange-ch),0.35)',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '32px', lineHeight: 1 }}>📅</div>
      <div>
        <div style={{
          fontFamily: 'var(--headline)',
          fontWeight: 900,
          fontSize: '16px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--white)',
          marginBottom: '4px',
        }}>No upcoming race</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
          Add your next race to start the countdown and unlock race-day forecasts.
        </div>
      </div>
      <button
        onClick={onAddRace}
        style={{
          background: 'var(--orange)',
          color: '#000',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 22px',
          fontFamily: 'var(--headline)',
          fontWeight: 800,
          fontSize: '13px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        + Add Upcoming Race
      </button>
    </div>
  )
}

// ─── Pace Calculator ─────────────────────────────────────────────────────────

const PACE_DISTS = [
  { label: '5K',            km: 5 },
  { label: '10K',           km: 10 },
  { label: 'Half Marathon', km: 21.0975 },
  { label: 'Marathon',      km: 42.195 },
]

function secsToMMSS(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.round(s % 60).toString().padStart(2, '0')}`
}

function PaceCalculator() {
  const [distIdx, setDistIdx] = useState(2)
  const [goalTime, setGoalTime] = useState('')
  const [result, setResult] = useState<{ km: string; mi: string } | null>(null)

  return (
    <div style={st.sectionCard}>
      <div style={st.sectionHeader}>PACE CALCULATOR</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
          <div>
            <label style={st.inputLabel}>Distance</label>
            <select value={distIdx} onChange={e => { setDistIdx(+e.target.value); setResult(null) }} style={st.select}>
              {PACE_DISTS.map((d, i) => <option key={d.label} value={i}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label style={st.inputLabel}>Goal Time</label>
            <input type="text" placeholder="1:45:00" value={goalTime}
              onChange={e => { setGoalTime(e.target.value); setResult(null) }} style={st.input} />
          </div>
        </div>
        <button style={st.ctaPrimary} onClick={() => {
          const secs = parseHMS(goalTime)
          if (!secs) return
          const d = PACE_DISTS[distIdx]
          setResult({ km: secsToMMSS(secs / d.km), mi: secsToMMSS(secs / (d.km / 1.60934)) })
        }}>Calculate</button>
        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <div style={st.paceResult}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '24px', color: 'var(--orange)', letterSpacing: '0.02em', lineHeight: 1.1 }}>{result.km}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>min/km</div>
            </div>
            <div style={st.paceResult}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '24px', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.1 }}>{result.mi}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>min/mi</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Formula Widgets (Day 2) ──────────────────────────────────────────────────

function RiegelPredictorWidget({ onAddGoal }: { onAddGoal?: (distance: string) => void }) {
  const races = useRaceStore(selectRaces)
  const result = useMemo(() => bestRiegelTable(races), [races])
  if (!result) return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🔮 RACE PREDICTOR</div>
      <div style={st.widgetTitle}>RIEGEL PREDICTOR</div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Log a race with a finish time to see predictions.</p>
    </div>
  )
  const { race, table } = result
  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🔮 RACE PREDICTOR</div>
      <div style={st.widgetTitle}>RIEGEL PREDICTOR</div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-4px' }}>
        Based on {race.name} · {race.date}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {table.map(row => (
          <div
            key={row.distance}
            onClick={() => !row.isSameAsInput && onAddGoal?.(row.distance)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', borderRadius: '6px',
              background: row.isSameAsInput ? 'rgba(var(--orange-ch),0.1)' : 'var(--surface3)',
              border: `1px solid ${row.isSameAsInput ? 'rgba(var(--orange-ch),0.3)' : 'var(--border)'}`,
              cursor: row.isSameAsInput ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: '13px', color: row.isSameAsInput ? 'var(--orange)' : 'var(--white)', fontWeight: row.isSameAsInput ? 700 : 400 }}>
              {row.distance}
              {row.isSameAsInput && <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--headline)' }}>actual</span>}
              {!row.isSameAsInput && onAddGoal && <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--muted2)', fontFamily: 'var(--headline)' }}>+ GOAL</span>}
            </span>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: row.isSameAsInput ? 'var(--orange)' : 'var(--white)' }}>
              {row.predictedTime}
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted2)', lineHeight: 1.5 }}>
        T₂ = T₁ × (D₂/D₁)^1.06 · tap a row to add as upcoming goal
      </div>
    </div>
  )
}

function VdotSparkline({ history }: { history: { vdot: number }[] }) {
  const pts = history.slice(-12)
  if (pts.length < 2) return null
  const W = 120, H = 32, pad = 2
  const vals = pts.map(p => p.vdot)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const range = hi - lo || 1
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (W - pad * 2))
  const ys = pts.map(p => H - pad - ((p.vdot - lo) / range) * (H - pad * 2))
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')}
        fill="none" stroke="rgba(255,77,0,0.5)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={`${d} L${xs[xs.length-1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`}
        fill="rgba(255,77,0,0.1)" />
      <circle cx={xs[xs.length-1].toFixed(1)} cy={ys[ys.length-1].toFixed(1)} r="3" fill="var(--orange)" />
    </svg>
  )
}

function VDOTScoreWidget() {
  const races = useRaceStore(selectRaces)
  const units = useUnits()
  const history = useMemo(() => vdotHistory(races), [races])
  const vdotPt  = useMemo(() => bestVDOT(races), [races])
  const equivs  = useMemo(() => vdotPt ? equivalentPerformances(vdotPt.vdot) : [], [vdotPt])
  const zones   = useMemo(() => vdotPt ? paceZones(vdotPt.vdot, units) : [], [vdotPt, units])

  if (!vdotPt) return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>⚡ VDOT SCORE</div>
      <div style={st.widgetTitle}>VDOT FITNESS</div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Log a race with a finish time to compute your VDOT.</p>
    </div>
  )

  const vdotColor = vdotPt.vdot >= 55 ? '#00FF88' : vdotPt.vdot >= 45 ? 'var(--orange)' : 'var(--white)'

  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>⚡ VDOT SCORE</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '52px', lineHeight: 1, color: vdotColor }}>
          {vdotPt.vdot}
        </span>
        <div style={{ paddingBottom: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em' }}>VDOT</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{vdotPt.raceName}</div>
        </div>
        </div>
        {history.length >= 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <VdotSparkline history={history} />
            <div style={{ fontSize: '9px', color: 'var(--muted2)', fontFamily: 'var(--headline)', letterSpacing: '0.06em' }}>
              {history.length} RACES
            </div>
          </div>
        )}
      </div>

      {/* Equivalent performances */}
      <div>
        <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
          EQUIVALENT PERFORMANCES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          {equivs.slice(0, 6).map(e => (
            <div key={e.distance} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>
                {e.distance.replace(' Marathon', 'M').replace('Marathon', 'MAR')}
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color: 'var(--white)' }}>
                {e.timeStr}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Training zones */}
      <div>
        <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
          TRAINING ZONES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {zones.map(z => (
            <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'var(--surface3)', borderRadius: '5px', border: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', width: '18px', color: 'var(--orange)' }}>{z.abbr}</span>
              <span style={{ flex: 1, fontSize: '11px', color: 'var(--muted)' }}>{z.description}</span>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '12px', color: 'var(--white)', flexShrink: 0 }}>
                {z.minPaceStr} – {z.maxPaceStr}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GoalPaceWidget() {
  const focusRace = useRaceStore(selectFocusRace)
  const races     = useRaceStore(selectRaces)
  const units     = useUnits()
  const vdotPt    = useMemo(() => bestVDOT(races), [races])

  const result = useMemo(() => {
    if (!focusRace?.goalTime) return null
    const goalSecs = fParseTimeSecs(focusRace.goalTime)
    const distKm   = fParseDistKm(focusRace.distance)
    if (!goalSecs || !distKm) return null
    return goalPaceCalc(goalSecs, distKm, units, vdotPt?.vdot)
  }, [focusRace, units, vdotPt])

  if (!focusRace) return null  // no focus race — hide widget entirely

  if (!result) return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🎯 GOAL PACE</div>
      <div style={st.widgetTitle}>GOAL PACE</div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
        Set a goal time on {focusRace.name} to see your pace breakdown.
      </p>
    </div>
  )

  const gapLabel = result.vsCurrentVDOT !== null
    ? result.vsCurrentVDOT > 0
      ? `${fSecsToHMS(result.vsCurrentVDOT)} faster than current fitness`
      : `${fSecsToHMS(Math.abs(result.vsCurrentVDOT))} within current reach`
    : null

  const gapColor = result.vsCurrentVDOT !== null && result.vsCurrentVDOT > 0 ? '#ff6b6b' : 'var(--green)'

  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🎯 GOAL PACE</div>
      <div style={st.widgetTitle}>GOAL PACE</div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-4px' }}>{focusRace.name}</div>

      {/* Main pace display */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1, background: 'var(--surface3)', borderRadius: '8px', padding: '14px', border: '1px solid var(--border2)', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>per KM</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '26px', color: 'var(--orange)', lineHeight: 1.1, marginTop: '4px' }}>{result.pacePaceStr.split(' ')[0]}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface3)', borderRadius: '8px', padding: '14px', border: '1px solid var(--border2)', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>per MILE</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '26px', color: 'var(--white)', lineHeight: 1.1, marginTop: '4px' }}>{result.paceMileStr.split(' ')[0]}</div>
        </div>
      </div>

      {/* VDOT gap */}
      {gapLabel && (
        <div style={{ fontSize: '12px', color: gapColor, padding: '6px 10px', background: 'var(--surface3)', borderRadius: '6px', border: `1px solid ${gapColor}33` }}>
          {gapLabel}
          {result.requiredVDOT && <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>VDOT {result.requiredVDOT}</span>}
        </div>
      )}

      {/* Splits */}
      <div>
        <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>SPLIT TARGETS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {result.splitTargets.map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'var(--surface3)', borderRadius: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', color: 'var(--white)' }}>{s.cumStr}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const _raceWeatherCache: Record<string, { temp: number; humidity: number } | null> = {}

async function fetchArchiveWeather(race: Race): Promise<{ temp: number; humidity: number } | null> {
  if (!race.city && !race.country) return null
  const cacheKey = `${race.id}-${race.date}`
  if (cacheKey in _raceWeatherCache) return _raceWeatherCache[cacheKey]

  // Check localStorage cache
  const lsKey = `fl2_rwc_${race.id}`
  const cached = localStorage.getItem(lsKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      _raceWeatherCache[cacheKey] = parsed
      return parsed
    } catch { /* ignore */ }
  }

  try {
    const city = race.city ?? race.country ?? ''
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
    const geoData = await geoRes.json()
    const loc = geoData?.results?.[0]
    if (!loc) { _raceWeatherCache[cacheKey] = null; return null }

    const { latitude, longitude } = loc
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${race.date}&end_date=${race.date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&hourly=relativehumidity_2m&timezone=auto`)
    const data = await res.json()

    const maxArr: number[] = data?.daily?.temperature_2m_max ?? []
    const minArr: number[] = data?.daily?.temperature_2m_min ?? []
    const humArr: number[] = data?.hourly?.relativehumidity_2m ?? []

    if (!maxArr.length || !minArr.length) { _raceWeatherCache[cacheKey] = null; return null }

    const temp = Math.round((maxArr[0] + minArr[0]) / 2)
    const humSlice = humArr.slice(6, 12)
    const humidity = humSlice.length
      ? Math.round(humSlice.reduce((s, v) => s + v, 0) / humSlice.length)
      : 60

    const result = { temp, humidity }
    _raceWeatherCache[cacheKey] = result
    localStorage.setItem(lsKey, JSON.stringify(result))
    return result
  } catch {
    _raceWeatherCache[cacheKey] = null
    return null
  }
}

function WeatherImpactWidget() {
  const races  = useRaceStore(selectRaces)
  const [fetchedWeather, setFetchedWeather] = useState<Record<string, { temp: number; humidity: number }>>({})

  // Auto-fetch archive weather for past races without weather data
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const needFetch = races
      .filter(r => r.date <= today && r.time && !r.weather?.temp && (r.city || r.country))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)

    for (const r of needFetch) {
      fetchArchiveWeather(r).then(w => {
        if (w) setFetchedWeather(prev => ({ ...prev, [r.id]: w }))
      })
    }
  }, [races])

  const racesWithWeather = useMemo(() =>
    races.map(r => fetchedWeather[r.id]
      ? { ...r, weather: { ...r.weather, temp: fetchedWeather[r.id].temp, humidity: fetchedWeather[r.id].humidity } }
      : r
    ), [races, fetchedWeather])

  const result = useMemo(() => bestWeatherImpact(racesWithWeather), [racesWithWeather])

  if (!result) return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🌡 WEATHER IMPACT</div>
      <div style={st.widgetTitle}>WEATHER IMPACT</div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Races with weather data will show adjusted performance.</p>
    </div>
  )

  const { race, impact } = result
  const impactColor = impact.improvementSecs > 300 ? '#ff6b6b'
    : impact.improvementSecs > 120 ? 'var(--orange)'
    : 'var(--green)'

  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🌡 WEATHER IMPACT</div>
      <div style={st.widgetTitle}>WEATHER IMPACT</div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-4px' }}>{race.name} · {race.date}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ background: 'var(--surface3)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border2)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>ACTUAL</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '20px', color: 'var(--white)' }}>{fSecsToHMS(impact.actualSecs)}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{impact.tempC}°C · {impact.humidityPct}% humidity</div>
        </div>
        <div style={{ background: 'var(--surface3)', borderRadius: '8px', padding: '12px', border: `1px solid ${impactColor}44` }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, color: impactColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>IDEAL CONDITIONS</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '20px', color: impactColor }}>{fSecsToHMS(impact.adjustedSecs)}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>10°C · 50% humidity</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--surface3)', borderRadius: '6px', border: `1px solid ${impactColor}33` }}>
        <span style={{ fontSize: '20px' }}>
          {impact.improvementSecs > 300 ? '🥵' : impact.improvementSecs > 120 ? '😓' : '😊'}
        </span>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--white)', fontWeight: 500 }}>{impact.label}</div>
          {impact.improvementSecs > 10 && (
            <div style={{ fontSize: '11px', color: impactColor }}>
              +{fSecsToHMS(impact.improvementSecs)} due to heat/humidity ({impact.impactPct}%)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DistanceMilestonesWidget() {
  const races  = useRaceStore(selectRaces)
  const result = useMemo(() => distanceMilestones(races), [races])

  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🏅 MILESTONES</div>
      <div style={st.widgetTitle}>DISTANCE TOTAL</div>

      {/* Hero number */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '48px', lineHeight: 1, color: 'var(--orange)' }}>
          {result.totalKm.toLocaleString()}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--muted)', paddingBottom: '6px', fontFamily: 'var(--headline)', fontWeight: 700 }}>KM TOTAL</span>
      </div>

      {/* Progress bar to next milestone */}
      {result.nextMilestone && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {result.lastMilestone ? result.lastMilestone.label : '0 KM'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 700 }}>
              {result.nextMilestone.label}
            </span>
          </div>
          <div style={{ height: '6px', background: 'var(--surface3)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${result.progressPct}%`, background: 'var(--orange)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            {result.kmToNext.toLocaleString()} km to {result.nextMilestone.label}
          </div>
        </div>
      )}

      {/* Fun fact */}
      <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '8px 10px', background: 'var(--surface3)', borderRadius: '6px', borderLeft: '2px solid var(--orange)' }}>
        {result.funFact}
      </div>
    </div>
  )
}

// ─── Equivalent Performances Widget ──────────────────────────────────────────

function EquivPerfWidget() {
  const races   = useRaceStore(selectRaces)
  const vdotPt  = useMemo(() => bestVDOT(races), [races])
  const equivs  = useMemo(() => vdotPt ? equivalentPerformances(vdotPt.vdot) : [], [vdotPt])

  if (!vdotPt) return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🎯 EQUIVALENTS</div>
      <div style={st.widgetTitle}>EQUIV PERFORMANCES</div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Log a race to see equivalent performances across distances.</p>
    </div>
  )

  const mainDistances = equivs.filter(e => ['5K','10K','Half Marathon','Marathon'].includes(e.distance))

  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🎯 EQUIVALENTS</div>
      <div style={st.widgetTitle}>EQUIV PERFORMANCES</div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-4px' }}>VDOT {vdotPt.vdot} · {vdotPt.raceName}</div>

      {/* One-liner pill row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {mainDistances.map((e, i) => (
          <React.Fragment key={e.distance}>
            {i > 0 && <span style={{ color: 'var(--muted2)', fontSize: '12px' }}>≈</span>}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', minWidth: '56px' }}>
              <span style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {e.distance.replace('Half Marathon','HM').replace('Marathon','MAR')}
              </span>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', color: 'var(--white)', marginTop: '2px' }}>
                {e.timeStr}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Extended distances */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        {equivs.filter(e => !['5K','10K','Half Marathon','Marathon'].includes(e.distance)).map(e => (
          <div key={e.distance} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'var(--surface3)', borderRadius: '5px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{e.distance}</span>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '12px', color: 'var(--white)' }}>{e.timeStr}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Upcoming Race Density Widget ─────────────────────────────────────────────

function UpcomingDensityWidget() {
  const upcoming = useRaceStore(selectUpcomingRaces)
  const warnings = useMemo(() => raceDensityWarnings(upcoming), [upcoming])

  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>📆 SCHEDULING</div>
      <div style={st.widgetTitle}>RACE CONFLICTS</div>

      {upcoming.length < 2 ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Add 2+ upcoming races to check for scheduling conflicts.</p>
      ) : warnings.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(0,255,136,0.06)', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.2)' }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', color: 'var(--green)' }}>ALL CLEAR</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>No scheduling conflicts in {upcoming.length} upcoming races.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {warnings.map((w, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: '8px',
              background: w.severity === 'danger' ? 'rgba(255,60,60,0.08)' : 'rgba(var(--orange-ch),0.08)',
              border: `1px solid ${w.severity === 'danger' ? 'rgba(255,60,60,0.3)' : 'rgba(var(--orange-ch),0.3)'}`,
            }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px', color: w.severity === 'danger' ? '#ff6b6b' : 'var(--orange)', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {w.severity === 'danger' ? '🚨 DANGER' : '⚠ WARNING'} · {w.windowDays}d gap
              </div>
              <div style={{ fontSize: '12px', color: 'var(--white)', lineHeight: 1.4 }}>{w.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Course Repeats Widget ────────────────────────────────────────────────────

function CourseRepeatsWidget() {
  const races = useRaceStore(selectRaces)

  const courses = useMemo(() => {
    const map = findCourseRepeats(races)
    return Array.from(map.entries())
      .filter(([, rs]) => rs.length >= 3)
      .map(([name, rs]) => {
        const sorted = [...rs].sort((a, b) => a.date.localeCompare(b.date))
        const timed  = rs.filter(r => r.time)
        const pb     = timed.length
          ? timed.reduce((best, r) => {
              const secs = (t: string) => t.split(':').reduce((s, v, i, arr) => s + Number(v) * Math.pow(60, arr.length - 1 - i), 0)
              return secs(r.time!) < secs(best.time!) ? r : best
            })
          : null
        const last2 = timed.slice(-2)
        let trend: 'improving' | 'declining' | 'flat' = 'flat'
        if (last2.length === 2) {
          const secs = (t: string) => t.split(':').reduce((s, v, i, arr) => s + Number(v) * Math.pow(60, arr.length - 1 - i), 0)
          const t0 = secs(last2[0].time!), t1 = secs(last2[1].time!)
          trend = t1 < t0 ? 'improving' : t1 > t0 ? 'declining' : 'flat'
        }
        return { name, count: rs.length, first: sorted[0].date, pb, trend }
      })
      .sort((a, b) => b.count - a.count)
  }, [races])

  if (!courses.length) return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🔄 REPEATS</div>
      <div style={st.widgetTitle}>COURSE REPEATS</div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Run the same race 3+ times to see your course repeat history.</p>
    </div>
  )

  return (
    <div className="card-v3" style={st.glowCard}>
      <div style={st.widgetLabel}>🔄 REPEATS</div>
      <div style={st.widgetTitle}>COURSE REPEATS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {courses.slice(0, 4).map(c => (
          <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', color: 'var(--white)' }}>{c.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{c.count}× · since {c.first}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {c.pb?.time && (
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: 'var(--orange)' }}>{c.pb.time}</div>
              )}
              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                {c.trend === 'improving' && <span style={{ color: 'var(--green)' }}>▲ FASTER</span>}
                {c.trend === 'declining' && <span style={{ color: '#ff6b6b' }}>▼ SLOWER</span>}
                {c.trend === 'flat'      && <span style={{ color: 'var(--muted)' }}>— FLAT</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Customize Modal ──────────────────────────────────────────────────────────

const ZONE_META: Record<string, { tag: string; label: string }> = {
  now:      { tag: 'NOW',          label: 'RACE CONTEXT'   },
  recently: { tag: 'RECENTLY',     label: 'YOUR RACING'    },
  trending: { tag: 'CONSISTENCY',  label: 'BUILD'          },
  context:  { tag: 'PATTERNS',     label: 'ANALYSIS'       },
}

const ZONE_ORDER = ['now', 'recently', 'trending', 'context'] as const

function DashCustomizeModal({ onClose }: { onClose: () => void }) {
  const storeWidgets     = useDashStore(s => s.widgets)
  const getDashLayout    = useDashStore(s => s.getDashLayout)
  const setWidgetEnabled = useDashStore(s => s.setWidgetEnabled)
  const reorderWidget    = useDashStore(s => s.reorderWidget)
  const widgets          = useMemo(() => getDashLayout(), [storeWidgets, getDashLayout])

  const byZone = useMemo(() =>
    ZONE_ORDER.reduce((acc, z) => {
      acc[z] = widgets.filter(w => w.zone === z)
      return acc
    }, {} as Record<string, typeof widgets>),
    [widgets],
  )

  return (
    <div style={st.modalOverlay} onClick={onClose}>
      <div style={st.customizeSheet} onClick={e => e.stopPropagation()}>
        {/* Handle pill */}
        <div style={{ width: '40px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '0 auto 20px' }} />

        {/* Header */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
            CUSTOMIZE DASHBOARD
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
            Turn widgets on or off, reorder them within a section.
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--muted2)', lineHeight: 1.5, padding: '10px 12px', background: 'var(--surface3)', borderRadius: '8px', marginBottom: '4px' }}>
          Use ▲ and ▼ on a widget to reorder it within its section.
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
          {ZONE_ORDER.map(zoneId => {
            const meta = ZONE_META[zoneId]
            const zWidgets = byZone[zoneId] ?? []
            return (
              <div key={zoneId} style={{ marginTop: '16px' }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 8px', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--headline)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--orange)', textTransform: 'uppercase' }}>
                      SECTION
                    </div>
                    <div style={{ fontFamily: 'var(--headline)', fontSize: '15px', fontWeight: 900, letterSpacing: '0.06em', color: 'var(--white)', textTransform: 'uppercase' }}>
                      {meta.tag} — {meta.label}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={st.arrowBtn}>▲</div>
                    <div style={st.arrowBtn}>▼</div>
                  </div>
                </div>

                {/* Widget rows */}
                {zWidgets.map((w, idx) => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
                    {/* Icon box */}
                    <div style={{ width: '38px', height: '38px', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {w.icon}
                    </div>
                    {/* Label + PRO badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontFamily: 'var(--body)', fontWeight: 500 }}>{w.label}</span>
                        {w.pro && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.5)', borderRadius: '100px', padding: '2px 6px', flexShrink: 0 }}>
                            PRO
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Reorder buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                      <button
                        style={{ ...st.arrowBtn, opacity: idx === 0 ? 0.25 : 1, cursor: idx === 0 ? 'default' : 'pointer' }}
                        onClick={() => idx > 0 && reorderWidget(w.id, 'up')}
                        disabled={idx === 0}
                      >▲</button>
                      <button
                        style={{ ...st.arrowBtn, opacity: idx === zWidgets.length - 1 ? 0.25 : 1, cursor: idx === zWidgets.length - 1 ? 'default' : 'pointer' }}
                        onClick={() => idx < zWidgets.length - 1 && reorderWidget(w.id, 'down')}
                        disabled={idx === zWidgets.length - 1}
                      >▼</button>
                    </div>
                    {/* Toggle */}
                    <ToggleSwitch checked={w.enabled} onChange={v => setWidgetEnabled(w.id, v)} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* DONE button — sticky at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px 28px', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
          <button style={st.doneBtn} onClick={onClose}>DONE</button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function isEnabled(widgets: ReturnType<typeof useDashStore.getState>['widgets'], id: string) {
  return widgets.find(w => w.id === id)?.enabled !== false
}

export function Dashboard() {
  const [showCustomize,     setShowCustomize]     = useState(false)
  const [showAddRace,       setShowAddRace]       = useState(false)
  const [addRaceMode,       setAddRaceMode]       = useState<'past' | 'upcoming'>('past')
  const [showAllUpcoming,   setShowAllUpcoming]   = useState(false)
  const nextRace      = useRaceStore(selectNextRace)   // always nearest upcoming
  const upcomingRaces = useRaceStore(selectUpcomingRaces)
  const [countdownRaceId, setCountdownRaceId] = useState<string | null>(null)
  const countdownRace = useMemo(() => {
    if (countdownRaceId) {
      return upcomingRaces.find(r => r.id === countdownRaceId) ?? nextRace
    }
    return nextRace
  }, [countdownRaceId, upcomingRaces, nextRace])
  const storeWidgets  = useDashStore(s => s.widgets)
  const getDashLayout = useDashStore(s => s.getDashLayout)
  const widgets       = useMemo(() => getDashLayout(), [storeWidgets, getDashLayout])

  const [riegelPrefillDist, setRiegelPrefillDist] = useState<string | undefined>()
  const openAddRace          = () => { setAddRaceMode('past');     setRiegelPrefillDist(undefined); setShowAddRace(true) }
  const openAddUpcomingRace  = () => { setAddRaceMode('upcoming'); setRiegelPrefillDist(undefined); setShowAddRace(true) }
  const openRiegelGoal = (dist: string) => { setAddRaceMode('upcoming'); setRiegelPrefillDist(dist); setShowAddRace(true) }
  const en = (id: string) => isEnabled(widgets, id)

  return (
    <div style={st.page}>
      {showCustomize    && <DashCustomizeModal onClose={() => setShowCustomize(false)} />}
      {showAddRace      && <AddRaceModal defaultMode={addRaceMode} prefillDistance={riegelPrefillDist} onClose={() => { setShowAddRace(false); setRiegelPrefillDist(undefined) }} />}
      {showAllUpcoming  && <AllUpcomingModal onClose={() => setShowAllUpcoming(false)} onAddRace={openAddUpcomingRace} />}

      <GreetingCard onCustomize={() => setShowCustomize(true)} />
      <PreRaceBriefing onAddRace={openAddRace} />

      {/* NOW — RACE DAY */}
      <DashZone id="now" tag="NOW" label="RACE DAY">
        {(countdownRace ?? nextRace)
          ? <>{en('countdown')       && countdownRace && <CountdownCard race={countdownRace} onShowAll={() => setShowAllUpcoming(true)} upcomingRaces={upcomingRaces} onSelectRace={setCountdownRaceId} />}
              {en('race-forecast')   && countdownRace && <WeatherCard race={countdownRace} />}
              <CourseInfoCard race={countdownRace ?? nextRace!} /></>
          : <NoUpcomingRaceCTA onAddRace={openAddUpcomingRace} />
        }
        {en('goal-pace')      && <GoalPaceWidget />}
        {en('on-this-day')    && <OnThisDayWidget />}
        {en('race-readiness') && <RaceReadinessWidget />}
        {en('gap-to-goal')    && <GapToGoalWidget />}
        {en('course-fit')     && <CourseFitWidget />}
        {en('pb-probability') && <PBProbabilityWidget />}
        {en('weather-fit')    && <WeatherFitWidget />}
        {en('race-stack')     && <RaceStackWidget />}
      </DashZone>

      {/* RECENTLY — YOUR SEASON */}
      <DashZone id="recently" tag="RECENTLY" label="YOUR SEASON">
        <StatsStrip />
        {en('recent-races')       && <RecentRaces onAddRace={openAddRace} />}
        {en('activity-preview')   && <ActivityPreviewWidget />}
        {en('personal-bests')     && <PersonalBestsWidget />}
        {en('riegel-predictor')   && <RiegelPredictorWidget onAddGoal={openRiegelGoal} />}
        {en('weather-impact')     && <WeatherImpactWidget />}
        {en('why-prd')        && <WhyPRdWidget />}
        {en('why-faded')      && <WhyFadedWidget />}
        {en('break-tape')     && <BreakTapeWidget />}
        {en('story-mode')     && <StoryModeWidget />}
      </DashZone>

      {/* CONSISTENCY — BUILD */}
      <DashZone id="trending" tag="CONSISTENCY" label="BUILD">
        {en('season-planner')    && <SeasonPlannerWidget onAddRace={openAddUpcomingRace} />}
        {en('recovery-intel')    && <RecoveryIntelWidget />}
        {en('race-density')      && <RaceDensityWidget />}
        {en('upcoming-density')  && <UpcomingDensityWidget />}
        {en('streak-risk')       && <StreakRiskWidget />}
        {en('training-correl')   && <TrainingCorrelWidget />}
        {en('race-gap-analysis') && <RaceGapAnalysisWidget />}
        {en('adaptive-goals')    && <AdaptiveGoalsWidget />}
      </DashZone>

      {/* PATTERNS — ANALYSIS */}
      <DashZone id="context" tag="PATTERNS" label="ANALYSIS">
        {en('vdot-score')          && <VDOTScoreWidget />}
        {en('equiv-perf')          && <EquivPerfWidget />}
        {en('distance-milestones') && <DistanceMilestonesWidget />}
        {en('course-repeats')      && <CourseRepeatsWidget />}
        {en('boston-qual')       && <BostonQualWidget />}
        {en('pacing-iq')         && <PacingIQWidget />}
        {en('career-momentum')   && <CareerMomentumWidget />}
        {en('age-grade')         && <AgeGradeWidget />}
        {en('race-dna')          && <RaceDNAWidget />}
        {en('surface-profile')   && <SurfaceProfileWidget />}
        {en('pressure-performer') && <PressurePerformerWidget />}
        {en('travel-load')       && <TravelLoadWidget />}
        {en('best-conditions')   && <BestConditionsWidget />}
        {en('pattern-scan')      && <PatternScanWidget />}
        {en('why-result')        && <WhyResultWidget />}
        {en('advanced-race-dna') && <AdvancedRaceDNAWidget />}
        {en('race-comparer')     && <RaceComparerWidget />}
        {en('what-to-race-next') && <WhatToRaceNextWidget />}
        {en('coach-activity')    && <CoachActivityWidget />}
      </DashZone>

      <PaceCalculator />
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  page: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
    padding: '16px',
    paddingBottom: '96px',
    fontFamily: 'var(--body)',
    color: 'var(--white)',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Greeting
  greetingCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    minWidth: 0,
  } as React.CSSProperties,

  greetingContent: { flex: 1, minWidth: 0 } as React.CSSProperties,

  greetingLine: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'baseline',
    lineHeight: 1.1,
  } as React.CSSProperties,

  greetingText: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '22px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
  } as React.CSSProperties,

  greetingName: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '22px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--orange)',
  } as React.CSSProperties,

  greetingSubtext: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    marginTop: '6px',
    lineHeight: 1.4,
  } as React.CSSProperties,

  gridBtn: {
    width: '44px',
    height: '44px',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '50%',
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,

  // ── Pre-race briefing
  briefingCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '20px',
    minWidth: 0,
  } as React.CSSProperties,

  briefingInner: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  briefingTag: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--orange)',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  briefingTitle: {
    fontFamily: 'var(--headline)',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    lineHeight: 1.1,
    color: 'var(--white)',
  } as React.CSSProperties,

  briefingMeta: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
  } as React.CSSProperties,

  lastRacePill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'rgba(var(--green-ch), 0.12)',
    border: '1px solid rgba(var(--green-ch), 0.25)',
    color: 'var(--green)',
    borderRadius: '100px',
    padding: '5px 12px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    width: 'fit-content',
  } as React.CSSProperties,

  // ── Countdown card
  countdownCard: {
    background: 'radial-gradient(ellipse at 20% 80%, rgba(var(--orange-ch), 0.15) 0%, transparent 65%), var(--surface)',
    border: '1px solid var(--border)',
    borderTop: '1px solid rgba(var(--orange-ch), 0.35)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    minWidth: 0,
  } as React.CSSProperties,

  countdownHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  countdownHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  } as React.CSSProperties,

  countdownDash: {
    color: 'var(--muted)',
    fontWeight: 700,
    fontSize: '14px',
  } as React.CSSProperties,

  aBadge: {
    background: 'var(--orange)',
    color: '#000',
    borderRadius: '4px',
    padding: '2px 8px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '13px',
    letterSpacing: '0.04em',
    lineHeight: 1.4,
  } as React.CSSProperties,

  aRaceLabel: {
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '5px 10px',
    cursor: 'pointer',
  } as React.CSSProperties,

  countdownRaceName: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '28px',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  countdownLocation: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '2px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--body)',
  } as React.CSSProperties,

  countdownRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '2px',
    marginTop: '4px',
    minWidth: 0,
  } as React.CSSProperties,

  countdownUnit: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    minWidth: 0,
  } as React.CSSProperties,

  countdownNum: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '56px',
    color: 'var(--white)',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,

  countdownUnitLabel: {
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '9px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    marginTop: '4px',
  } as React.CSSProperties,

  countdownSep: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '36px',
    color: 'rgba(var(--orange-ch), 0.5)',
    lineHeight: 1,
    paddingTop: '8px',
    flexShrink: 0,
  } as React.CSSProperties,

  countdownDivider: {
    height: '1px',
    background: 'var(--border)',
    margin: '2px 0',
  } as React.CSSProperties,

  allRacesBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    textAlign: 'left' as const,
    padding: 0,
    display: 'block',
  } as React.CSSProperties,

  // ── Course info
  infoCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    minWidth: 0,
  } as React.CSSProperties,

  terrainTag: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '100px',
    padding: '4px 12px',
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
  } as React.CSSProperties,

  infoText: {
    margin: 0,
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    lineHeight: 1.55,
  } as React.CSSProperties,

  // ── Weather
  weatherCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px',
    minWidth: 0,
  } as React.CSSProperties,

  daysPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--orange)',
    color: '#000',
    borderRadius: '100px',
    padding: '6px 14px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '12px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  // ── Section card
  sectionCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    minWidth: 0,
  } as React.CSSProperties,

  sectionHeader: {
    fontFamily: 'var(--headline)',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  raceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
    minWidth: 0,
  } as React.CSSProperties,

  raceRowPB: {
    borderLeft: '3px solid var(--green)',
    paddingLeft: '10px',
    marginLeft: '-10px',
  } as React.CSSProperties,

  raceDate: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: 'var(--muted)',
    whiteSpace: 'nowrap' as const,
    textTransform: 'uppercase' as const,
    width: '52px',
    flexShrink: 0,
  } as React.CSSProperties,

  raceTime: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--white)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  pbTag: {
    background: 'rgba(var(--green-ch), 0.15)',
    color: 'var(--green)',
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '20px 0',
  } as React.CSSProperties,

  // ── Stats strip
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px 12px',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Zone
  zone: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden',
    minWidth: 0,
  } as React.CSSProperties,

  zoneBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
  } as React.CSSProperties,

  zoneTag: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--orange)',
  } as React.CSSProperties,

  zoneLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '17px',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  zoneChevron: {
    fontSize: '14px',
    color: 'var(--muted)',
    transition: 'transform 0.2s ease',
    display: 'inline-block',
    flexShrink: 0,
  } as React.CSSProperties,

  zoneContent: {
    padding: '0 12px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Widget shell (placeholder)
  widgetShell: {
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    minWidth: 0,
  } as React.CSSProperties,

  widgetShellLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  // ── Glow card (analytics widgets) — visuals provided by .card-v3 class
  glowCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    minWidth: 0,
  } as React.CSSProperties,

  widgetLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--orange)',
    marginBottom: '2px',
  } as React.CSSProperties,

  widgetTitle: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '20px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  badgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '100px',
    padding: '4px 12px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  iconBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    background: 'rgba(var(--orange-ch), 0.1)',
    border: '1px solid rgba(var(--orange-ch), 0.2)',
    borderRadius: '10px',
    fontSize: '20px',
    flexShrink: 0,
  } as React.CSSProperties,

  lockedBox: {
    background: 'var(--surface3)',
    border: '1px dashed var(--border2)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  } as React.CSSProperties,

  lockedTitle: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
  } as React.CSSProperties,

  lockedText: {
    fontSize: '13px',
    color: 'var(--muted)',
    lineHeight: 1.55,
  } as React.CSSProperties,

  widgetDivider: {
    height: '1px',
    background: 'var(--border)',
    margin: '0',
  } as React.CSSProperties,

  ghostOutlineBtn: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    color: 'var(--white)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '9px 16px',
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  } as React.CSSProperties,

  ghostLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--orange)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    padding: 0,
    display: 'inline',
  } as React.CSSProperties,

  // ── Pace calc
  inputLabel: {
    display: 'block',
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    marginBottom: '4px',
  } as React.CSSProperties,

  select: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    padding: '0.55rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    padding: '0.55rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  paceResult: {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  } as React.CSSProperties,

  // ── CTAs
  ctaPrimary: {
    marginTop: '4px',
    background: 'var(--orange)',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  } as React.CSSProperties,

  ctaOutline: {
    marginTop: '4px',
    background: 'transparent',
    color: 'var(--orange)',
    border: '1px solid rgba(var(--orange-ch), 0.5)',
    borderRadius: '8px',
    padding: '10px 18px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  } as React.CSSProperties,

  // ── Customize modal
  modalOverlay: {
    position: 'fixed' as const,
    top: 'calc(var(--header-base-height) + var(--safe-top))',
    left: 0,
    right: 0,
    bottom: 'calc(var(--bottom-nav-base-height) + var(--safe-bottom))',
    background: 'rgba(0,0,0,0.75)',
    zIndex: 900,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  customizeSheet: {
    width: '100%',
    maxHeight: '100%',
    background: 'var(--surface2)',
    borderTop: '1px solid var(--border2)',
    borderRadius: '20px 20px 0 0',
    padding: '16px 20px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
    position: 'relative' as const,
    overflowY: 'auto' as const,
  } as React.CSSProperties,

  arrowBtn: {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '5px',
    color: 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '10px',
    padding: '3px 6px',
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  doneBtn: {
    width: '100%',
    background: 'var(--orange)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '15px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,
} as const
