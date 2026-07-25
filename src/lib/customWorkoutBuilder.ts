import type { Race, SavedWorkoutSegment } from '@/types'
import type { PaceZone } from '@/lib/raceFormulas'
import { parseDistKm } from '@/lib/raceFormulas'

export type CustomBuilderObjective =
  | 'recovery'
  | 'aerobic'
  | 'threshold'
  | 'interval'
  | 'race-pace'

export type CustomBlockType =
  | 'warmup'
  | 'easy'
  | 'marathon'
  | 'threshold'
  | 'interval'
  | 'repetition'
  | 'cooldown'

export type CustomUnitType = 'time' | 'distance'

export interface CustomWorkoutBlock {
  id: string
  blockType: CustomBlockType
  unitType: CustomUnitType
  value: number
  repeatCount: number
  recoveryValue: number
  recoveryUnitType: CustomUnitType
  paceBias: number
}

export interface CustomVisualSegment {
  id: string
  label: string
  shortLabel: string
  kind: 'work' | 'easy' | 'recovery'
  width: number
  height: number
  color: string
  paceLabel: string
  detail: string
}

export interface CustomWorkoutSummary {
  totalMinutes: number
  totalDistanceKm: number
  qualityMinutes: number
  easyMinutes: number
  estimatedLoad: number
  densityScore: number
  primaryStimulus: string
  secondaryStimulus: string
  fitLabel: string
  fitReason: string
  risks: string[]
  suggestions: string[]
  verdict: string
  visualSegments: CustomVisualSegment[]
  savedSegments: SavedWorkoutSegment[]
}

const ZONE_BY_BLOCK: Record<CustomBlockType, string> = {
  warmup: 'E',
  easy: 'E',
  marathon: 'M',
  threshold: 'T',
  interval: 'I',
  repetition: 'R',
  cooldown: 'E',
}

const LABEL_BY_BLOCK: Record<CustomBlockType, string> = {
  warmup: 'Warm-up',
  easy: 'Easy',
  marathon: 'Marathon Effort',
  threshold: 'Threshold',
  interval: 'Interval',
  repetition: 'Repetition',
  cooldown: 'Cool-down',
}

const SHORT_BY_BLOCK: Record<CustomBlockType, string> = {
  warmup: 'WU',
  easy: 'E',
  marathon: 'M',
  threshold: 'T',
  interval: 'I',
  repetition: 'R',
  cooldown: 'CD',
}

const COLOR_BY_KIND: Record<CustomVisualSegment['kind'], string> = {
  work: 'linear-gradient(180deg, #ff7a30 0%, #e84e1b 100%)',
  easy: 'linear-gradient(180deg, #303030 0%, #1a1a1a 100%)',
  recovery: 'linear-gradient(180deg, #474747 0%, #262626 100%)',
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function zoneForBlock(blockType: CustomBlockType): string {
  return ZONE_BY_BLOCK[blockType]
}

function labelForBlock(blockType: CustomBlockType): string {
  return LABEL_BY_BLOCK[blockType]
}

function getZone(zones: PaceZone[], abbr: string): PaceZone | null {
  return zones.find(zone => zone.abbr === abbr) ?? null
}

function repPaceSecPerKm(zone: PaceZone | null, blockType: CustomBlockType, paceBias = 50): number {
  if (!zone) return 360
  const normalized = clamp(paceBias / 100, 0, 1)
  if (blockType === 'warmup' || blockType === 'easy' || blockType === 'cooldown') {
    return zone.maxSecPerKm - (zone.maxSecPerKm - zone.minSecPerKm) * normalized * 0.55
  }
  if (blockType === 'marathon') {
    return zone.maxSecPerKm - (zone.maxSecPerKm - zone.minSecPerKm) * normalized
  }
  if (blockType === 'threshold') {
    return zone.maxSecPerKm - (zone.maxSecPerKm - zone.minSecPerKm) * normalized
  }
  if (blockType === 'interval') {
    return zone.maxSecPerKm - (zone.maxSecPerKm - zone.minSecPerKm) * normalized
  }
  return zone.maxSecPerKm - (zone.maxSecPerKm - zone.minSecPerKm) * normalized
}

function paceLabel(zone: PaceZone | null): string {
  if (!zone) return '—'
  return `${zone.minPaceStr} - ${zone.maxPaceStr}`
}

function unitDetail(unitType: CustomUnitType, value: number): string {
  return unitType === 'time' ? `${value} min` : `${value} km`
}

function distanceFromBlock(value: number, unitType: CustomUnitType, secPerKm: number): number {
  if (unitType === 'distance') return value
  return (value * 60) / secPerKm
}

function durationFromBlock(value: number, unitType: CustomUnitType, secPerKm: number): number {
  if (unitType === 'time') return value
  return (value * secPerKm) / 60
}

function isQualityBlock(blockType: CustomBlockType): boolean {
  return blockType === 'threshold' || blockType === 'interval' || blockType === 'repetition' || blockType === 'marathon'
}

function effortScore(blockType: CustomBlockType): number {
  switch (blockType) {
    case 'warmup':
    case 'easy':
    case 'cooldown':
      return 0.62
    case 'marathon':
      return 0.78
    case 'threshold':
      return 0.87
    case 'interval':
      return 0.97
    case 'repetition':
      return 1.04
  }
}

function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km * 10) / 10} km`
}

function classifyStimulus(minutesByType: Record<CustomBlockType, number>): { primary: string; secondary: string } {
  const ordered = Object.entries(minutesByType)
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1]) as Array<[CustomBlockType, number]>

  const toStimulus = (type: CustomBlockType): string => {
    switch (type) {
      case 'threshold':
        return 'Threshold endurance'
      case 'interval':
        return 'VO2 development'
      case 'repetition':
        return 'Neuromuscular economy'
      case 'marathon':
        return 'Race-pace durability'
      default:
        return 'Aerobic support'
    }
  }

  return {
    primary: toStimulus(ordered[0]?.[0] ?? 'easy'),
    secondary: toStimulus(ordered[1]?.[0] ?? 'easy'),
  }
}

function targetRaceBucket(nextRace: Race | null): '5k' | '10k' | 'half' | 'marathon' | 'general' {
  const km = parseDistKm(nextRace?.distance)
  if (!km) return 'general'
  if (km <= 6) return '5k'
  if (km <= 12) return '10k'
  if (km <= 25) return 'half'
  return 'marathon'
}

function fitAssessment(
  objective: CustomBuilderObjective,
  nextRace: Race | null,
  daysToRace: number | null,
  freshness: 'fresh' | 'normal' | 'tired',
  qualityMinutes: number,
): { fitLabel: string; fitReason: string; risks: string[]; suggestions: string[] } {
  const raceBucket = targetRaceBucket(nextRace)
  const risks: string[] = []
  const suggestions: string[] = []

  if (freshness === 'tired' && qualityMinutes >= 35) {
    risks.push('This is quite dense for a tired day and may drift from productive into survival.')
    suggestions.push('Reduce one rep or lengthen the recoveries if you still want quality today.')
  }

  if (daysToRace !== null && daysToRace <= 10 && objective === 'interval') {
    risks.push('This is a sharp session very close to race day and may cost more freshness than it gives back.')
    suggestions.push('Convert one hard rep into a steady race-pace block if the race is the priority.')
  }

  if (objective === 'threshold' && raceBucket === 'marathon') {
    suggestions.push('Consider adding a longer marathon-effort section if the goal race is a full marathon.')
  }

  if (objective === 'race-pace' && raceBucket === '5k') {
    suggestions.push('For a 5K build, keep race-pace work short and controlled so it does not become a flat-out interval session.')
  }

  if (objective === 'recovery' && qualityMinutes > 0) {
    risks.push('A recovery objective with quality work is sending mixed signals.')
    suggestions.push('Move this toward an easy aerobic session or change the objective to quality.')
  }

  if (daysToRace !== null && daysToRace <= 21 && objective === 'race-pace') {
    return {
      fitLabel: 'High fit',
      fitReason: 'Race-pace work is timely and specific for an upcoming goal race.',
      risks,
      suggestions,
    }
  }

  if (objective === 'threshold' && (raceBucket === '10k' || raceBucket === 'half')) {
    return {
      fitLabel: 'High fit',
      fitReason: 'Threshold work is strongly aligned with sustained race rhythm for a 10K or half-marathon build.',
      risks,
      suggestions,
    }
  }

  if (objective === 'interval' && raceBucket === '5k') {
    return {
      fitLabel: 'High fit',
      fitReason: 'Interval work matches the speed and aerobic-power demands of shorter race builds.',
      risks,
      suggestions,
    }
  }

  return {
    fitLabel: 'Moderate fit',
    fitReason: 'The session is useful, but its value depends on how it fits around your recent workload and race timeline.',
    risks,
    suggestions,
  }
}

export function createDefaultCustomBlocks(): CustomWorkoutBlock[] {
  return [
    { id: crypto.randomUUID(), blockType: 'warmup', unitType: 'time', value: 15, repeatCount: 1, recoveryValue: 0, recoveryUnitType: 'time', paceBias: 30 },
    { id: crypto.randomUUID(), blockType: 'threshold', unitType: 'time', value: 8, repeatCount: 4, recoveryValue: 2, recoveryUnitType: 'time', paceBias: 55 },
    { id: crypto.randomUUID(), blockType: 'cooldown', unitType: 'time', value: 10, repeatCount: 1, recoveryValue: 0, recoveryUnitType: 'time', paceBias: 25 },
  ]
}

export function summarizeCustomWorkout(args: {
  blocks: CustomWorkoutBlock[]
  zones: PaceZone[]
  objective: CustomBuilderObjective
  nextRace: Race | null
  daysToRace: number | null
  freshness: 'fresh' | 'normal' | 'tired'
}): CustomWorkoutSummary {
  const { blocks, zones, objective, nextRace, daysToRace, freshness } = args
  const easyZone = getZone(zones, 'E')
  const repSegments: CustomVisualSegment[] = []
  const savedSegments: SavedWorkoutSegment[] = []
  const minutesByType: Record<CustomBlockType, number> = {
    warmup: 0,
    easy: 0,
    marathon: 0,
    threshold: 0,
    interval: 0,
    repetition: 0,
    cooldown: 0,
  }

  let totalMinutes = 0
  let totalDistanceKm = 0
  let qualityMinutes = 0
  let easyMinutes = 0
  let rawLoad = 0

  const secFast = getZone(zones, 'R')?.minSecPerKm ?? 180
  const secSlow = easyZone?.maxSecPerKm ?? 420

  blocks.forEach((block) => {
    const zone = getZone(zones, zoneForBlock(block.blockType)) ?? easyZone
    const zonePaceSec = repPaceSecPerKm(zone, block.blockType, block.paceBias)
    const workMinutes = durationFromBlock(block.value, block.unitType, zonePaceSec)
    const workKm = distanceFromBlock(block.value, block.unitType, zonePaceSec)
    const repeats = Math.max(1, block.repeatCount)

    minutesByType[block.blockType] += workMinutes * repeats
    totalMinutes += workMinutes * repeats
    totalDistanceKm += workKm * repeats
    rawLoad += workMinutes * repeats * Math.pow(effortScore(block.blockType), 2) * 1.45

    if (isQualityBlock(block.blockType)) qualityMinutes += workMinutes * repeats
    else easyMinutes += workMinutes * repeats

    const pace = paceLabel(zone)
    const repDetail = block.repeatCount > 1
      ? `${repeats} x ${unitDetail(block.unitType, block.value)}`
      : unitDetail(block.unitType, block.value)
    const recDetail = block.repeatCount > 1 && block.recoveryValue > 0
      ? ` with ${unitDetail(block.recoveryUnitType, block.recoveryValue)} easy jog`
      : ''

    savedSegments.push({
      label: labelForBlock(block.blockType),
      detail: `${repDetail}${recDetail}`,
      zone: zoneForBlock(block.blockType),
      pace,
    })

    for (let i = 0; i < repeats; i += 1) {
      const width = clamp(workMinutes / 4, 0.7, 3.4)
      const normalized = clamp((secSlow - zonePaceSec) / Math.max(1, secSlow - secFast), 0, 1)
      repSegments.push({
        id: `${block.id}-work-${i}`,
        label: labelForBlock(block.blockType),
        shortLabel: repeats > 1 ? `${SHORT_BY_BLOCK[block.blockType]}${i + 1}` : SHORT_BY_BLOCK[block.blockType],
        kind: isQualityBlock(block.blockType) ? 'work' : 'easy',
        width,
        height: 68 + normalized * 50,
        color: COLOR_BY_KIND[isQualityBlock(block.blockType) ? 'work' : 'easy'],
        paceLabel: pace,
        detail: repDetail,
      })

      if (i < repeats - 1 && block.recoveryValue > 0) {
        const recoveryPace = repPaceSecPerKm(easyZone, 'easy')
        const recoveryMinutes = durationFromBlock(block.recoveryValue, block.recoveryUnitType, recoveryPace)
        const recoveryKm = distanceFromBlock(block.recoveryValue, block.recoveryUnitType, recoveryPace)
        totalMinutes += recoveryMinutes
        totalDistanceKm += recoveryKm
        easyMinutes += recoveryMinutes
        rawLoad += recoveryMinutes * Math.pow(effortScore('easy'), 2)

        repSegments.push({
          id: `${block.id}-recovery-${i}`,
          label: 'Recovery',
          shortLabel: 'Jog',
          kind: 'recovery',
          width: clamp(recoveryMinutes / 4, 0.5, 1.6),
          height: 62,
          color: COLOR_BY_KIND.recovery,
          paceLabel: paceLabel(easyZone),
          detail: unitDetail(block.recoveryUnitType, block.recoveryValue),
        })
      }
    }
  })

  const densityScore = totalMinutes > 0 ? qualityMinutes / totalMinutes : 0
  const estimatedLoad = Math.round(rawLoad * (densityScore > 0.45 ? 1.08 : 1))
  const { primary, secondary } = classifyStimulus(minutesByType)
  const fit = fitAssessment(objective, nextRace, daysToRace, freshness, qualityMinutes)
  const risks = [...fit.risks]
  const suggestions = [...fit.suggestions]

  if (densityScore > 0.55) {
    risks.push('The quality density is high, so the session may feel more draining than its total duration suggests.')
    suggestions.push('Spread the work slightly or reduce one rep if the goal is cleaner execution.')
  }

  if (qualityMinutes >= 45) {
    risks.push('This is a high-cost session and may overlap too aggressively with another hard day in the same week.')
  }

  if (!blocks.some(block => block.blockType === 'warmup')) {
    risks.push('There is no explicit warm-up, which makes the first quality block riskier.')
    suggestions.push('Add at least 10 to 15 minutes of easy running before the first hard rep.')
  }

  const verdict = `${primary} is the main payoff here. ${fit.fitReason}${risks.length ? ` The main watch-out is ${risks[0].charAt(0).toLowerCase()}${risks[0].slice(1)}` : ''}`

  return {
    totalMinutes,
    totalDistanceKm,
    qualityMinutes,
    easyMinutes,
    estimatedLoad,
    densityScore,
    primaryStimulus: primary,
    secondaryStimulus: secondary,
    fitLabel: fit.fitLabel,
    fitReason: fit.fitReason,
    risks,
    suggestions,
    verdict,
    visualSegments: repSegments,
    savedSegments,
  }
}

export function blockPacePreview(block: CustomWorkoutBlock, zones: PaceZone[]): { min: string; max: string; target: string } {
  const zone = getZone(zones, zoneForBlock(block.blockType))
  if (!zone) return { min: '—', max: '—', target: '—' }
  const targetSec = repPaceSecPerKm(zone, block.blockType, block.paceBias)
  const targetMin = Math.floor(targetSec / 60)
  const targetSecs = Math.round(targetSec % 60)
  const target = `${targetMin}:${String(targetSecs).padStart(2, '0')} /km`
  return {
    min: zone.maxPaceStr,
    max: zone.minPaceStr,
    target,
  }
}

export function buildCustomWorkoutNotes(summary: CustomWorkoutSummary): string[] {
  return [
    `Primary stimulus: ${summary.primaryStimulus}.`,
    `Secondary stimulus: ${summary.secondaryStimulus}.`,
    `Fit: ${summary.fitReason}`,
    ...summary.risks.slice(0, 2),
    ...summary.suggestions.slice(0, 2),
  ]
}

export function makeCustomWorkoutTitle(objective: CustomBuilderObjective): string {
  switch (objective) {
    case 'recovery':
      return 'Custom Recovery Session'
    case 'aerobic':
      return 'Custom Aerobic Session'
    case 'threshold':
      return 'Custom Threshold Session'
    case 'interval':
      return 'Custom Interval Session'
    case 'race-pace':
      return 'Custom Race-Pace Session'
  }
}

export function objectiveSubtitle(objective: CustomBuilderObjective, summary: CustomWorkoutSummary): string {
  return `${summary.primaryStimulus} • ${formatDistance(summary.totalDistanceKm)} • ${Math.round(summary.totalMinutes)} min`
}
