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
  id: string
  title: string
  subtitle: string
  totalMinutes: number
  rationale: string
  segments: WorkoutSegment[]
  notes: string[]
}

interface WorkoutTemplate {
  id: string
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

function withId(id: string, template: Omit<WorkoutTemplate, 'id'>): WorkoutTemplate {
  return { id, ...template }
}

function racePaceZone(goal: GoalFocus): 'M' | 'T' | 'I' {
  if (goal === 'marathon') return 'M'
  if (goal === 'half') return 'T'
  return 'I'
}

function buildTemplates(type: WorkoutType, minutes: number, goal: GoalFocus): WorkoutTemplate[] {
  if (type === 'recovery') {
    if (minutes <= 30) {
      return [withId('recovery_continuous', {
        title: 'Recovery Run',
        subtitle: `${minutes} min easy reset`,
        rationale: 'Keep the effort genuinely relaxed so you absorb recent work instead of adding more fatigue.',
        segments: [
          { label: 'Easy Running', detail: `${minutes} min continuous`, zone: 'E' },
        ],
        notes: ['Keep the pace conversational from start to finish.', 'Skip strides today unless your legs feel unusually fresh.'],
      })]
    }
    return [
      withId('recovery_continuous', {
        title: 'Recovery Run',
        subtitle: `${minutes} min aerobic reset`,
        rationale: 'A slightly longer easy run helps you stack volume without turning the day into stealth threshold work.',
        segments: [
          { label: 'Easy Running', detail: `${minutes} min continuous`, zone: 'E' },
        ],
        notes: ['Stay patient early and finish feeling better than you started.', 'If heart rate drifts, slow down instead of forcing the pace.'],
      }),
      withId('recovery_strides', {
        title: 'Recovery + Strides',
        subtitle: `${minutes} min easy with form work`,
        rationale: 'Adds a small touch of mechanics and cadence work without turning the day into a hard session.',
        segments: [
          { label: 'Easy Running', detail: `${Math.max(20, minutes - 8)} min easy`, zone: 'E' },
          { label: 'Strides', detail: '6 x 20 sec smooth fast strides with full easy jog back', zone: 'R' },
          { label: 'Cool-down', detail: '5 min easy jog', zone: 'E' },
        ],
        notes: ['The strides should feel quick and relaxed, not sprinted.', 'If you feel flat or sore, pick the plain recovery run instead.'],
      }),
    ]
  }

  if (type === 'tempo') {
    if (minutes <= 35) {
      return [withId('tempo_short_steady', {
        title: 'Tempo Session',
        subtitle: 'Short threshold builder',
        rationale: `Best when you need a quality session without spending your whole day on it. Useful for ${GOAL_LABELS[goal].toLowerCase()} preparation.`,
        segments: [
          { label: 'Warm-up', detail: '10 min easy', zone: 'E' },
          { label: 'Main Set', detail: '12 min steady threshold', zone: 'T' },
          { label: 'Cool-down', detail: '8 min easy', zone: 'E' },
        ],
        notes: ['Threshold should feel controlled-hard, not like a race.', 'You should be able to hold the pace evenly, not surge it.'],
      })]
    }
    if (minutes <= 50) {
      return [
        withId('tempo_broken', {
          title: 'Tempo Session',
          subtitle: 'Broken tempo',
          rationale: 'Breaking the threshold block into repeatable chunks gives you the metabolic benefit with a little more control.',
          segments: [
            { label: 'Warm-up', detail: '12 min easy', zone: 'E' },
            { label: 'Main Set', detail: '2 x 10 min with 2 min easy jog', zone: 'T' },
            { label: 'Cool-down', detail: '11 min easy', zone: 'E' },
          ],
          notes: ['The recovery jog should be gentle enough that the second rep still feels smooth.', 'Aim for even pacing across both reps.'],
        }),
        withId('tempo_cruise', {
          title: 'Cruise Intervals',
          subtitle: 'Threshold in smaller bites',
          rationale: 'Cruise intervals let you accumulate threshold time while keeping each rep mentally manageable.',
          segments: [
            { label: 'Warm-up', detail: '12 min easy', zone: 'E' },
            { label: 'Main Set', detail: '4 x 5 min with 75 sec easy jog', zone: 'T' },
            { label: 'Cool-down', detail: '14 min easy', zone: 'E' },
          ],
          notes: ['Keep each rep controlled from the first minute.', 'The goal is rhythm and repeatability, not hero pacing.'],
        }),
      ]
    }
    if (minutes <= 65) {
      return [
        withId('tempo_classic', {
          title: 'Tempo Session',
          subtitle: 'Classic threshold reps',
          rationale: 'This is a durable half-marathon and 10K session that builds the ability to hold strong effort without flooding the legs.',
          segments: [
            { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
            { label: 'Main Set', detail: '3 x 8 min with 2 min easy jog', zone: 'T' },
            { label: 'Cool-down', detail: '15 min easy', zone: 'E' },
          ],
          notes: ['Settle into the first rep instead of attacking it.', 'If you fade late, the pace was too hot.'],
        }),
        withId('tempo_progression', {
          title: 'Progression Tempo',
          subtitle: 'Steady build into threshold',
          rationale: 'A progression session is useful when you want threshold benefits with a more natural race-like feel.',
          segments: [
            { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
            { label: 'Build', detail: '10 min steady marathon effort', zone: 'M' },
            { label: 'Threshold Block', detail: '12 min controlled threshold', zone: 'T' },
            { label: 'Cool-down', detail: '15 min easy', zone: 'E' },
          ],
          notes: ['Let the pace come to you gradually.', 'You should finish feeling strong rather than hanging on.'],
        }),
      ]
    }
    return [
      withId('tempo_extended', {
        title: 'Tempo Session',
        subtitle: 'Extended threshold session',
        rationale: 'A longer threshold session is ideal when you have more time and want one key aerobic-strength workout for the week.',
        segments: [
          { label: 'Warm-up', detail: '20 min easy', zone: 'E' },
          { label: 'Main Set', detail: '4 x 8 min with 2 min easy jog', zone: 'T' },
          { label: 'Cool-down', detail: `${Math.max(10, minutes - 58)} min easy`, zone: 'E' },
        ],
        notes: ['Keep your stride rhythm relaxed; threshold is smooth, not desperate.', 'This session should leave you worked, not wrecked.'],
      }),
      withId('tempo_continuous', {
        title: 'Continuous Tempo',
        subtitle: 'Long threshold block',
        rationale: 'A single long threshold block is simple, specific, and excellent for sustained-rhythm development.',
        segments: [
          { label: 'Warm-up', detail: '20 min easy', zone: 'E' },
          { label: 'Main Set', detail: '25 min continuous threshold', zone: 'T' },
          { label: 'Cool-down', detail: `${Math.max(10, minutes - 45)} min easy`, zone: 'E' },
        ],
        notes: ['Think smooth and locked-in from the first five minutes.', 'Back off slightly if the session starts to feel like a race.'],
      }),
    ]
  }

  if (type === 'vo2') {
    if (minutes <= 35) {
      return [withId('vo2_short', {
        title: 'VO2 Max Session',
        subtitle: 'Short sharp intervals',
        rationale: 'A compact top-end session for sharpening speed when time is limited.',
        segments: [
          { label: 'Warm-up', detail: '10 min easy', zone: 'E' },
          { label: 'Main Set', detail: '6 x 1 min with 1 min easy jog', zone: 'I' },
          { label: 'Cool-down', detail: '13 min easy', zone: 'E' },
        ],
        notes: ['The hard reps should feel fast but controlled, not all-out sprinting.', 'Jog the recoveries very easily so the quality stays high.'],
      })]
    }
    if (minutes <= 50) {
      return [
        withId('vo2_3min', {
          title: 'VO2 Max Session',
          subtitle: '3-minute interval set',
          rationale: `A strong aerobic-power workout for 5K to ${GOAL_LABELS[goal].toLowerCase()} athletes who need more speed economy.`,
          segments: [
            { label: 'Warm-up', detail: '12 min easy', zone: 'E' },
            { label: 'Main Set', detail: '5 x 3 min with 2 min easy jog', zone: 'I' },
            { label: 'Cool-down', detail: '13 min easy', zone: 'E' },
          ],
          notes: ['You should be breathing hard but still running with good mechanics.', 'If the last rep is wildly slower, the first reps were too aggressive.'],
        }),
        withId('vo2_2min', {
          title: 'VO2 Max Session',
          subtitle: 'Shorter aerobic-power reps',
          rationale: 'Shorter reps let you hit VO2 pace more confidently while keeping posture and mechanics tidy.',
          segments: [
            { label: 'Warm-up', detail: '12 min easy', zone: 'E' },
            { label: 'Main Set', detail: '7 x 2 min with 90 sec easy jog', zone: 'I' },
            { label: 'Cool-down', detail: '12 min easy', zone: 'E' },
          ],
          notes: ['Run these with quick cadence and relaxed shoulders.', 'The recoveries should let you reset, not fully rest.'],
        }),
      ]
    }
    if (minutes <= 65) {
      return [
        withId('vo2_extended', {
          title: 'VO2 Max Session',
          subtitle: 'Extended aerobic-power work',
          rationale: 'A slightly longer interval session helps bridge raw speed and race-specific endurance.',
          segments: [
            { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
            { label: 'Main Set', detail: '6 x 3 min with 2 min easy jog', zone: 'I' },
            { label: 'Cool-down', detail: '18 min easy', zone: 'E' },
          ],
          notes: ['Stay tall and relaxed under fatigue.', 'If you cannot recover enough to hit the next rep, slow the rep pace a touch.'],
        }),
        withId('vo2_ladder', {
          title: 'VO2 Ladder',
          subtitle: 'Aerobic-power ladder session',
          rationale: 'A ladder session changes the mental rhythm while still spending quality time near VO2 work.',
          segments: [
            { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
            { label: 'Main Set', detail: '2 min / 3 min / 4 min / 3 min / 2 min with equal easy jog recoveries', zone: 'I' },
            { label: 'Cool-down', detail: '18 min easy', zone: 'E' },
          ],
          notes: ['Use the same controlled VO2 effort across the ladder.', 'Don’t turn the short reps into sprints.'],
        }),
      ]
    }
    return [
      withId('vo2_long', {
        title: 'VO2 Max Session',
        subtitle: 'Longer interval session',
        rationale: 'Best reserved for sharper phases where one hard session is built around raising aerobic ceiling.',
        segments: [
          { label: 'Warm-up', detail: '20 min easy', zone: 'E' },
          { label: 'Main Set', detail: '5 x 4 min with 2 min easy jog', zone: 'I' },
          { label: 'Cool-down', detail: `${Math.max(12, minutes - 50)} min easy`, zone: 'E' },
        ],
        notes: ['Keep the recoveries honest and light.', 'This session is for quality, not for chasing exhaustion.'],
      }),
      withId('vo2_combo', {
        title: 'VO2 Combo Session',
        subtitle: 'Mixed-length aerobic-power work',
        rationale: 'A mixed session gives you a slightly different neuromuscular feel while preserving the same training objective.',
        segments: [
          { label: 'Warm-up', detail: '20 min easy', zone: 'E' },
          { label: 'Main Set', detail: '3 x 4 min, then 4 x 1 min with equal easy jog recoveries', zone: 'I' },
          { label: 'Cool-down', detail: `${Math.max(10, minutes - 48)} min easy`, zone: 'E' },
        ],
        notes: ['Run the short reps with control, not panic speed.', 'If the long reps are too hard, reduce pace slightly before adding more effort.'],
      }),
    ]
  }

  if (type === 'long') {
    const progressionZone: 'E' | 'M' | 'T' = goal === 'marathon' ? 'M' : goal === 'half' ? 'T' : 'E'
    if (minutes <= 60) {
      return [withId('long_aerobic', {
        title: 'Long Aerobic Run',
        subtitle: `${minutes} min steady aerobic`,
        rationale: 'A manageable long-run option that builds endurance without forcing marathon-style fatigue every week.',
        segments: [
          { label: 'Main Run', detail: `${minutes} min easy-steady`, zone: 'E' },
        ],
        notes: ['Keep this mostly aerobic.', 'If you feel great late, let the final 10 minutes naturally tighten.'],
      })]
    }
    return [
      withId('long_progression', {
        title: 'Long Run',
        subtitle: 'Steady finish progression',
        rationale: `This is a race-useful long run that finishes with purpose, especially for ${GOAL_LABELS[goal].toLowerCase()} builds.`,
        segments: [
          { label: 'Easy Block', detail: `${Math.max(35, minutes - 20)} min easy`, zone: 'E' },
          { label: 'Finish Block', detail: 'Last 20 min controlled progression', zone: progressionZone },
        ],
        notes: ['Start slower than you think you need to.', 'The finish block should feel strong and deliberate, not like a time trial.'],
      }),
      withId('long_chunks', {
        title: 'Long Run with Pace Chunks',
        subtitle: 'Alternating long-run rhythm',
        rationale: 'Alternating easy running with controlled pace chunks keeps a long run mentally engaging and race useful.',
        segments: [
          { label: 'Easy Start', detail: `${Math.max(25, minutes - 30)} min easy`, zone: 'E' },
          { label: 'Main Set', detail: '3 x 8 min with 3 min easy float', zone: progressionZone },
          { label: 'Cool-down', detail: '5 min easy', zone: 'E' },
        ],
        notes: ['Treat the pace chunks as controlled, not all-out.', 'Keep the easy floats genuinely easy so the session stays aerobic-first.'],
      }),
    ]
  }

  const paceZone = racePaceZone(goal)
  return [
    withId('racepace_reps', {
      title: 'Goal-Pace Session',
      subtitle: `${GOAL_LABELS[goal]} rhythm session`,
      rationale: 'A race-pace themed session helps convert fitness into event-specific confidence and rhythm.',
      segments: [
        { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
        { label: 'Main Set', detail: minutes <= 45 ? '3 x 6 min with 2 min easy jog' : minutes <= 65 ? '4 x 8 min with 2 min easy jog' : '3 x 15 min with 3 min easy jog', zone: paceZone },
        { label: 'Cool-down', detail: minutes <= 45 ? '10 min easy' : '15 min easy', zone: 'E' },
      ],
      notes: ['This should feel like race rhythm, not panic pace.', 'Stay smooth so the session teaches control as much as fitness.'],
    }),
    withId('racepace_continuous', {
      title: 'Goal-Pace Progression',
      subtitle: `${GOAL_LABELS[goal]} steady build`,
      rationale: 'A progression version lets you arrive at race pace under control instead of jumping into it cold.',
      segments: [
        { label: 'Warm-up', detail: '15 min easy', zone: 'E' },
        { label: 'Build Block', detail: '10 min marathon effort', zone: 'M' },
        { label: 'Race Pace Block', detail: minutes <= 45 ? '12 min continuous' : minutes <= 65 ? '18 min continuous' : '25 min continuous', zone: paceZone },
        { label: 'Cool-down', detail: '12 min easy', zone: 'E' },
      ],
      notes: ['Build into race pace rather than forcing it early.', 'You should finish with control and rhythm still intact.'],
    }),
  ]
}

function buildSuggestion(template: WorkoutTemplate, minutes: number, zones: Map<string, PaceZone>): WorkoutSuggestion {
  return {
    id: template.id,
    title: template.title,
    subtitle: template.subtitle,
    totalMinutes: minutes,
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

export function buildWorkoutSuggestion(args: {
  type: WorkoutType
  minutes: number
  goal: GoalFocus
  zones: PaceZone[]
}): WorkoutSuggestion {
  return buildWorkoutSuggestions(args)[0]
}

export function buildWorkoutSuggestions(args: {
  type: WorkoutType
  minutes: number
  goal: GoalFocus
  zones: PaceZone[]
}): WorkoutSuggestion[] {
  const templates = buildTemplates(args.type, args.minutes, args.goal)
  const zones = zoneMap(args.zones)
  return templates.map(template => buildSuggestion(template, args.minutes, zones))
}
