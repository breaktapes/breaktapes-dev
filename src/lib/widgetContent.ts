import React from 'react'

export interface WidgetRelatedAction {
  label: string
  to?: string
  action?: string
  hint?: string
}

export interface WidgetDynamicContext {
  primaryMetric?: { label: string; value: string; color?: string }
  comparisons?: Array<{ label: string; value: string }>
  note?: string
}

export interface WidgetContent {
  id: string
  title: string
  tagline?: string
  whatItIs: string
  howToRead: string
  howItImpactsPerformance: string
  relatedActions?: WidgetRelatedAction[]
  dynamicRenderer?: (ctx: WidgetDynamicContext) => React.ReactNode
}

export const WIDGET_CONTENT: Record<string, WidgetContent> = {
  'stats-strip': {
    id: 'stats-strip',
    title: 'CAREER STATS',
    tagline: 'Your racing at a glance.',
    whatItIs: 'A summary strip of your all-time race stats — total races, distances covered, and top disciplines. Appears at the top of every dashboard view.',
    howToRead: 'Numbers update automatically as you log races. The dominant sport is the one you have the most recorded events in.',
    howItImpactsPerformance: 'Seeing your career totals regularly reinforces identity and consistency. Knowing your numbers means you can set more grounded goals.',
    relatedActions: [
      { label: 'Log a past race', action: 'openAddRace' },
    ],
  },

  'countdown': {
    id: 'countdown',
    title: 'NEXT RACE COUNTDOWN',
    tagline: 'Days, hours, and minutes to the gun.',
    whatItIs: 'A real-time clock to your focus race. Pulls the nearest upcoming event from your calendar, or a race you pinned explicitly. Tap the card to change which race it tracks.',
    howToRead: 'The headline number is whole days out. Hours and minutes tick under it. Once you cross 14 days out, the card shifts into taper mode — a reminder that training volume should be backing down, not peaking.',
    howItImpactsPerformance: 'Race focus works. Athletes who look at their goal race every day make better taper, travel, and nutrition calls than those who treat it as abstract. The countdown is the anchor for every race-day widget above.',
    relatedActions: [
      { label: 'View all upcoming races', action: 'openAllUpcoming' },
      { label: 'Add an upcoming race', action: 'openAddUpcomingRace' },
    ],
  },

  'race-readiness': {
    id: 'race-readiness',
    title: 'RACE READINESS',
    tagline: 'How recovered you are, right now.',
    whatItIs: 'A 0–100 score estimating how fresh you are based on how recently you raced and how demanding that race was. Longer races create longer recovery windows, so the score rises as you move farther from your last hard effort.',
    howToRead: 'READY (85+) means you can hit a hard session or race. BUILDING (50–84) means you are still absorbing recent work — stay steady. UNDERCOOKED (under 50) means back off.',
    howItImpactsPerformance: 'Racing undercooked burns matches you do not have. Tracking readiness across weeks exposes which races you were truly primed for and helps you space hard efforts more intelligently across a season.',
    relatedActions: [
      { label: 'Review recent races', to: '/races' },
    ],
  },

  'gap-to-goal': {
    id: 'gap-to-goal',
    title: 'GAP TO GOAL',
    tagline: 'Your goal time vs. your projected time.',
    whatItIs: 'Compares the goal time you set for your focus race against a live projection based on recent form. Reflects your latest equivalent performances and training trend.',
    howToRead: 'A green gap means your current fitness is inside your goal. A small orange gap (under 60 seconds per 10K) is closable with a good taper and favorable conditions. Wide orange means the goal is a stretch given current form.',
    howItImpactsPerformance: 'Gap-to-goal is the honest check against ambition. A big gap is not a failure — it is a cue to either extend the plan or reset the number. Goal times that ignore current form lead to blow-ups.',
    relatedActions: [
      { label: 'Edit goal time', action: 'openFocusRaceEdit' },
    ],
  },

  'course-fit': {
    id: 'course-fit',
    title: 'COURSE FIT SCORE',
    tagline: 'Does this course suit you?',
    whatItIs: 'A 0–100 score rating how well your focus race course matches your strengths. Weighs your historic performance on similar elevation profiles, surfaces, and distances.',
    howToRead: 'Above 70 is a course that plays to your style. 40–70 is neutral — you can still run well, but margin is thinner. Below 40 is a mismatch: either adjust expectations or use the race to train a weakness.',
    howItImpactsPerformance: 'Every athlete has a shape. Hills, heat, trails, and distance all favor different engines. Matching an A-race to your strengths is the single biggest goal-time decision you make.',
  },

  'pb-probability': {
    id: 'pb-probability',
    title: 'PB PROBABILITY',
    tagline: 'Odds of a personal best.',
    whatItIs: 'A 0–100% estimate of your chance of setting a PB at your focus race. Combines current form, course fit, recency of last PB attempt, and weather when available.',
    howToRead: 'Above 60% is a strong PB window. 30–60% means stars have to align. Under 30% means use the race as a rust-buster or tune-up, not a PB attempt.',
    howItImpactsPerformance: 'PB attempts have an energy cost. Chasing the same PB 4 times a year burns you out. Use this score to pick one A-race per cycle and commit; B-races are practice.',
  },

  'on-this-day': {
    id: 'on-this-day',
    title: 'ON THIS DAY',
    tagline: 'What you raced on this date in past years.',
    whatItIs: 'Surfaces every race you have run on today’s calendar day across your history. Shows the event, distance, and finish time.',
    howToRead: 'If a line appears, you have raced on this exact day before. Compare conditions, pacing, and current form against that memory.',
    howItImpactsPerformance: 'Anniversaries are motivation. Seeing that you ran a marathon PB on this day 3 years ago reframes today’s easy run. It also highlights seasonality — you may race a certain date every year.',
  },

  'goal-pace': {
    id: 'goal-pace',
    title: 'GOAL PACE BREAKDOWN',
    tagline: 'What your goal time means per km.',
    whatItIs: 'Converts the goal time for your focus race into a target pace and splits by distance. Running-only — pace per km is not meaningful for triathlon, cycling, or swim.',
    howToRead: 'The main pace is your average target. Splits below show what hitting the goal looks like at 5K, 10K, half, and full distance. Treat the last 25% as the one to protect.',
    howItImpactsPerformance: 'Racing is executing a pace, not hitting a time. Memorizing the split targets makes split-by-split decisions simple on race day.',
    relatedActions: [
      { label: 'Edit goal time', action: 'openFocusRaceEdit' },
    ],
  },

  'recent-races': {
    id: 'recent-races',
    title: 'RECENT RACES',
    tagline: 'Your last five results.',
    whatItIs: 'A reverse-chronological list of your five most recent races with finish time, distance, and date. Excludes DNFs unless they are your only recent data.',
    howToRead: 'Look for a consistency signal: all times moving the same direction is a trend. Alternating big and small distances hide the real story — filter by distance if needed.',
    howItImpactsPerformance: 'Recent results are the single best predictor of next results. Training tells you what you are building; recent races tell you what actually fires under pressure.',
    relatedActions: [
      { label: 'Open races page', to: '/races' },
    ],
  },

  'personal-bests': {
    id: 'personal-bests',
    title: 'PERSONAL BESTS',
    tagline: 'Your fastest time at every distance.',
    whatItIs: 'Your PB at each common distance (5K, 10K, Half, Marathon, plus triathlon distances). Tap a card to open the race that set the PB.',
    howToRead: 'PBs cluster by age and training block. A PB set more than 3 years ago is a ceiling you have drifted from; a PB set this season is your current ceiling.',
    howItImpactsPerformance: 'PBs are the numbers that come up in every conversation about your running. Watching them move is the clearest evidence that training is working — or that it is not.',
  },

  'season-planner': {
    id: 'season-planner',
    title: 'SEASON PLANNER',
    tagline: '90-day race lineup with taper and recovery.',
    whatItIs: 'A forward-looking view of every race on your calendar for the next 90 days. Marks A/B/C priorities, required taper days, and recovery windows between races.',
    howToRead: 'A-races get 2–3 weeks of taper and recovery. B-races get 1 week on each side. C-races are training reps, not events. Warnings appear when two high-priority races are less than 21 days apart.',
    howItImpactsPerformance: 'Stacked races cost more than they return. A good plan protects your A-race and demotes the races around it. Bad plans treat every race equally and lead to a mediocre season.',
    relatedActions: [
      { label: 'Open Season Planner', to: '/races' },
      { label: 'Add an upcoming race', action: 'openAddUpcomingRace' },
    ],
  },

  'boston-qual': {
    id: 'boston-qual',
    title: 'BOSTON QUALIFIER',
    tagline: 'Your gap to the BAA standard.',
    whatItIs: 'Tracks your fastest marathon inside the current Boston qualifying window against the BAA standard for your age and gender. Also shows a safe-buffer time roughly 7 minutes faster — the margin accepted applicants have historically needed.',
    howToRead: 'A green gap means you have met the standard. Safely-in-buffer green means you have beaten the cutoff by enough to clear the acceptance cut. Orange means you are still chasing.',
    howItImpactsPerformance: 'Boston is capped. Meeting the standard does not guarantee a bib. Track the buffer, not just the standard. A standard-only time should trigger a second qualifier before the window closes.',
    relatedActions: [
      { label: 'View all marathons', to: '/races' },
      { label: 'Find next qualifier', to: '/discover' },
    ],
  },

  'pacing-iq': {
    id: 'pacing-iq',
    title: 'PACING IQ',
    tagline: 'Your rhythm across every logged race — 10-class analysis.',
    whatItIs: 'Classifies every race with 4+ splits into one of 10 pacing patterns: EVEN STEADY (metronome), NEGATIVE SPLITTER (closed faster), NEGATIVE KICKER (held back then kicked), MILD FADER, CLASSIC FADER, CRASH FADER, HOT START (out too hard), SURGER (roller-coaster), SLOW BUILDER (cold start, strong close), or CONSERVATIVE (sandbagger). Your dominant label is the class that appears most often. A secondary tendency surfaces when another class hits 25%+.',
    howToRead: 'Primary persona = what you do most. Secondary = your second-most-common pattern (only shown if it covers 25%+ of races). Each class has a tailored coaching prescription based on the start/middle/end pace dynamics. The full breakdown bars in the Large view show every class you have ever exhibited with race counts.',
    howItImpactsPerformance: 'Even pacing is the most efficient. Faders leak 30s–2min on typical marathons; hot starters guarantee a crash. The 10-class model surfaces start-side problems (HOT START, CONSERVATIVE, SLOW BUILDER) that the old 3-class FADER/EVEN/NEG model missed entirely. Combination patterns like CLASSIC FADER + HOT START point to start-discipline issues; CRASH FADER + HOT START means your goal pace is too aggressive.',
    relatedActions: [
      { label: 'See races with splits', to: '/races' },
    ],
  },

  'career-momentum': {
    id: 'career-momentum',
    title: 'CAREER MOMENTUM',
    tagline: 'Are you trending up or flat?',
    whatItIs: 'A 0–1 score weighing your most recent race equivalents against your lifetime bests. Badges: HOT (setting new equivalents), RISING (recent results trending up), NEUTRAL (steady state), BACK (softer than norm).',
    howToRead: 'Above 0.7 means you are in PB-attempt territory. Between 0.4 and 0.7 means fitness is intact but not improving. Below 0.4 means something is off — illness, overtraining, life stress, or a long build that has not paid off yet.',
    howItImpactsPerformance: 'Momentum forecasts PB probability. Pair a HOT badge with a flat, cool course in your Season Planner and you have a goal race. A BACK badge is a signal to rest or restructure — not a call for a time trial.',
  },

  'age-grade': {
    id: 'age-grade',
    title: 'AGE-GRADE SCORE',
    tagline: 'Your times vs. the world record for your age.',
    whatItIs: 'Age-grading (World Athletics tables) expresses every race time as a percentage of the world-record time for your exact age and gender. A 20:00 5K at age 42 and the same time at age 22 score very differently.',
    howToRead: '60% is regional-class. 70% is national-class. 80% is world-class. Your score climbs any time you race faster than the age-curve predicts, and will naturally drift up with age if your fitness holds steady.',
    howItImpactsPerformance: 'Use age-grade to pick goal races: a recent age-grade PB at 10K suggests reaching for a matching half-marathon age-grade on your next long race. It is the best single answer to how good a race really was.',
  },

  'race-dna': {
    id: 'race-dna',
    title: 'RACE DNA',
    tagline: 'Your racing pattern across conditions.',
    whatItIs: 'Aggregates every race’s weather, surface, and elevation alongside your placing and time. Reveals which conditions you race best and worst in.',
    howToRead: 'The top condition is your sweet spot — cool, flat, road, morning start. The bottom condition is your weakness. Race DNA updates continuously as new races are logged.',
    howItImpactsPerformance: 'DNA makes race selection strategic. Chasing PBs in your weakness conditions is expensive. Prioritize A-races that match your DNA; use off-DNA races for development.',
  },

  'pressure-performer': {
    id: 'pressure-performer',
    title: 'PRESSURE PERFORMER',
    tagline: 'How you race when it counts.',
    whatItIs: 'Compares your A-race finishes against your B- and C-race finishes at the same distance. Scores whether the stakes help or hurt you.',
    howToRead: 'A green score means you race faster when it matters. Neutral means you perform the same regardless of stakes. Orange means the pressure costs you.',
    howItImpactsPerformance: 'Pressure performers should pick one big A-race per cycle and lean into it. Neutral athletes should race more often and treat every race similarly. Pressure-sensitive athletes need B-races as dress rehearsals.',
  },

  'travel-load': {
    id: 'travel-load',
    title: 'TRAVEL LOAD',
    tagline: 'How distance-from-home affects you.',
    whatItIs: 'Groups your races by travel distance (local, regional, international) and compares performance against your PB for each bucket.',
    howToRead: 'A tight gap across buckets means travel is neutral for you. A meaningful drop on long-haul races means jet lag, sleep disruption, or unfamiliar conditions are costing you time.',
    howItImpactsPerformance: 'Travel has a real pace cost for most runners. If long-haul races are 2–3% slower for you, either arrive 5+ days early or keep A-races regional.',
  },

  'pattern-scan': {
    id: 'pattern-scan',
    title: 'PATTERN SCAN',
    tagline: 'Hidden trends across your race history.',
    whatItIs: 'A deeper analytical pass over your entire race log. Looks for comeback races after gaps, seasonal patterns, recurring distances, and repeat-course improvements.',
    howToRead: 'Each tag is a specific signal the scan found. Tags are ranked by confidence. Tap EXPLAIN WITH AI for a narrative summary of the top patterns.',
    howItImpactsPerformance: 'Patterns are the training plan writing itself. Seeing that you always PR after a 2-week gap tells you something no coach can infer without your data.',
  },

  'race-comparer': {
    id: 'race-comparer',
    title: 'RACE COMPARER',
    tagline: 'Two of your races, side by side.',
    whatItIs: 'A tool for comparing any two races in your history across time, splits, weather, and course profile.',
    howToRead: 'The left race is your baseline, the right race is the one you want to understand. Green deltas are improvements, orange deltas are regressions.',
    howItImpactsPerformance: 'Comparing a PB race against a fade race is the fastest way to isolate what you did differently. Splits, weather, and recovery all show up clearly.',
  },

  'what-to-race-next': {
    id: 'what-to-race-next',
    title: 'WHAT TO RACE NEXT',
    tagline: 'Recommended next race for your current form.',
    whatItIs: 'Suggests your next race based on Race DNA, current form, and calendar. Filters from the race catalog for events that match your sweet spot.',
    howToRead: 'The top suggestion is highest-confidence. Alternatives below trade off travel, timing, or course for fit. Each suggestion shows predicted finish time.',
    howItImpactsPerformance: 'Most runners pick races by what sounds exciting. Picking by fit is how you actually PR more often.',
  },

  'riegel-predictor': {
    id: 'riegel-predictor',
    title: 'RACE PREDICTOR',
    tagline: 'Riegel-formula predictions at every distance.',
    whatItIs: 'Uses the Riegel formula (T2 = T1 × (D2/D1)^1.06) against your current best performance to project finish times at other distances. One of the most-validated endurance prediction methods.',
    howToRead: 'The source race sets the anchor. Predicted times at other distances assume you apply similar training specificity — a 5K PB does not predict a marathon without marathon-specific training.',
    howItImpactsPerformance: 'Great for goal-setting. If your current 10K predicts a 3:05 marathon but you are training for 2:55, the gap tells you the marathon is aspirational unless form improves.',
    relatedActions: [
      { label: 'Set a goal race', action: 'openAddUpcomingRace' },
    ],
  },

  'tri-predictor': {
    id: 'tri-predictor',
    title: 'TRIATHLON PREDICTOR',
    tagline: 'Swim/bike/run splits + finish for your next tri.',
    whatItIs: 'Projects swim, T1, bike, T2 and run splits plus total finish time for a Sprint, Olympic, 70.3 or IRONMAN. It Riegel-projects each leg from your own recent triathlon splits (recency-weighted), falling back to your running PB for the run leg when you have no tri history yet.',
    howToRead: 'Pick a target distance with the selector. The big number is the projected finish, with a confidence range below it. Per-leg bars show how each discipline contributes. The "% from your data" note tells you how much the estimate leans on your real races versus the model — it widens the range when you have little data or are projecting across distances.',
    howItImpactsPerformance: 'Triathlon pacing is leg-dependent and degrades under brick fatigue. Predicting each split from your own race history (not fresh time trials) bakes in your real race execution, so the targets are grounded. Use it to set a finish goal and pace each leg.',
    relatedActions: [
      { label: 'Set a goal race', action: 'openAddUpcomingRace' },
    ],
  },

  'distance-milestones': {
    id: 'distance-milestones',
    title: 'DISTANCE MILESTONES',
    tagline: 'Cumulative distance by type.',
    whatItIs: 'Total kilometers raced at each distance — 5Ks, 10Ks, halfs, marathons, ultras. DNFs excluded.',
    howToRead: 'The bars show race volume, not training. A deep marathon total with no 5Ks tells a different story than the reverse. Each milestone (100K raced, 1000K raced) is marked.',
    howItImpactsPerformance: 'Experience matters at a distance. Most runners need 3–4 marathons before they race it well. Milestones show how much experience you have banked.',
  },

  'course-repeats': {
    id: 'course-repeats',
    title: 'COURSE REPEATS',
    tagline: 'How you improve on courses you have run before.',
    whatItIs: 'Identifies races where you have competed multiple times at the same event and shows the time trend across attempts.',
    howToRead: 'A descending time trend on a repeat course is a clean fitness signal — same course, same distance, faster time. Flat or ascending trends are a flag for stalled progress.',
    howItImpactsPerformance: 'Repeat courses are the cleanest experiment in your training. They remove course-variability and isolate fitness. If you can PR on a course you have run before, you are genuinely faster.',
  },
}

export function getWidgetContent(id: string): WidgetContent {
  return WIDGET_CONTENT[id] ?? fallbackContent(id)
}

function fallbackContent(id: string): WidgetContent {
  const title = id.replace(/-/g, ' ').toUpperCase()
  return {
    id,
    title,
    whatItIs: 'This widget does not have authored copy yet.',
    howToRead: 'Explore the card to see what data it shows.',
    howItImpactsPerformance: 'Documentation coming in a future update.',
  }
}

export function hasAuthoredContent(id: string): boolean {
  return id in WIDGET_CONTENT
}
