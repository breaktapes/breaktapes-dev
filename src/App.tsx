import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthGate } from '@/components/AuthGate'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Races } from '@/pages/Races'
import { Train } from '@/pages/Train'
import { Profile } from '@/pages/Profile'
import { Gear } from '@/pages/Gear'
import { Settings } from '@/pages/Settings'
import { transitions } from '@/lib/motion'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

/** Page fade wrapper — opacity 0→1, 150ms, ease-out. No slides. */
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transitions.page}
        style={{ minHeight: '100%' }}
      >
        <Routes location={location}>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/races"    element={<Races />} />
          <Route path="/train"    element={<Train />} />
          <Route path="/you"      element={<Profile />} />
          <Route path="/gear"     element={<Gear />} />
          <Route path="/settings" element={<Settings />} />
          {/* Backwards compat aliases */}
          <Route path="/pace"    element={<Navigate to="/" replace />} />
          <Route path="/history" element={<Navigate to="/races" replace />} />
          <Route path="/map"     element={<Navigate to="/races" replace />} />
          {/* Catch-all */}
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <Layout>
              <AnimatedRoutes />
            </Layout>
          </AuthGate>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
