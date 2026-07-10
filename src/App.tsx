import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { AuthPage } from '@/pages/AuthPage'
import { PairingPage } from '@/pages/PairingPage'
import { AppShell } from '@/pages/AppShell'
import { PWAUpdateBanner } from '@/components/PWAUpdateBanner'

export function App() {
  const { user, loading: authLoading } = useAuth()
  const { household, loading: householdLoading } = useHousehold()

  if (authLoading || (user && householdLoading)) {
    return (
      <div className="min-h-svh flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
          >
            P&amp;B
          </div>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--muted-fg)' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      </div>
    )
  }

  if (!user) return <AuthPage />
  if (!household) return <PairingPage />
  return (
    <>
      <AppShell />
      <PWAUpdateBanner />
    </>
  )
}
