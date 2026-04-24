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

  'race-forecast': {
    id: 'race-forecast',
    title: 'RACE DAY FORECAST',
    tagline: 'Weather at the start line.',
    whatItIs: 'Hourly forecast for your focus race location on race morning, pulled from Open-Meteo. Shows temperature, feels-like, wind, humidity, and conditions from the scheduled start hour forward.',
    howToRead: 'Temperatures in the 10–15°C range are fastest for most runners. Above 20°C expect meaningful slowdown. Humidity over 70% compounds the heat penalty. Wind above 15 km/h means dig in for effort, not pace.',
    howItImpactsPerformance: 'Temperature changes your race plan, not just your kit. A 25°C forecast at a goal marathon means starting 8–12 seconds per km slower than PB pace and drinking at every aid station. Knowing the forecast a week out lets you adapt.',
  },

  'race-prediction': {
    id: 'race-prediction',
    title: 'RACE PREDICTION',
    tagline: 'Model-estimated finish time.',
    whatItIs: 'A projected finish time for your focus race based on recent equivalent performances, course profile, and weather. Updates as new training activities and races are logged.',
    howToRead: 'The prediction is a midpoint, not a ceiling. The range underneath shows the 10th–90th percentile of likely outcomes given your current form. Tight range = consistent recent racing. Wide range = less data or mixed signals.',
    howItImpactsPerformance: 'Use the prediction to set an honest goal, not an aspirational one. Starting a marathon at a predicted pace will beat starting at a dream pace almost every time. If the prediction is faster than your goal, raise your ceiling.',
  },

  'race-readiness': {
    id: 'race-readiness',
    title: 'RACE READINESS',
    tagline: 'How recovered you are, right now.',
    whatItIs: 'A 0–100 score estimating how fresh your body is today. When WHOOP is connected, it uses your latest WHOOP recovery score directly. Without wearable data, it derives a number from how recently you raced and how demanding that race was.',
    howToRead: 'READY (85+) means you can hit a hard session or race. BUILDING (50–84) means you are still absorbing recent work — stay steady. UNDERCOOKED (under 50) means back off.',
    howItImpactsPerformance: 'Racing undercooked burns matches you do not have. Tracking readiness across weeks exposes which races you were truly primed for, and correlates tightly with your PB vs. fade pattern in Pacing IQ.',
    relatedActions: [
      { label: 'Connect a wearable', to: '/settings' },
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

  'weather-fit': {
    id: 'weather-fit',
    title: 'WEATHER FIT SCORE',
    tagline: 'How your body handles the forecast conditions.',
    whatItIs: 'Scores race-day weather against your historical performance in similar conditions. Uses your archived race weather to identify which temperatures, humidity, and wind you race best in.',
    howToRead: 'High green score means the forecast matches your best conditions. Orange means you have struggled in this weather before. Red means consider adjusting target pace or hydration strategy.',
    howItImpactsPerformance: 'Knowing you run poorly in cold + windy conditions is more useful than any taper tweak. Weather Fit tells you when to aim and when to survive.',
  },

  'race-stack': {
    id: 'race-stack',
    title: 'RACE STACK PLANNER',
    tagline: 'Your race-week checklist.',
    whatItIs: 'A structured prep plan for race week — nutrition, sleep, kit, travel, pace strategy, pacing aids. Adapts to distance and priority (A/B/C).',
    howToRead: 'Each line is a checkbox. Work top-down from 7 days out to race morning. Green check = done. Orange = in progress. Blank = not yet.',
    howItImpactsPerformance: 'Most blow-ups trace to skipped week-of basics: undercarb, poor sleep, wrong shoes, late travel. A written stack beats memory every time.',
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

  'activity-preview': {
    id: 'activity-preview',
    title: 'ACTIVITY FEED',
    tagline: 'Your latest training sessions.',
    whatItIs: 'A merged feed of your most recent activities from Strava and WHOOP. Shows sport, name, duration, and distance. Sorted newest first.',
    howToRead: 'Use the feed to spot weekly rhythm: three easy + one quality is a canonical week. Gaps longer than 4 days without a run deserve a reason (rest, sickness, travel).',
    howItImpactsPerformance: 'Consistency beats volume. The feed is the scoreboard that tells you whether your week actually matched the plan.',
    relatedActions: [
      { label: 'Connect Strava or WHOOP', to: '/settings' },
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

  'why-prd': {
    id: 'why-prd',
    title: "WHY YOU PR'D",
    tagline: 'The factors behind your latest breakthrough.',
    whatItIs: 'An AI-generated breakdown of why your most recent PB happened. Weighs training load, recovery, weather, pacing, and course versus prior attempts.',
    howToRead: 'Read the top two factors as repeatable and the bottom two as lucky. You cannot control weather next time; you can control pacing.',
    howItImpactsPerformance: 'PBs are signals, not accidents. Understanding the repeatable causes means the next PB is closer than the last one.',
  },

  'why-faded': {
    id: 'why-faded',
    title: 'WHY YOU FADED',
    tagline: 'What went wrong in your last bad race.',
    whatItIs: 'An AI-generated breakdown of your most recent poor race. Looks at starting pace, weather, training gaps, and stress around the race date.',
    howToRead: 'The top factor is your controllable lesson. Secondary factors are supporting evidence. If the top factor is pacing, that is the target for your next A-race.',
    howItImpactsPerformance: 'Bad races are free training data. Ignoring them compounds the mistake; studying them prevents the repeat.',
  },

  'break-tape': {
    id: 'break-tape',
    title: 'BREAK TAPE MOMENTS',
    tagline: 'Races where you crossed a threshold.',
    whatItIs: 'Surfaces races where you broke a round-number barrier for the first time (sub-40 10K, sub-3 marathon, sub-90 half). The symbolic moments of your running life.',
    howToRead: 'Each entry is a milestone date and the race that earned it. Use them to narrate your arc to new training partners, coaches, or yourself.',
    howItImpactsPerformance: 'Progress is invisible inside the grind. Break-tape moments remind you where you were a year or five years ago — and where the next threshold is.',
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

  'recovery-intel': {
    id: 'recovery-intel',
    title: 'RECOVERY INTELLIGENCE',
    tagline: 'How recovered you are from your last race.',
    whatItIs: 'A post-race recovery tracker. Uses distance and effort of your last race to estimate recovery days needed. With wearable data connected, adjusts to live recovery and load numbers.',
    howToRead: 'The top number is days remaining on your recovery clock. When it hits zero, you are cleared for full training again. If you are training hard before zero, expect reduced adaptation.',
    howItImpactsPerformance: 'Recovery is where fitness is made, not lost. Skipping the window compresses progress and raises injury risk. Respecting it is the single cheapest performance decision.',
    relatedActions: [
      { label: 'Connect a wearable', to: '/settings' },
    ],
  },

  'race-density': {
    id: 'race-density',
    title: 'RACE DENSITY',
    tagline: 'How often you race.',
    whatItIs: 'A rolling 90-day view of your race frequency. Flags clusters where three or more races happen inside a 30-day window.',
    howToRead: 'Green density means well-spaced races. Orange means you are racing more often than a typical training cycle supports. Red means you are treating races as workouts — which is fine for C-races, not A-races.',
    howItImpactsPerformance: 'Races drain more than they train. Too many races in a window leaves no time for the long, easy work that builds the engine.',
  },

  'streak-risk': {
    id: 'streak-risk',
    title: 'STREAK RISK',
    tagline: 'Your training streak and overtraining score.',
    whatItIs: 'Tracks your current run streak and weighs it against load, sleep, and recent race effort to flag overtraining risk.',
    howToRead: 'Streaks are motivating but load-blind. When the risk score goes orange, the streak is doing more damage than good. Take a day off.',
    howItImpactsPerformance: 'Injury is the most expensive mistake in endurance sport. A calculated rest day protects six months of fitness.',
  },

  'training-correl': {
    id: 'training-correl',
    title: 'TRAINING CORRELATION',
    tagline: 'How training volume maps to race results.',
    whatItIs: 'Correlates your 42-day pre-race training load (from Strava) against each race’s performance delta vs. PB. Needs at least 3 data points.',
    howToRead: 'A positive slope means more volume leads to better results for you. A flat line means volume is not the bottleneck — look at quality, recovery, or race selection.',
    howItImpactsPerformance: 'Volume is not a universal lever. This widget answers whether, for you specifically, adding kilometers in a build actually translates to faster races.',
    relatedActions: [
      { label: 'Connect Strava', to: '/settings' },
    ],
  },

  'race-gap-analysis': {
    id: 'race-gap-analysis',
    title: 'RACE GAP ANALYSIS',
    tagline: 'How long you actually need between races.',
    whatItIs: 'Looks at the gap between each of your races and classifies performances that followed short gaps versus long gaps. Identifies your personal recovery floor.',
    howToRead: 'Your recommended minimum gap is the smallest window after which you raced at full form. Going tighter than that historically cost you time.',
    howItImpactsPerformance: 'Generic "2 weeks per marathon" rules are averages. Your personal recovery floor might be 3 weeks, or 9 days. Knowing it is worth a goal-time swing.',
  },

  'adaptive-goals': {
    id: 'adaptive-goals',
    title: 'ADAPTIVE GOALS',
    tagline: 'Goal times that move with your training.',
    whatItIs: 'Adjusts your goal times week by week as training load, recent races, and recovery change. Keeps the goal honest rather than aspirational.',
    howToRead: 'The original goal is anchored in orange. The adaptive goal is green if form is trending up, or red if conditions suggest pulling back.',
    howItImpactsPerformance: 'Static goals ignore reality. Adaptive goals force the hard conversation earlier — either the plan extends or the number moves.',
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
    tagline: 'Your rhythm across every logged race.',
    whatItIs: 'Classifies every race with splits into FADER (slowed by more than 2%), EVEN PACER (final split within 2%), or NEGATIVE SPLITTER (closed faster than opening). Your dominant label is the pattern that appears most often.',
    howToRead: 'The percentages underneath are your fade rate and negative-split rate across all split-equipped races. A 60%+ fade rate is a taper or pacing problem. A 40%+ negative-split rate means you routinely leave time on the table by starting too conservative.',
    howItImpactsPerformance: 'Even pacing wins. Faders leak 30s–2min on typical marathons; negative-splitters who could have started 5s/km faster leave similar time on the course. Target the next race — if you fade, start slower. If you negative-split, start on pace.',
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

  'surface-profile': {
    id: 'surface-profile',
    title: 'SURFACE PROFILE',
    tagline: 'Road, trail, track — what suits you.',
    whatItIs: 'Breaks down your races by surface type and compares your performance percentile on each. Needs at least 3 races per surface for a reliable read.',
    howToRead: 'The surface with the highest percentile is your home. A gap of 10+ percentile points between surfaces is meaningful — you are a road runner who sometimes trails, or vice versa.',
    howItImpactsPerformance: 'Surface choice is a goal-time decision. Picking a trail 50K when you are a road marathoner means you are training a weakness, not hunting a PB.',
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

  'best-conditions': {
    id: 'best-conditions',
    title: 'BEST CONDITIONS',
    tagline: 'The weather you race fastest in.',
    whatItIs: 'Identifies the specific temperature and humidity range where your races have been fastest. Requires weather data on at least 5 past races.',
    howToRead: 'Your sweet spot is the range where your race times cluster. A 4–8°C sweet spot with low humidity is common for marathon PBs. Fall and early spring races often match this.',
    howItImpactsPerformance: 'Pick goal races by the forecast, not the field. A flatter course in worse weather will cost you more than a hillier course in your sweet spot.',
  },

  'pattern-scan': {
    id: 'pattern-scan',
    title: 'PATTERN SCAN',
    tagline: 'Hidden trends across your race history.',
    whatItIs: 'A deeper analytical pass over your entire race log. Looks for comeback races after gaps, seasonal patterns, recurring distances, and repeat-course improvements.',
    howToRead: 'Each tag is a specific signal the scan found. Tags are ranked by confidence. Tap EXPLAIN WITH AI for a narrative summary of the top patterns.',
    howItImpactsPerformance: 'Patterns are the training plan writing itself. Seeing that you always PR after a 2-week gap tells you something no coach can infer without your data.',
  },

  'why-result': {
    id: 'why-result',
    title: 'WHY THIS RESULT',
    tagline: 'The coach-brief on your last race.',
    whatItIs: 'An AI-generated coaching brief on your most recent race. Explains the result in terms of pacing, training load, weather, and conditions.',
    howToRead: 'The brief lists execution wins and execution misses. Read the misses as training inputs for the next cycle, not as judgment.',
    howItImpactsPerformance: 'Every race is a workout you will repeat. Understanding what worked and what did not makes the next race cycle more deliberate.',
  },

  'advanced-race-dna': {
    id: 'advanced-race-dna',
    title: 'ADVANCED RACE DNA',
    tagline: 'Multi-factor race-condition analysis.',
    whatItIs: 'An extended Race DNA view that combines weather, surface, elevation, distance, and time of year into a single signature. Requires 10+ races.',
    howToRead: 'Each factor gets a separate score. The combined signature is your ideal race: a specific distance, surface, month, elevation range, and temperature.',
    howItImpactsPerformance: 'This is the bespoke answer to "where should I race next to PR?" It removes guessing from goal-race selection.',
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

  'coach-activity': {
    id: 'coach-activity',
    title: 'COACH ACTIVITY',
    tagline: 'Feedback from your coach.',
    whatItIs: 'An inbox for notes, adjustments, and feedback from a coach who has been granted access to your dashboard. Coach-only — visible when a coach is linked.',
    howToRead: 'New notes are bolded. Notes are keyed to specific races or training blocks. Reply through the coach channel to keep the conversation anchored.',
    howItImpactsPerformance: 'A good coach shortens the learning loop. Having their feedback surfaced alongside your data turns every race into a shared review.',
  },

  'story-mode': {
    id: 'story-mode',
    title: 'STORY MODE',
    tagline: 'Your running year, as a story.',
    whatItIs: 'An annual recap stitched from your races, PBs, countries, and break-tape moments. Generated once per year or on-demand.',
    howToRead: 'Each chapter covers a block of the year — your first PR, your toughest race, your biggest distance, your most-raced city. Tap a chapter to expand.',
    howItImpactsPerformance: 'Story mode is not analytics. It is perspective. Looking back 12 months in narrative form is how most athletes realize they have come much further than they feel.',
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

  'weather-impact': {
    id: 'weather-impact',
    title: 'WEATHER IMPACT',
    tagline: 'Your fastest race weighted for conditions.',
    whatItIs: 'Ranks your races by how fast they were given the weather. Surfaces hidden PBs — races that were not your fastest on the clock but were your best given heat, wind, or humidity.',
    howToRead: 'The top race is the one you executed best, not the one with the lowest time. Use it as the benchmark for what your body can do in similar conditions again.',
    howItImpactsPerformance: 'Raw times hide context. A 3:01 marathon at 25°C might be a harder effort than a 2:58 at 10°C. Weather impact lets you see training gains that pure PBs miss.',
  },

  'vdot-score': {
    id: 'vdot-score',
    title: 'VDOT FITNESS SCORE',
    tagline: 'Jack Daniels\' running fitness number.',
    whatItIs: 'Calculates your VDOT from your best recent race. VDOT is a standardized running fitness score (roughly 30–85) that translates directly into training paces.',
    howToRead: 'Under 40: beginner/recreational. 45–55: serious amateur. 55–65: competitive amateur. 65+: elite. Your VDOT updates whenever you race faster.',
    howItImpactsPerformance: 'VDOT gives you training paces that match current fitness — easy, threshold, interval, and repetition pace all derive from it. Training too fast on a low VDOT burns you out; training too slow on a high VDOT wastes sessions.',
  },

  'distance-milestones': {
    id: 'distance-milestones',
    title: 'DISTANCE MILESTONES',
    tagline: 'Cumulative distance by type.',
    whatItIs: 'Total kilometers raced at each distance — 5Ks, 10Ks, halfs, marathons, ultras. DNFs excluded.',
    howToRead: 'The bars show race volume, not training. A deep marathon total with no 5Ks tells a different story than the reverse. Each milestone (100K raced, 1000K raced) is marked.',
    howItImpactsPerformance: 'Experience matters at a distance. Most runners need 3–4 marathons before they race it well. Milestones show how much experience you have banked.',
  },

  'equiv-perf': {
    id: 'equiv-perf',
    title: 'EQUIVALENT PERFORMANCES',
    tagline: 'How your PB at one distance maps to others.',
    whatItIs: 'Translates your best race across every other distance using the Riegel formula. Identifies distances where you are over- or under-performing relative to expectation.',
    howToRead: 'Green rows mean that distance is faster than Riegel predicts — a natural strength. Orange rows are slower than expected — a place to target improvement.',
    howItImpactsPerformance: 'Athletes are not equally strong at every distance. Knowing that your marathon is under-performing your 10K tells you where the next training cycle should focus.',
  },

  'upcoming-density': {
    id: 'upcoming-density',
    title: 'RACE CONFLICT CHECKER',
    tagline: 'Calendar conflicts in your planned races.',
    whatItIs: 'Scans your upcoming race list for calendar conflicts: two races in the same week, a marathon followed by a race less than 21 days later, or three races in a 30-day window.',
    howToRead: 'Green = clean calendar. Yellow = tight spacing, manageable if races are B/C priority. Red = conflict that will compromise your A-race. Each warning lists the specific races involved.',
    howItImpactsPerformance: 'Race calendars fill up one commitment at a time. Checking the whole season as a unit catches the stack-ups that silently degrade your A-race.',
    relatedActions: [
      { label: 'Open Season Planner', to: '/races' },
    ],
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
