import posthog from 'posthog-js'
import { POSTHOG_KEY, POSTHOG_HOST } from '@/env'

export function initPostHog() {
  if (!POSTHOG_KEY) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false, // manual via usePostHogPageView
    capture_pageleave: true,
    // rrweb session recording loads + instruments the DOM during the exact
    // cold-start window the user first interacts with the login screen —
    // inflates INP on the auth inputs. Keep autocapture (product analytics),
    // drop the heavy recorder.
    disable_session_recording: true,
    enable_recording_console_log: false,
    loaded(ph) {
      if (import.meta.env.DEV) ph.debug()
    },
  })
}

export { posthog }
