import { useEffect, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CLERK_PUBLISHABLE_KEY } from '@/env'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useThemeStore } from '@/stores/useThemeStore'
import type { DemoPersona } from '@/lib/demoData'

/* =====================================================================
   DemoShell — mounts the REAL app pages/widgets against seeded stores.

   SAFETY: only ever rendered on the breaktapes.com marketing origin or the
   public /demo route. Both are logged-out, and breaktapes.com has a separate
   localStorage from app.breaktapes.com, so seeding the stores here can never
   touch a signed-in user's real race data. Seeding uses the sync-SILENT
   setters (setRaces / setUpcomingRaces / setAthlete) — no Supabase writes.
   ===================================================================== */

const demoQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: false } },
})

/** Load a persona's data into the live stores. Re-seeds on persona switch. */
function useDemoSeed(persona: DemoPersona): boolean {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    setReady(false)
    const rs = useRaceStore.getState()
    rs.setRaces(persona.races)
    rs.setWishlistRaces([])
    rs.setUpcomingRaces(persona.upcoming) // also promotes nextRace
    rs.setFocusRaceId(null)
    useAthleteStore.getState().setAthlete(persona.athlete)
    setReady(true)
  }, [persona.id, persona.races, persona.upcoming, persona.athlete])
  return ready
}

export function DemoShell({ persona, children }: { persona: DemoPersona; children: ReactNode }) {
  const ready = useDemoSeed(persona)
  const setForceDefault = useThemeStore(s => s.setForceDefault)

  // Demo always shows the default Carbon+Chrome look, regardless of any
  // theme a returning visitor may have saved.
  useEffect(() => {
    setForceDefault(true)
    return () => setForceDefault(false)
  }, [setForceDefault])

  if (!ready) return null

  const inner = <QueryClientProvider client={demoQueryClient}>{children}</QueryClientProvider>

  // Races + Profile call useUser() — they need a ClerkProvider ancestor.
  // Dashboard does not. The key is domain-locked, so on the marketing origin
  // it initialises with no session (logged-out), exactly what the demo wants.
  return CLERK_PUBLISHABLE_KEY
    ? <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>{inner}</ClerkProvider>
    : inner
}
