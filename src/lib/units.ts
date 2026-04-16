/**
 * Unit conversion utilities for pace, distance, and speed.
 *
 * The app stores all distances in km and all paces in sec/km internally.
 * This module converts those values to the user's preferred display unit
 * (metric vs imperial) at render time — no changes to stored data.
 *
 * Usage:
 *   const units = useUnits()
 *   <span>{fmtDistKm('21.1', units)} · {fmtPaceSecPerKm(secPerKm, units)}</span>
 */

import { useAthleteStore } from '@/stores/useAthleteStore'

export type UnitSystem = 'metric' | 'imperial'

const KM_TO_MI = 0.621371
const PACE_FACTOR = 1 / KM_TO_MI   // sec/km → sec/mile: multiply by this

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Returns the user's preferred unit system. Defaults to metric. */
export function useUnits(): UnitSystem {
  return useAthleteStore(s => s.athlete?.units ?? 'metric')
}

// ─── Distance ─────────────────────────────────────────────────────────────────

/**
 * Format a distance that is stored as a km number (or numeric string).
 * e.g. fmtDistKm('21.1', 'metric')   → '21.1'
 *      fmtDistKm('21.1', 'imperial') → '13.1'
 * Returns the raw string if not parseable (e.g. 'Solo Open' for HYROX).
 */
export function fmtDistKm(km: string | number, units: UnitSystem): string {
  const n = typeof km === 'number' ? km : parseFloat(km as string)
  if (isNaN(n)) return String(km)
  if (units === 'imperial') {
    const mi = n * KM_TO_MI
    // Show 1 decimal for values < 100, integer above that
    return mi >= 100 ? Math.round(mi).toString() : mi.toFixed(1)
  }
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '')
}

/** Unit label for distances. */
export function distUnit(units: UnitSystem): string {
  return units === 'imperial' ? 'MI' : 'KM'
}

/** Full formatted distance string with unit, e.g. "21.1 KM" or "13.1 MI" */
export function fmtDistWithUnit(km: string | number, units: UnitSystem): string {
  const n = typeof km === 'number' ? km : parseFloat(km as string)
  if (isNaN(n)) return String(km)
  return `${fmtDistKm(km, units)} ${distUnit(units)}`
}

// ─── Pace ─────────────────────────────────────────────────────────────────────

/**
 * Format a pace expressed as seconds-per-km.
 * e.g. fmtPaceSecPerKm(285, 'metric')   → '4:45 /km'
 *      fmtPaceSecPerKm(285, 'imperial') → '7:38 /mi'
 */
export function fmtPaceSecPerKm(secPerKm: number, units: UnitSystem): string {
  if (!secPerKm || !isFinite(secPerKm)) return '--'
  const secs = units === 'imperial' ? secPerKm * PACE_FACTOR : secPerKm
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  const label = units === 'imperial' ? '/mi' : '/km'
  return `${m}:${s.toString().padStart(2, '0')} ${label}`
}

/** Pace unit label only, e.g. "/km" or "/mi" */
export function paceUnit(units: UnitSystem): string {
  return units === 'imperial' ? '/mi' : '/km'
}

// ─── Speed ────────────────────────────────────────────────────────────────────

/**
 * Format a speed in km/h.
 * e.g. fmtSpeedKmh(12.5, 'metric')   → '12.5 km/h'
 *      fmtSpeedKmh(12.5, 'imperial') → '7.8 mph'
 */
export function fmtSpeedKmh(kmh: number, units: UnitSystem): string {
  if (!kmh || !isFinite(kmh)) return '--'
  if (units === 'imperial') {
    return `${(kmh * KM_TO_MI).toFixed(1)} mph`
  }
  return `${kmh.toFixed(1)} km/h`
}

// ─── Race distance from time + finish time ────────────────────────────────────

/**
 * Compute pace in sec/km from a distance (km string) and a finish time (H:MM:SS).
 * Returns null if either is missing or invalid.
 */
export function computePaceSecPerKm(distKm: string, finishTime: string): number | null {
  const km = parseFloat(distKm)
  if (!km || isNaN(km)) return null
  const parts = finishTime.split(':').map(Number)
  if (parts.some(isNaN)) return null
  const secs = parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1]
  if (!secs) return null
  return secs / km
}
