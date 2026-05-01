// Vite environment variables
// All VITE_* vars are inlined at build time — safe for client bundles

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const IS_STAGING = import.meta.env.VITE_IS_STAGING === 'true'
export const APP_URL = IS_STAGING ? 'https://dev.breaktapes.com' : 'https://app.breaktapes.com'
export const WHOOP_CLIENT_ID = import.meta.env.VITE_WHOOP_CLIENT_ID as string ?? ''
export const GARMIN_CLIENT_ID = import.meta.env.VITE_GARMIN_CLIENT_ID as string ?? ''
export const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID as string ?? ''
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string
export const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  as string ?? ''
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string ?? 'https://us.i.posthog.com'
export const APP_VERSION  = import.meta.env.VITE_APP_VERSION  as string ?? '0.6.11.0'
