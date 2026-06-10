// Onboarding tour step registry.
//
// `target` is a CSS selector resolved at runtime. A step whose target is not
// in the DOM when it becomes active is skipped automatically (e.g. the
// GET STARTED card only renders for users with zero races — replaying the
// tour from Settings after logging races skips that step).
// `target: null` renders a centered card with a dimmed backdrop and no spotlight.

export interface TourStep {
  id: string
  target: string | null
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to Breaktapes',
    body: 'Your race history, medals, and personal bests — one place. Sixty seconds, five stops.',
  },
  {
    id: 'log-import',
    target: '[data-tour="get-started"]',
    title: 'Log your first race',
    body: 'Add a finish by hand, or import your full history from MarathonView, UltraSignup, IRONMAN and more.',
  },
  {
    id: 'widgets',
    target: '[data-widget-id="stats-strip"]',
    title: 'Your dashboard',
    body: 'Every card is tappable — open any widget for the full story behind the number.',
  },
  {
    id: 'customize',
    target: '[data-tour="customize"]',
    title: 'Make it yours',
    body: 'Add, resize and reorder 24 widgets — race predictors, pacing analysis, readiness and more.',
  },
  {
    id: 'races-tab',
    target: '[data-tour="nav-races"]',
    title: 'Your race log',
    body: 'Every race on a world map, year by year — plus import and discovery.',
  },
  {
    id: 'you-tab',
    target: '[data-tour="nav-you"]',
    title: 'Your athlete page',
    body: 'Achievements, PBs and your shareable public profile live here. Enjoy the run.',
  },
]
