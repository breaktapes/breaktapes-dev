import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { parseDistKm } from '@/lib/raceFormulas'
import { rankBestMatch } from '@/lib/importRank'
import { fmtDateDDMM, resolveDistKm } from '@/lib/utils'
import { posthog } from '@/lib/posthog'
import { supabaseAnon } from '@/lib/supabase'
import type { Race } from '@/types'

const HEALTH_PROXY = 'https://health.breaktapes.com'

type Step = 'search' | 'results'

interface ImportSplit { label: string; split?: string }

interface ImportResult {
  raceName: string
  date: string
  time?: string
  source: 'ultrasignup' | 'marathonview' | 'athlinks' | 'runsignup' | 'coachcox' | 'hopasports' | 'sporthive' | 't100'
  distance_m?: number
  city?: string
  /** UltraSignup region: a US 2-letter state OR a 3-letter country code. */
  state?: string
  country?: string
  raw?: string[]
  // Rich fields from tri sources (Coach Cox / IRONMAN). Optional everywhere.
  sport?: string
  splits?: ImportSplit[]
  agLabel?: string
  placing?: string
  genderPlacing?: string
  agPlacing?: string
  outcome?: string
}

// Resolve a display country from what the scrapers actually return: MarathonView
// /Athlinks give a `country` (name or code); UltraSignup gives a `state` that is
// either a US 2-letter state or a 3-letter country code. Without this the
// imported races have no country and the city was hardcoded empty.
const _ISO3_COUNTRY: Record<string, string> = {
  USA: 'United States', GBR: 'United Kingdom', FRA: 'France', ESP: 'Spain',
  ITA: 'Italy', DEU: 'Germany', GER: 'Germany', CAN: 'Canada', AUS: 'Australia',
  NZL: 'New Zealand', JPN: 'Japan', CHN: 'China', ZAF: 'South Africa',
  RSA: 'South Africa', KEN: 'Kenya', ETH: 'Ethiopia', NLD: 'Netherlands',
  NED: 'Netherlands', BEL: 'Belgium', CHE: 'Switzerland', AUT: 'Austria',
  SWE: 'Sweden', NOR: 'Norway', DNK: 'Denmark', DEN: 'Denmark', FIN: 'Finland',
  PRT: 'Portugal', POR: 'Portugal', GRC: 'Greece', GRE: 'Greece', BRA: 'Brazil',
  MEX: 'Mexico', ARG: 'Argentina', CHL: 'Chile', CHI: 'Chile', IND: 'India',
  ARE: 'United Arab Emirates', UAE: 'United Arab Emirates', OMN: 'Oman',
  BHR: 'Bahrain', QAT: 'Qatar', SAU: 'Saudi Arabia', KSA: 'Saudi Arabia',
  MAR: 'Morocco', EGY: 'Egypt', SGP: 'Singapore', THA: 'Thailand',
  MYS: 'Malaysia', IDN: 'Indonesia', POL: 'Poland', CZE: 'Czechia',
  HUN: 'Hungary', IRL: 'Ireland', ISL: 'Iceland', TUR: 'Turkey', HRV: 'Croatia',
  SVN: 'Slovenia', LUX: 'Luxembourg', AND: 'Andorra',
}
const _US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])

function deriveImportCountry(country?: string, state?: string): string {
  const c = (country ?? '').trim()
  if (c) return _ISO3_COUNTRY[c.toUpperCase()] ?? c
  const s = (state ?? '').trim().toUpperCase()
  if (!s) return ''
  if (s.length === 2 && _US_STATES.has(s)) return 'United States'
  return _ISO3_COUNTRY[s] ?? s
}

// Scrapers return "0" / "0:00:00" as the finish time for races with no result
// (e.g. an upcoming registration). Treat those as no-time so we neither display
// "0" nor save a bogus 0:00 finish time onto the imported race.
function normalizeImportTime(t: string | undefined): string | undefined {
  if (!t) return undefined
  const trimmed = t.trim()
  if (!trimmed || /^0(:00)*$/.test(trimmed)) return undefined
  return trimmed
}

function kmToDistLabel(km: number): string {
  if (km <= 0) return ''
  if (Math.abs(km - 42.195) < 0.1) return 'Marathon'
  if (Math.abs(km - 21.0975) < 0.1) return 'Half Marathon'
  if (Math.abs(km - 226) < 1) return 'IRONMAN'
  if (Math.abs(km - 113) < 1) return '70.3 / Middle Distance'
  if (Math.abs(km - 51.5) < 1) return 'Olympic Tri'
  if (Math.abs(km - 5) < 0.1) return '5K'
  if (Math.abs(km - 10) < 0.1) return '10K'
  if (Math.abs(km - 15) < 0.1) return '15K'
  if (Math.abs(km - 50) < 1) return '50K'
  if (Math.abs(km - 100) < 1) return '100K'
  if (Math.abs(km - 80.47) < 1) return '50 Mile'
  if (Math.abs(km - 160.93) < 1) return '100 Mile'
  return `${km}KM`
}

function normalizeDateStr(d: string): string {
  // Convert MM/DD/YYYY → YYYY-MM-DD; leave YYYY-MM-DD as-is
  const mmddyyyy = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2,'0')}-${mmddyyyy[2].padStart(2,'0')}`
  return d
}

export function RaceImportModal({ onClose, onPickByRace, onAddManual }: { onClose: () => void; onPickByRace?: () => void; onAddManual?: () => void }) {
  const addRace    = useRaceStore(s => s.addRace)
  const existingRaces = useRaceStore(s => s.races)
  const upcomingRaces = useRaceStore(s => s.upcomingRaces)
  const athlete       = useAthleteStore(s => s.athlete)

  // Derive a birth year + gender from the signed-in athlete's DOB to soft-filter
  // namesake rows out of name-based import results (drop on conflict, keep on null).
  const birthYear = athlete?.dob ? Number(String(athlete.dob).slice(0, 4)) || undefined : undefined
  const gender    = athlete?.gender || undefined

  const [step, setStep]               = useState<Step>('search')
  const [firstName, setFirstName]     = useState('')
  const [lastName, setLastName]       = useState('')
  const [athlinksUrl, setAthlinksUrl] = useState('')
  const [searching, setSearching]     = useState(false)
  const [results, setResults]         = useState<ImportResult[]>([])
  const [selected, setSelected]       = useState<Set<number>>(new Set())
  const [importing, setImporting]     = useState(false)
  const [error, setError]             = useState('')
  const [skippedCount, setSkippedCount] = useState(0)
  const [sourceErrors, setSourceErrors] = useState<{ ultrasignup?: boolean; marathonview?: boolean; athlinks?: boolean; runsignup?: boolean; coachcox?: boolean; sporthive?: boolean }>({})

  // Hopasports (UAE/MENA) is event-scoped, so it gets its own search: find the
  // event, then we scan it for the name already entered above.
  const [hopaQuery, setHopaQuery]       = useState('')
  const [hopaEvents, setHopaEvents]     = useState<{ slug: string; name: string }[]>([])
  const [hopaSearching, setHopaSearching] = useState(false)
  const [hopaFetching, setHopaFetching] = useState('')   // slug currently being imported


  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSearch() {
    if (!firstName.trim() && !lastName.trim()) { setError('Enter at least a first or last name'); return }
    setSearching(true); setError(''); setResults([]); setSourceErrors({})

    const settle = <T,>(p: Promise<T>): Promise<PromiseSettledResult<T>> =>
      Promise.allSettled([p]).then(([r]) => r)

    const [us, mv, al, rs, cc, sp] = await Promise.all([
      settle(fetch(`${HEALTH_PROXY}/import/ultrasignup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      }).then(r => r.json())),
      settle(fetch(`${HEALTH_PROXY}/import/marathonview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${firstName.trim()} ${lastName.trim()}`.trim(), birthYear, gender }),
      }).then(r => r.json())),
      athlinksUrl.trim()
        ? settle(fetch(`${HEALTH_PROXY}/import/athlinks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileUrl: athlinksUrl.trim() }),
          }).then(r => r.json()))
        : Promise.resolve({ status: 'fulfilled', value: { status: 'skipped', results: [] } } as PromiseSettledResult<{ status: string; results?: ImportResult[] }>),
      settle(fetch(`${HEALTH_PROXY}/import/runsignup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      }).then(r => r.json())),
      settle(fetch(`${HEALTH_PROXY}/import/coachcox`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      }).then(r => r.json())),
      settle(fetch(`${HEALTH_PROXY}/import/sporthive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      }).then(r => r.json())),
    ])

    const all: ImportResult[] = []
    const errs: { ultrasignup?: boolean; marathonview?: boolean; athlinks?: boolean; runsignup?: boolean; coachcox?: boolean; sporthive?: boolean } = {}

    if (us.status === 'fulfilled' && us.value.status === 'ok') {
      for (const r of (us.value.results ?? [])) {
        if (!r.raceName || r.raceName.length < 3) continue
        all.push({ raceName: r.raceName, date: r.date ?? '', time: normalizeImportTime(r.time), city: r.city || undefined, state: r.state || undefined, source: 'ultrasignup' })
      }
    } else if (us.status === 'rejected' || (us.status === 'fulfilled' && us.value?.status === 'error')) {
      errs.ultrasignup = true
    }

    if (mv.status === 'fulfilled' && mv.value.status === 'ok') {
      for (const r of (mv.value.results ?? [])) {
        if (!r.raceName || r.raceName.length < 3) continue
        all.push({ ...r, date: normalizeDateStr(r.date ?? ''), source: 'marathonview' })
      }
    } else if (mv.status === 'rejected' || (mv.status === 'fulfilled' && mv.value?.status === 'error')) {
      errs.marathonview = true
    }

    if (al.status === 'fulfilled' && al.value.status === 'ok') {
      for (const r of (al.value.results ?? [])) {
        if (!r.raceName || r.raceName.length < 3) continue
        all.push({ ...r, date: normalizeDateStr(r.date ?? ''), source: 'athlinks' })
      }
    } else if (al.status === 'rejected' || (al.status === 'fulfilled' && al.value?.status === 'error')) {
      if (athlinksUrl.trim()) errs.athlinks = true
    }

    if (rs.status === 'fulfilled' && rs.value.status === 'ok') {
      for (const r of (rs.value.results ?? [])) {
        if (!r.raceName || r.raceName.length < 3) continue
        all.push({ ...r, date: normalizeDateStr(r.date ?? ''), source: 'runsignup' })
      }
    } else if (rs.status === 'rejected' || (rs.status === 'fulfilled' && rs.value?.status === 'error')) {
      errs.runsignup = true
    }

    if (cc.status === 'fulfilled' && cc.value.status === 'ok') {
      for (const r of (cc.value.results ?? [])) {
        if (!r.raceName || r.raceName.length < 3) continue
        all.push({ ...r, date: normalizeDateStr(r.date ?? ''), source: 'coachcox' })
      }
    } else if (cc.status === 'rejected' || (cc.status === 'fulfilled' && cc.value?.status === 'error')) {
      errs.coachcox = true
    }

    if (sp.status === 'fulfilled' && sp.value.status === 'ok') {
      for (const r of (sp.value.results ?? [])) {
        if (!r.raceName || r.raceName.length < 3) continue
        all.push({ ...r, date: normalizeDateStr(r.date ?? ''), source: 'sporthive' })
      }
    } else if (sp.status === 'rejected' || (sp.status === 'fulfilled' && sp.value?.status === 'error')) {
      errs.sporthive = true
    }

    // T100 (sportstats) — bot-protected source harvested into our own Supabase
    // table, so we query the DB instead of live-scraping at import time.
    try {
      const term = `${firstName.trim()} ${lastName.trim()}`.trim()
      const needle = lastName.trim() || term
      const { data: t100 } = await supabaseAnon
        .from('t100_results')
        .select('event_name,event_date,race_name,distance_m,athlete_name,finish_time,swim_time,t1_time,bike_time,t2_time,run_time,overall_position,gender_position,category,country')
        .ilike('athlete_name', `%${needle}%`)
        .limit(50)
      const tokens = term.toLowerCase().split(/\s+/).filter(t => t.length > 1)
      for (const r of (t100 ?? [])) {
        const n = String(r.athlete_name || '').toLowerCase()
        if (tokens.length && !tokens.every(t => n.includes(t))) continue
        const splits = ([
          r.swim_time && { label: 'Swim', split: r.swim_time },
          r.t1_time   && { label: 'T1',   split: r.t1_time },
          r.bike_time && { label: 'Bike', split: r.bike_time },
          r.t2_time   && { label: 'T2',   split: r.t2_time },
          r.run_time  && { label: 'Run',  split: r.run_time },
        ].filter(Boolean) as ImportSplit[])
        all.push({
          raceName: r.event_name,
          date: normalizeDateStr(r.event_date ?? ''),
          time: normalizeImportTime(r.finish_time ?? undefined),
          distance_m: r.distance_m ?? undefined,
          sport: 'Triathlon',
          placing: r.overall_position != null ? String(r.overall_position) : '',
          genderPlacing: r.gender_position != null ? String(r.gender_position) : '',
          agLabel: r.category || '',
          country: r.country || '',
          ...(splits.length ? { splits } : {}),
          source: 't100',
        })
      }
    } catch { /* table absent / no match — non-fatal */ }

    setSearching(false)
    setStep('results')

    // 1-tap: pre-select the single best non-duplicate result and float it to the
    // top so the pre-ticked row is immediately visible (a buried tick makes the
    // "IMPORT 1 RACE" button read as a mystery). The IMPORT button still needs
    // one confirm tap — we never auto-save, guarding against a wrong namesake.
    const best = rankBestMatch(all, { isDuplicate: r => isDuplicate(r as ImportResult), lastName: lastName.trim() })
    const ordered = best > 0 ? [all[best], ...all.slice(0, best), ...all.slice(best + 1)] : all
    setResults(ordered)
    if (best >= 0) {
      setSelected(new Set([0]))
    } else {
      setSelected(new Set())
    }

    // Funnel instrumentation: the per-provider search/fetch is captured
    // server-side (health-proxy, posthog-node). These are the client-side
    // mid-funnel steps the server can't see — they pin whether the leak is
    // no-results vs results-but-no-select vs select-but-no-import.
    const providerCounts: Record<string, number> = {}
    for (const r of all) providerCounts[r.source] = (providerCounts[r.source] ?? 0) + 1
    posthog.capture('race import results shown', {
      total_results: all.length,
      has_results: all.length > 0,
      provider_counts: providerCounts,
      providers_errored: Object.keys(errs).filter(k => (errs as Record<string, boolean>)[k]),
    })

    if (all.length === 0) {
      posthog.capture('race import no results', {
        providers_queried: ['ultrasignup', 'marathonview', 'runsignup', 'coachcox', 'sporthive', 't100', ...(athlinksUrl.trim() ? ['athlinks'] : [])],
      })
    } else if (best >= 0) {
      posthog.capture('race import row selected', { source: all[best].source, was_auto: true })
    }
  }

  async function searchHopaEvents() {
    if (!hopaQuery.trim()) { setHopaEvents([]); return }
    setHopaSearching(true)
    try {
      const res = await fetch(`${HEALTH_PROXY}/import/hopasports-events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: hopaQuery.trim() }),
      }).then(r => r.json())
      setHopaEvents(res?.status === 'ok' ? (res.events ?? []).slice(0, 12) : [])
    } catch { setHopaEvents([]) }
    setHopaSearching(false)
  }

  async function pickHopaEvent(slug: string) {
    if (!firstName.trim() && !lastName.trim()) { setError('Enter your first or last name above first'); return }
    setHopaFetching(slug); setError('')
    try {
      const res = await fetch(`${HEALTH_PROXY}/import/hopasports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, firstName: firstName.trim(), lastName: lastName.trim() }),
      }).then(r => r.json())
      const rows: ImportResult[] = res?.status === 'ok'
        ? (res.results ?? [])
            .filter((r: { athleteName?: string }) => r.athleteName && r.athleteName.length >= 2)
            .map((r: { raceName?: string; date?: string; time?: string; distance_m?: number; placing?: string }) => ({
              raceName: r.raceName ?? 'Hopasports Event',
              date: r.date ?? '',
              time: r.time,
              distance_m: r.distance_m,
              placing: r.placing,
              source: 'hopasports' as const,
            }))
        : []
      const who = `${firstName} ${lastName}`.trim()
      if (!rows.length) { setError(`No results for "${who}" in that event — check the spelling on your bib name.`); setHopaFetching(''); return }
      setResults(rows)
      setStep('results')
      posthog.capture('race import results shown', { total_results: rows.length, has_results: true, provider_counts: { hopasports: rows.length }, providers_errored: [] })
      const best = rankBestMatch(rows, { isDuplicate: r => isDuplicate(r as ImportResult), lastName: lastName.trim() })
      if (best >= 0) {
        setSelected(new Set([best]))
        posthog.capture('race import row selected', { source: 'hopasports', was_auto: true })
      } else {
        setSelected(new Set())
      }
    } catch { setError('Hopasports lookup failed — try again.') }
    setHopaFetching('')
  }

  // Two races are the SAME only when they share a date AND a distance (~0.6km).
  // Date-only matching wrongly collapsed same-day multi-distance events — e.g. a
  // 10K + 5K + 3K festival on one morning all read as "duplicate" and got
  // blocked / deleted. Compare distance; fall back to name only when distance is
  // unknown on either side (never widen the block back to date-only).
  function importKm(r: ImportResult): number {
    return r.distance_m && r.distance_m > 0 ? r.distance_m / 1000 : parseDistKm(r.raceName)
  }
  function sameLoggedRace(ex: Race, r: ImportResult, date: string): boolean {
    if (ex.date !== date) return false
    const exKm = resolveDistKm(ex.distance ?? '')
    const rKm = importKm(r)
    if (exKm == null || !rKm) {
      return (ex.name ?? '').toLowerCase() === r.raceName.toLowerCase()
    }
    return Math.abs(exKm - rKm) < 0.6
  }

  function isDuplicate(r: ImportResult): boolean {
    const date = r.date || ''
    if (!date) return false
    return existingRaces.some(ex => sameLoggedRace(ex, r, date))
        || upcomingRaces.some(ex => sameLoggedRace(ex, r, date))
  }

  function toggleSelect(i: number) {
    if (isDuplicate(results[i])) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else {
        next.add(i)
        posthog.capture('race import row selected', { source: results[i].source, was_auto: false })
      }
      return next
    })
  }

  async function handleImport() {
    if (selected.size === 0) return
    setImporting(true)
    let skipped = 0
    for (const i of selected) {
      const r = results[i]
      const date = r.date || new Date().toISOString().split('T')[0]
      const dupe = existingRaces.some(ex => sameLoggedRace(ex, r, date))
                || upcomingRaces.some(ex => sameLoggedRace(ex, r, date))
      if (dupe) { skipped++; continue }
      const distKm = r.distance_m && r.distance_m > 0
        ? r.distance_m / 1000
        : parseDistKm(r.raceName)
      const distance = kmToDistLabel(distKm)
      const race: Race = {
        id:       crypto.randomUUID(),
        name:     r.raceName,
        date,
        time:     normalizeImportTime(r.time),
        distance,
        sport:    r.sport ?? 'Running',
        city:     r.city ?? '',
        country:  deriveImportCountry(r.country, r.state),
        // Rich fields from tri sources (Coach Cox / IRONMAN) — only set when present
        ...(r.splits && r.splits.length ? { splits: r.splits.filter(s => s.split).map(s => ({ label: s.label, split: s.split })) } : {}),
        ...(r.agLabel       ? { agLabel: r.agLabel }             : {}),
        ...(r.placing       ? { placing: r.placing }             : {}),
        ...(r.genderPlacing ? { genderPlacing: r.genderPlacing } : {}),
        ...(r.agPlacing     ? { agPlacing: r.agPlacing }         : {}),
        ...(r.outcome       ? { outcome: r.outcome }             : {}),
      }
      addRace(race)
    }
    const imported = selected.size - skipped
    setSkippedCount(skipped)
    setImporting(false)
    if (imported > 0) {
      posthog.capture('race import completed', {
        imported_count: imported,
        skipped_count: skipped,
        selected_count: selected.size,
      })
    }
    if (skipped < selected.size) onClose()
  }

  return createPortal(
    <div style={st.overlay} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={st.sheet} onClick={e => e.stopPropagation()}>
        <div style={st.handle} />
        <div style={st.header}>
          <span style={st.title}>
            {step === 'search' ? 'IMPORT RACES' : 'SELECT YOUR RACES'}
          </span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={st.body}>
          {step === 'search' && (
            <>
              <p style={st.hint}>Search UltraSignup, MarathonView, RunSignup, Coach Cox (IRONMAN / 70.3) and Sporthive (MYLAPS) for races you've run.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={st.fieldLabel}>First Name</label>
                  <input
                    style={st.input}
                    placeholder="Alex"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={st.fieldLabel}>Last Name</label>
                  <input
                    style={st.input}
                    placeholder="Johnson"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={st.fieldLabel}>
                  Athlinks Profile URL <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>(optional)</span>
                </label>
                <input
                  style={st.input}
                  placeholder="athlinks.com/athletes/12345678"
                  value={athlinksUrl}
                  onChange={e => setAthlinksUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  inputMode="url"
                  autoComplete="off"
                />
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
                  Find your ID: athlinks.com → My Profile → copy the URL
                </p>
              </div>

              {/* Hopasports — UAE / MENA events (RAK, Dubai Creek, Expo City Half…) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: 'var(--sp-3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', background: 'var(--surface3)' }}>
                <label style={st.fieldLabel}>
                  UAE race? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>(Hopasports — RAK, Dubai, etc.)</span>
                </label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <input
                    style={{ ...st.input, flex: 1 }}
                    placeholder="Search the event name…"
                    value={hopaQuery}
                    onChange={e => setHopaQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchHopaEvents())}
                    autoComplete="off"
                  />
                  <button type="button" style={st.cancelBtn} onClick={searchHopaEvents} disabled={hopaSearching}>
                    {hopaSearching ? '…' : 'FIND'}
                  </button>
                </div>
                {hopaEvents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                    {hopaEvents.map(ev => (
                      <button
                        key={ev.slug}
                        type="button"
                        onClick={() => pickHopaEvent(ev.slug)}
                        disabled={!!hopaFetching}
                        style={{ textAlign: 'left', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-2) var(--sp-3)', color: 'var(--white)', fontSize: 'var(--text-sm)', fontFamily: 'var(--body)', cursor: hopaFetching ? 'wait' : 'pointer', opacity: hopaFetching && hopaFetching !== ev.slug ? 0.5 : 1 }}
                      >
                        {hopaFetching === ev.slug ? 'Looking up your result…' : ev.name}
                      </button>
                    ))}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
                  Enter your name above, then pick your event — we'll pull your finish time, placing and distance.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                <span style={st.sourcePill}>✓ UltraSignup</span>
                <span style={st.sourcePill}>✓ MarathonView</span>
                <span style={st.sourcePill}>✓ RunSignup</span>
                <span style={st.sourcePill}>✓ Coach Cox</span>
                <span style={{ ...st.sourcePill, opacity: athlinksUrl.trim() ? 1 : 0.45 }}>✓ Athlinks</span>
                <span style={st.sourcePill}>✓ Sporthive</span>
                <span style={st.sourcePill}>✓ T100</span>
                <span style={st.sourcePill}>✓ Hopasports (UAE)</span>
              </div>
              {onPickByRace && (
                <button
                  type="button"
                  onClick={onPickByRace}
                  style={{ background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--body)', cursor: 'pointer', textAlign: 'left' }}
                >
                  🏊 Racing IRONMAN or 70.3? <span style={{ color: 'var(--orange)', fontWeight: 600 }}>Pick a specific race →</span> for official splits.
                </button>
              )}
              {error && <p style={st.errorText}>{error}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <button style={st.cancelBtn} onClick={onClose} type="button">CANCEL</button>
                <button
                  className="btn-v3 btn-primary-v3"
                  style={st.saveBtn}
                  onClick={handleSearch}
                  disabled={searching}
                  type="button"
                >
                  {searching ? 'SEARCHING…' : 'SEARCH'}
                </button>
              </div>
            </>
          )}

          {step === 'results' && (
            <>
              {(sourceErrors.ultrasignup || sourceErrors.marathonview || sourceErrors.athlinks || sourceErrors.runsignup || sourceErrors.sporthive) && (
                <div style={{ padding: '8px 12px', background: 'rgba(var(--error-ch),0.08)', border: '1px solid rgba(var(--error-ch),0.25)', borderRadius: 'var(--radius-md)', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-2)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--error)' }}>
                    {[sourceErrors.ultrasignup && 'UltraSignup', sourceErrors.marathonview && 'MarathonView', sourceErrors.runsignup && 'RunSignup', sourceErrors.coachcox && 'Coach Cox', sourceErrors.athlinks && 'Athlinks', sourceErrors.sporthive && 'Sporthive'].filter(Boolean).join(' & ')} failed to respond.
                  </p>
                  <button
                    style={{ background: 'none', border: '1px solid rgba(var(--error-ch),0.4)', color: 'var(--error)', fontSize: 'var(--text-xs)', padding: '3px 8px', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', flexShrink: 0 }}
                    onClick={() => { setStep('search'); }}
                    type="button"
                  >
                    RETRY
                  </button>
                </div>
              )}
              {results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
                  <p style={{ color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 900, letterSpacing: '0.08em', fontSize: 'var(--text-compact)' }}>
                    NO RESULTS FOUND
                  </p>
                  <p style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', marginTop: '8px', lineHeight: 1.5 }}>
                    We couldn't find a race under that name. Add it yourself in a few seconds — we'll keep your stats moving.
                  </p>
                  {onAddManual && (
                    <button
                      className="btn-v3 btn-primary-v3"
                      style={{ ...st.saveBtn, marginTop: '20px' }}
                      onClick={() => {
                        posthog.capture('race import add manual clicked', { from: 'no_results' })
                        onAddManual()
                      }}
                      type="button"
                    >
                      + ADD RACE MANUALLY
                    </button>
                  )}
                  <button style={{ ...st.cancelBtn, marginTop: '12px' }} onClick={() => setStep('search')}>← TRY ANOTHER NAME</button>
                </div>
              ) : (
                <>
                  {(() => {
                    const dupeCount = results.filter(isDuplicate).length
                    return (
                      <p style={st.hint}>
                        Tap races to select them. Found {results.length} result{results.length !== 1 ? 's' : ''}
                        {dupeCount > 0 ? ` — ${dupeCount} already in your history.` : '.'}
                      </p>
                    )
                  })()}
                  {results.map((r, i) => {
                    const dupe = isDuplicate(r)
                    return (
                    <button
                      key={i}
                      style={{
                        ...st.resultRow,
                        background: dupe
                          ? 'var(--surface2)'
                          : selected.has(i) ? 'rgba(var(--orange-ch),0.1)' : 'var(--surface3)',
                        border: `1px solid ${dupe
                          ? 'var(--border)'
                          : selected.has(i) ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                        opacity: dupe ? 0.55 : 1,
                        cursor: dupe ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => toggleSelect(i)}
                      type="button"
                      disabled={dupe}
                      aria-disabled={dupe}
                      title={dupe ? 'Already in your race history' : undefined}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <span style={{ fontSize: 'var(--text-base)', flexShrink: 0 }}>
                          {dupe ? '✕' : selected.has(i) ? '✓' : '○'}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-compact)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.raceName}
                          </p>
                          {(() => {
                            const km = r.distance_m && r.distance_m > 0 ? r.distance_m / 1000 : parseDistKm(r.raceName)
                            const lbl = kmToDistLabel(km)
                            return lbl ? (
                              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted2)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                {lbl}
                              </p>
                            ) : null
                          })()}
                          {dupe && (
                            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--green)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              ✓ Already in your race history
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          {normalizeImportTime(r.time) && (
                            <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--orange)', letterSpacing: '0.02em', lineHeight: 1 }}>
                              {normalizeImportTime(r.time)}
                            </div>
                          )}
                          {r.date && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--body)' }}>
                              {fmtDateDDMM(r.date)}
                            </div>
                          )}
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em' }}>
                            {r.source}
                          </div>
                        </div>
                      </div>
                    </button>
                  )})}
                  {skippedCount > 0 && (
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', textAlign: 'center' }}>
                      {skippedCount} already logged — skipped.
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                    <button style={st.cancelBtn} onClick={() => setStep('search')} type="button">← BACK</button>
                    <button
                      className="btn-v3 btn-primary-v3"
                      style={st.saveBtn}
                      onClick={handleImport}
                      disabled={selected.size === 0 || importing}
                      type="button"
                    >
                      {importing
                        ? 'IMPORTING…'
                        : `IMPORT ${selected.size > 0 ? selected.size : ''} RACE${selected.size !== 1 ? 'S' : ''}`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const st = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 960, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } as React.CSSProperties,
  sheet:      { width: '100%', maxWidth: '680px', maxHeight: '85dvh', background: 'var(--surface2)', borderTop: '2px solid var(--orange)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' } as React.CSSProperties,
  handle:     { width: '36px', height: '4px', background: 'var(--border2)', borderRadius: 'var(--radius-xs)', margin: '12px auto 0', flexShrink: 0 } as React.CSSProperties,
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', flexShrink: 0 } as React.CSSProperties,
  title:      { fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--white)' } as React.CSSProperties,
  closeBtn:   { background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 'var(--text-md)', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 } as React.CSSProperties,
  body:       { padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1, paddingBottom: 'calc(var(--safe-bottom) + 32px)' } as React.CSSProperties,
  fieldLabel: { fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--muted)' } as React.CSSProperties,
  input:      { width: '100%', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--white)', fontSize: 'var(--text-compact)', padding: '0.6rem 0.75rem', fontFamily: 'var(--body)', boxSizing: 'border-box' as const, minWidth: 0 } as React.CSSProperties,
  hint:       { margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', fontFamily: 'var(--body)' } as React.CSSProperties,
  sourcePill: { background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--green)' } as React.CSSProperties,
  resultRow:  { width: '100%', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.15s' } as React.CSSProperties,
  saveBtn:    { width: '100%', padding: 'var(--sp-4)' } as React.CSSProperties,
  cancelBtn:  { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, cursor: 'pointer', width: '100%' } as React.CSSProperties,
  errorText:  { margin: 0, fontSize: 'var(--text-xs)', color: 'var(--error)' } as React.CSSProperties,
}
