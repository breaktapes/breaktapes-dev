// Vite environment variables
// All VITE_* vars are inlined at build time — safe for client bundles

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const IS_STAGING = import.meta.env.VITE_IS_STAGING === 'true'
export const WHOOP_CLIENT_ID = import.meta.env.VITE_WHOOP_CLIENT_ID as string ?? ''
export const GARMIN_CLIENT_ID = import.meta.env.VITE_GARMIN_CLIENT_ID as string ?? ''
