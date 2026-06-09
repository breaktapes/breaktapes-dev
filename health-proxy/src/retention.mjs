// Pure selection logic for the retention email pipeline (reminders + weekly
// digest). No I/O, no Date.now() — all "today" values are passed in so the
// logic is deterministic and unit-testable. Imported by the scheduled() handler
// in index.js AND by the vitest suite (src/lib/__tests__/retention.test.ts).

/** Whole days from todayStr to dateStr (both YYYY-MM-DD). null if unparseable. */
export function daysUntil(todayStr, dateStr) {
  if (!dateStr || !todayStr) return null
  const a = Date.parse(todayStr + 'T00:00:00Z')
  const b = Date.parse(String(dateStr).slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

/** ISO week key like "2026-W24" — used as the digest idempotency key. */
export function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return ''
  // ISO week: Thursday-anchored.
  const day = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDay = (firstThu.getUTCDay() + 6) % 7
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3)
  const week = 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 86400000))
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** True if dateStr (YYYY-MM-DD) falls on a Monday (UTC). */
export function isMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1
}

const optedIn = (u) => !!u.email && u.email_opt_in !== false

/**
 * Reminders due today: each opted-in user's upcoming races whose date is within
 * [0, windowDays] days from today. The caller dedupes against reminder_sends
 * (kind 'reminder', per race id) before actually sending.
 */
export function selectReminders(users, todayStr, windowDays = 3) {
  const out = []
  for (const u of users) {
    if (!optedIn(u)) continue
    const upcoming = (u.state_json && u.state_json.upcoming_races) || []
    for (const r of upcoming) {
      if (!r || !r.id) continue
      const d = daysUntil(todayStr, r.date)
      if (d == null || d < 0 || d > windowDays) continue
      out.push({ userId: u.user_id, email: u.email, race: r, raceId: r.id, daysUntil: d, kind: 'reminder' })
    }
  }
  return out
}

/**
 * Weekly digest recipients — only on Mondays. One row per opted-in user with an
 * email, carrying their next upcoming race (soonest future date) for the body.
 * kind is week-stamped ('digest_2026-W24') so reminder_sends blocks a re-send
 * within the same ISO week.
 */
export function selectDigests(users, todayStr, mondayOverride) {
  const monday = typeof mondayOverride === 'boolean' ? mondayOverride : isMonday(todayStr)
  if (!monday) return []
  const wk = isoWeekKey(todayStr)
  const out = []
  for (const u of users) {
    if (!optedIn(u)) continue
    const upcoming = (u.state_json && u.state_json.upcoming_races) || []
    const future = upcoming
      .map(r => ({ r, d: daysUntil(todayStr, r && r.date) }))
      .filter(x => x.d != null && x.d >= 0)
      .sort((a, b) => a.d - b.d)
    out.push({
      userId: u.user_id,
      email: u.email,
      nextRace: future.length ? future[0].r : null,
      nextRaceDays: future.length ? future[0].d : null,
      kind: 'digest_' + wk,
    })
  }
  return out
}
