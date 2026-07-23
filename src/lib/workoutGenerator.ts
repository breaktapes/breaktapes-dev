import type { PaceZone } from '@/lib/raceFormulas'

export type WorkoutType = 'recovery' | 'tempo' | 'vo2' | 'long' | 'race-pace'
export type GoalFocus = '5k' | '10k' | 'half' | 'marathon' | 'general'

export interface WorkoutSegment {
  label: string
  detail: string
  zone: string
  pace: string
}

export interface WorkoutSuggestion {
  title: string
  subtitle: string
  totalMinutes: number
  rationale: string
  segments: WorkoutSegment[]
  notes: string[]
}

interface WorkoutTemplate {
  title: string
  subtitle: string
  rationale: string
  segments: Array<{
    label: string
    detail: string
    zone: 'E' | 'M' | 'T' | 'I' | 'R'
  }>
  notes: string[]
}

const GOAL_LABELS: Record<GoalFocus, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half Marathon',
  marathon: 'Marathon',
  general: 'General Fitness',
}

function zoneMap(zones: PaceZone[]): Map<string, PaceZone> {
  return new Map(zones.map(z => [z.abbr, z]))
}

function paceFor(abbr: WorkoutTemplate['segments'][number]['zone'], zones: Map<string, PaceZone>): string {
  const zone = zones.get(abbr)
  return zone ? `${zone.minPaceStr} - ${zone.maxPaceStr}` : '--'
}

function racePaceZone(goal: GoalFocus): 'M' | 'T' | 'I' {
  if (goal === 'marathon') return 'M'
  if (goal === 'half') return 'T'
  return 'I'
}

function buildTemplate(type: WorkoutType, minutes: number, goal: GoalFocus): WorkoutTemplate {
  if (type === 'recovery') {
    if (minutes <= 30) {
      return {
        title: 'Recovery Run',
        subtitle: `${minutes} min easy reset`,
        rationale: 'Keep the effort genuinely relaxed so you absorb recent work instead of adding more fatigue.',
        segments: [
          { label: 'Easy Running', detail: `${minutes} min continuous`, zone: 'E' },
        ],
        notes: ['Keep the pace conversational from start to finish.', 'Skip strides today unless your legs feel unusually fresh.'],
      }
    }
    return {
      title: 'Recovery Run',
      subtitle: `${minutes} min aerobic reset`,
      rationale: 'A slightly longer easy run helps you stack volume without turning the day into stealth threshold work.',
      segments: [
        { label: 'Easy Running', detail: `${minutes} min continuous`, zone: 'E' },
      ],
      notes: ['Stay patient early and finish feeling better than you started.', 'If heart rate drifts, slow down instead of forcing the pace.'],
    }
  }

  if (type === 'tempo') {
    if (minutes <= 35) {
      return {
        title: 'Tempo Session',
        subtitle: 'Short threshold builder',
        rationale: `Best when you need a quality session without spending your whole day on it. Useful for ${GOAL_LABELS[goal].toLowerCase()} preparation.`,
        segments: [
          { label: 'Warm-up', detail: '10 min easy', zone: 'E' },
          { label: 'Main Set', detail: '12 min steady threshold', zone: 'T' },
          { label: 'Cool-down', detail: '8 min easy', zone: 'E' },
        ],
        notes: ['Threshold should feel controlled-hard, not like a race.', 'You should be able to hold the pace evenly, not surge it.'],
      }
    }
    if (minutes <= 50) {
      return {
        title: 'Tempo Session',
        subtitle: 'Broken tempo',
        rationale: 'Breaking the threshold block into repeatable chunks gives you the metabolic benefit with a little more control.',
        segments: [
          { label: 'Warm-up', detail: '12 min easy', zone: 'E' },
          { label: 'Main Set', detail: '2 x 10 min with 2 min easy jog', zone: 'T' },
          { label: 'Cool-down', detail: '11 min easy', zone: 'E' },
        ],
        notes: ['The recovery jog should be gentle enough that the second rep still feels smooth.', 'Aim for even pacing across both reps.'],
      }
    }
    if (minutes <= 65) {
      return {
        title: 'Tempo Session',
        subtitle: 'Classic threshold reps',
        rationale: 'This is a durable half-marathon and 10K session that builds the ability to hold strong effort without flooding the legs.',
        segments: [
          { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
          { label: 'Main Set', detail: '3 x 8 min with 2 min easy jog', zone: 'T' },
          { label: 'Cool-down', detail: '15 min easy', zone: 'E' },
        ],
        notes: ['Settle into the first rep instead of attacking it.', 'If you fade late, the pace was too hot.'],
      }
    }
    return {
      title: 'Tempo Session',
      subtitle: 'Extended threshold session',
      rationale: 'A longer threshold session is ideal when you have more time and want one key aerobic-strength workout for the week.',
      segments: [
        { label: 'Warm-up', detail: '20 min easy', zone: 'E' },
        { label: 'Main Set', detail: '4 x 8 min with 2 min easy jog', zone: 'T' },
        { label: 'Cool-down', detail: `${Math.max(10, minutes - 58)} min easy`, zone: 'E' },
      ],
      notes: ['Keep your stride rhythm relaxed; threshold is smooth, not desperate.', 'This session should leave you worked, not wrecked.'],
    }
  }

  if (type === 'vo2') {
    if (minutes <= 35) {
      return {
        title: 'VO2 Max Session',
        subtitle: 'Short sharp intervals',
        rationale: 'A compact top-end session for sharpening speed when time is limited.',
        segments: [
          { label: 'Warm-up', detail: '10 min easy', zone: 'E' },
          { label: 'Main Set', detail: '6 x 1 min with 1 min easy jog', zone: 'I' },
          { label: 'Cool-down', detail: '13 min easy', zone: 'E' },
        ],
        notes: ['The hard reps should feel fast but controlled, not all-out sprinting.', 'Jog the recoveries very easily so the quality stays high.'],
      }
    }
    if (minutes <= 50) {
      return {
        title: 'VO2 Max Session',
        subtitle: '3-minute interval set',
        rationale: `A strong aerobic-power workout for 5K to ${GOAL_LABELS[goal].toLowerCase()} athletes who need more speed economy.`,
        segments: [
          { label: 'Warm-up', detail: '12 min easy', zone: 'E' },
          { label: 'Main Set', detail: '5 x 3 min with 2 min easy jog', zone: 'I' },
          { label: 'Cool-down', detail: '13 min easy', zone: 'E' },
        ],
        notes: ['You should be breathing hard but still running with good mechanics.', 'If the last rep is wildly slower, the first reps were too aggressive.'],
      }
    }
    if (minutes <= 65) {
      return {
        title: 'VO2 Max Session',
        subtitle: 'Extended aerobic-power work',
        rationale: 'A slightly longer interval session helps bridge raw speed and race-specific endurance.',
        segments: [
          { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
          { label: 'Main Set', detail: '6 x 3 min with 2 min easy jog', zone: 'I' },
          { label: 'Cool-down', detail: '18 min easy', zone: 'E' },
        ],
        notes: ['Stay tall and relaxed under fatigue.', 'If you cannot recover enough to hit the next rep, slow the rep pace a touch.'],
      }
    }
    return {
      title: 'VO2 Max Session',
      subtitle: 'Longer interval session',
      rationale: 'Best reserved for sharper phases where one hard session is built around raising aerobic ceiling.',
      segments: [
        { label: 'Warm-up', detail: '20 min easy', zone: 'E' },
        { label: 'Main Set', detail: '5 x 4 min with 2 min easy jog', zone: 'I' },
        { label: 'Cool-down', detail: `${Math.max(12, minutes - 50)} min easy`, zone: 'E' },
      ],
      notes: ['Keep the recoveries honest and light.', 'This session is for quality, not for chasing exhaustion.'],
    }
  }

  if (type === 'long') {
    const progressionZone: 'E' | 'M' | 'T' = goal === 'marathon' ? 'M' : goal === 'half' ? 'T' : 'E'
    if (minutes <= 60) {
      return {
        title: 'Long Aerobic Run',
        subtitle: `${minutes} min steady aerobic`,
        rationale: 'A manageable long-run option that builds endurance without forcing marathon-style fatigue every week.',
        segments: [
          { label: 'Main Run', detail: `${minutes} min easy-steady`, zone: 'E' },
        ],
        notes: ['Keep this mostly aerobic.', 'If you feel great late, let the final 10 minutes naturally tighten.'],
      }
    }
    return {
      title: 'Long Run',
      subtitle: 'Steady finish progression',
      rationale: `This is a race-useful long run that finishes with purpose, especially for ${GOAL_LABELS[goal].toLowerCase()} builds.`,
      segments: [
        { label: 'Easy Block', detail: `${Math.max(35, minutes - 20)} min easy`, zone: 'E' },
        { label: 'Finish Block', detail: `Last 20 min controlled progression`, zone: progressionZone },
      ],
      notes: ['Start slower than you think you need to.', 'The finish block should feel strong and deliberate, not like a time trial.'],
    }
  }

  const paceZone = racePaceZone(goal)
  return {
    title: 'Goal-Pace Session',
    subtitle: `${GOAL_LABELS[goal]} rhythm session`,
    rationale: 'A race-pace themed session helps convert fitness into event-specific confidence and rhythm.',
    segments: [
      { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
      { label: 'Main Set', detail: minutes <= 45 ? '3 x 6 min with 2 min easy jog' : minutes <= 65 ? '4 x 8 min with 2 min easy jog' : '3 x 15 min with 3 min easy jog', zone: paceZone },
      { label: 'Cool-down', detail: minutes <= 45 ? '10 min easy' : '15 min easy', zone: 'E' },
    ],
    notes: ['This should feel like race rhythm, not panic pace.', 'Stay smooth so the session teaches control as much as fitness.'],
  }
}

export function buildWorkoutSuggestion(args: {
  type: WorkoutType
  minutes: number
  goal: GoalFocus
  zones: PaceZone[]
}): WorkoutSuggestion {
  const template = buildTemplate(args.type, args.minutes, args.goal)
  const zones = zoneMap(args.zones)
  return {
    title: template.title,
    subtitle: template.subtitle,
    totalMinutes: args.minutes,
    rationale: template.rationale,
    segments: template.segments.map(segment => ({
      label: segment.label,
      detail: segment.detail,
      zone: segment.zone,
      pace: paceFor(segment.zone, zones),
    })),
    notes: template.notes,
  }
}
