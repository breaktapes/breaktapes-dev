// Ranking for the race-import "1-tap" flow: given the merged search results,
// pick the single best non-duplicate row to pre-select so the user lands on
// results with the most useful race already ticked and can commit in one tap.
//
// Pure + dependency-free so it can be unit-tested. Duplicate detection lives in
// the component (it needs the user's logged races), so it's injected as a
// predicate rather than reimplemented here.

export interface RankableImport {
  source: string
  raceName: string
  date?: string
  time?: string
  /** Present on rich tri sources (Coach Cox / IRONMAN / T100). */
  splits?: unknown[]
  placing?: string
}

interface RankOpts {
  /** Returns true if this result is already in the user's history (skip it). */
  isDuplicate: (r: RankableImport) => boolean
  /** The searched last name, used as a light name-confidence signal. */
  lastName?: string
}

// Higher = better. Richer payloads (splits/placing/time) make a more complete,
// more shareable logged race, so they win. Name match nudges confidence.
function score(r: RankableImport, lastName?: string): number {
  let s = 0
  if (r.splits && r.splits.length) s += 4
  if (r.placing) s += 2
  if (r.time) s += 1
  const ln = (lastName ?? '').trim().toLowerCase()
  if (ln && r.raceName.toLowerCase().includes(ln)) s += 1
  return s
}

/**
 * Index of the best non-duplicate result to pre-select, or -1 if every result
 * is a duplicate / the list is empty. Ties break toward the most recent date
 * (YYYY-MM-DD compares lexicographically), then earliest list position.
 */
export function rankBestMatch(results: RankableImport[], opts: RankOpts): number {
  let bestIdx = -1
  let bestScore = -Infinity
  let bestDate = ''
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (opts.isDuplicate(r)) continue
    const s = score(r, opts.lastName)
    const d = r.date ?? ''
    if (s > bestScore || (s === bestScore && d > bestDate)) {
      bestIdx = i
      bestScore = s
      bestDate = d
    }
  }
  return bestIdx
}
