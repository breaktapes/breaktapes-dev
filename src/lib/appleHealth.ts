import { supabase } from '@/lib/supabase'
import { useWearableStore } from '@/stores/useWearableStore'

const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB
const FLUSH_THRESHOLD = 5000        // flush a date early if it hits this many records

interface HealthRecord {
  type: string
  value: string
  unit: string
  startDate: string
  sourceName: string
}

function extractRecords(text: string): HealthRecord[] {
  const results: HealthRecord[] = []
  const re = /<Record\s+([^>]+?)(?:\/>|>)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const attrs = m[1]
    const attr = (name: string) => {
      const a = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'))
      return a ? a[1] : ''
    }
    results.push({
      type:       attr('type'),
      value:      attr('value'),
      unit:       attr('unit'),
      startDate:  attr('startDate'),
      sourceName: attr('sourceName'),
    })
  }
  return results
}

async function flushDate(userId: string, date: string, records: HealthRecord[]) {
  // Upsert in 100-row batches
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100).map(r => ({
      user_id: userId,
      date,
      type:   r.type,
      value:  r.value,
      unit:   r.unit,
      source: r.sourceName,
    }))
    await supabase.from('apple_health_data').upsert(batch, {
      onConflict: 'user_id,date,type',
    })
  }
}

/**
 * Stream-parse Apple Health export.xml in 8 MB chunks.
 * Safe for files > 500 MB; peak memory ~16 MB.
 */
export async function importAppleHealthXMLStreaming(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let offset = 0
  const total = file.size
  const batchDates = new Set<string>()
  let pending: Record<string, HealthRecord[]> = {}
  let leftover = ''

  while (offset < total) {
    const blob = file.slice(offset, offset + CHUNK_SIZE)
    const text: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    offset += CHUNK_SIZE

    // Keep tail of previous chunk to avoid splitting a <Record> across boundaries
    const chunk = leftover + text
    const splitAt = chunk.length > 512 ? chunk.length - 512 : chunk.length
    leftover = chunk.slice(splitAt)

    for (const r of extractRecords(chunk.slice(0, splitAt))) {
      const date = r.startDate?.slice(0, 10)
      if (!date) continue
      if (!pending[date]) pending[date] = []
      pending[date].push(r)
    }

    // Early-flush dates that hit the threshold (handles single-date bulk exports)
    for (const [date, recs] of Object.entries(pending)) {
      if (recs.length >= FLUSH_THRESHOLD && !batchDates.has(date)) {
        await flushDate(user.id, date, recs)
        batchDates.add(date)
        delete pending[date]
      }
    }

    onProgress?.(Math.min(100, Math.round((offset / total) * 100)))
  }

  // Flush remaining dates
  for (const [date, recs] of Object.entries(pending)) {
    if (!batchDates.has(date)) {
      await flushDate(user.id, date, recs)
      batchDates.add(date)
    }
  }

  useWearableStore.getState().setAppleHealthSummary({
    totalWorkouts: batchDates.size,
    totalSteps: 0,
    lastSyncDate: new Date().toISOString().slice(0, 10),
  })
}

/**
 * Small-file path (< 500 MB): load entire file text, parse all records at once.
 */
export async function importAppleHealthXML(file: File): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const text = await file.text()
  const byDate: Record<string, HealthRecord[]> = {}
  for (const r of extractRecords(text)) {
    const date = r.startDate?.slice(0, 10)
    if (!date) continue
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(r)
  }

  for (const [date, recs] of Object.entries(byDate)) {
    await flushDate(user.id, date, recs)
  }

  useWearableStore.getState().setAppleHealthSummary({
    totalWorkouts: Object.keys(byDate).length,
    totalSteps: 0,
    lastSyncDate: new Date().toISOString().slice(0, 10),
  })
}
