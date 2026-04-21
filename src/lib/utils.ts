const SPONSOR_RE = /\b(tcs|bmo|bmw|virgin money|adnoc|asics|zurich|bank of america)\b/g

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(SPONSOR_RE, '')
    .replace(/\d{4}/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

export function similarity(a: string, b: string): number {
  const ba = bigrams(a), bb = bigrams(b)
  let shared = 0
  ba.forEach(bg => { if (bb.has(bg)) shared++ })
  return (2 * shared) / (ba.size + bb.size) || 0
}
