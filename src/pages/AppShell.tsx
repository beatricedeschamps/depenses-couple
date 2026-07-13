import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { RelevePage } from '@/pages/RelevePage'
import { SoldePage } from '@/pages/SoldePage'
import { RecurrentesPage } from '@/pages/RecurrentesPage'
import { ParamètresPage } from '@/pages/ParamètresPage'
import { ExpenseSheet } from '@/components/ExpenseSheet'
import { RecurringSheet } from '@/components/RecurringSheet'
import { ImportPdfSheet } from '@/components/ImportPdfSheet'

type Tab = 'releve' | 'recurrentes' | 'solde' | 'parametres'

export function AppShell() {
  const { profile, signOut } = useAuth()
  const { household, partner } = useHousehold()
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('releve')
  const [showAccount, setShowAccount] = useState(false)

  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadInviteCode = useCallback(async () => {
    if (!household) return
    const { data } = await supabase
      .from('invite_codes')
      .select('code, expires_at')
      .eq('household_id', household.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    setInviteCode((data as { code: string } | null)?.code ?? null)
  }, [household])

  async function generateNewCode() {
    if (!household || !profile) return
    setInviteLoading(true)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    const arr = new Uint8Array(6)
    crypto.getRandomValues(arr)
    arr.forEach(b => { code += chars[b % chars.length] })
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('invite_codes').insert({ code, household_id: household.id, created_by: profile.id, expires_at: expires } as never)
    setInviteCode(code)
    setInviteLoading(false)
  }

  async function copyCode() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addRecurringOpen, setAddRecurringOpen] = useState(false)
  const [importPdfOpen, setImportPdfOpen] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const userInitial = profile?.name?.charAt(0).toUpperCase() ?? '?'
  const partnerName = partner?.name ?? (profile?.person === 'bea' ? 'Phil' : 'Béa')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'releve',
      label: 'Relevé',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    },
    {
      id: 'recurrentes',
      label: 'Récurrentes',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
    },
    {
      id: 'solde',
      label: 'Solde',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    },
    {
      id: 'parametres',
      label: 'Paramètres',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    },
  ]

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-svh" style={{ background: 'var(--appbg)' }}>
        {/* Header mobile */}
        <div
          className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--toolbar)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-xl font-bold tracking-tight capitalize" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              {tabs.find(t => t.id === tab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: 'var(--muted-fg)' }}>
              {theme === 'dark'
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>
              }
            </button>
            <button
              onClick={() => setShowAccount(v => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold"
              style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
            >
              {userInitial}
            </button>
          </div>
        </div>

        {/* Compte overlay */}
        {showAccount && (
          <div className="fixed inset-0 z-50 flex flex-col overflow-auto" style={{ background: 'var(--appbg)' }}>
            <div className="sticky top-0 flex items-center px-4 py-3" style={{ background: 'var(--toolbar)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => setShowAccount(false)} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1L1.5 7.5 8 14"/></svg>
                {tabs.find(t => t.id === tab)?.label}
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>Compte</h1>

              {/* Profil */}
              <div className="rounded-2xl border p-4 flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-base" style={{ color: 'var(--fg)' }}>{profile?.name}</div>
                  <div className="text-sm truncate" style={{ color: 'var(--muted-fg)' }}>{household?.name ?? 'Sans foyer'}</div>
                </div>
              </div>

              {/* Partenaire ou invitation */}
              {partner ? (
                <div className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-fg)' }}>Partenaire</div>
                  <div className="font-semibold" style={{ color: 'var(--fg)' }}>{partnerName}</div>
                </div>
              ) : (
                <div className="rounded-2xl border p-4 flex flex-col gap-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>Inviter mon partenaire</div>
                  {inviteCode ? (
                    <>
                      <div className="rounded-xl p-4 text-center" style={{ background: 'var(--primary-soft)', border: '1.5px dashed var(--primary)' }}>
                        <div className="text-3xl font-bold tracking-[0.2em]" style={{ color: 'var(--primary)', fontFamily: "'Geist Mono', monospace" }}>{inviteCode}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--primary-soft-fg)' }}>Valide 7 jours</div>
                      </div>
                      <button onClick={copyCode} className="text-sm font-semibold flex items-center justify-center gap-2" style={{ color: 'var(--primary)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        {copied ? 'Copié !' : 'Copier le code'}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { loadInviteCode() }} className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                      Voir le code d'invitation →
                    </button>
                  )}
                  <button onClick={generateNewCode} disabled={inviteLoading} className="text-xs" style={{ color: 'var(--muted-fg)' }}>
                    {inviteLoading ? 'Génération…' : 'Générer un nouveau code'}
                  </button>
                </div>
              )}

              <button
                onClick={signOut}
                className="rounded-2xl border p-4 flex items-center justify-center gap-2 text-sm font-semibold"
                style={{ background: 'var(--card)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
                Se déconnecter
              </button>
            </div>
          </div>
        )}

        {/* Contenu principal */}
        <div className="flex-1 overflow-auto pb-24">
          <TabContent tab={tab} />
        </div>

        {/* Barre d'onglets bas */}
        <div
          className="fixed bottom-0 inset-x-0 z-40 flex items-end"
          style={{ background: 'var(--toolbar)', backdropFilter: 'blur(14px)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {tabs.slice(0, 2).map(t => (
            <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
          {/* Bouton + */}
          <div className="flex-1 flex justify-center items-center py-2 relative" ref={plusMenuRef}>
            <button
              onClick={() => setPlusMenuOpen(v => !v)}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-white"
              style={{ background: 'var(--primary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            {plusMenuOpen && (
              <PlusMenu
                onClose={() => setPlusMenuOpen(false)}
                onPonctuelle={() => { setPlusMenuOpen(false); setAddSheetOpen(true) }}
                onImport={() => { setPlusMenuOpen(false); setImportPdfOpen(true) }}
                onRecurrente={() => { setPlusMenuOpen(false); setAddRecurringOpen(true) }}
                sheet
              />
            )}
          </div>
          {tabs.slice(2).map(t => (
            <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </div>

        <ExpenseSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} />
        <RecurringSheet open={addRecurringOpen} onClose={() => setAddRecurringOpen(false)} />
        <ImportPdfSheet open={importPdfOpen} onClose={() => setImportPdfOpen(false)} />
      </div>
    )
  }

  // Layout laptop
  return (
    <div className="flex min-h-svh" style={{ background: 'var(--appbg)' }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col sticky top-0 h-svh border-r"
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>P&amp;B</div>
          <span className="font-semibold text-sm" style={{ color: 'var(--fg)', letterSpacing: '-0.01em' }}>Dépenses partagées</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
              style={tab === t.id
                ? { background: 'var(--primary-soft)', color: 'var(--primary)' }
                : { color: 'var(--muted-fg)' }
              }
            >
              <span style={{ color: tab === t.id ? 'var(--primary)' : 'var(--muted-fg)' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div className="p-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
          {/* Ajouter */}
          <div className="relative">
            <button
              onClick={() => setPlusMenuOpen(v => !v)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Ajouter
            </button>
            {plusMenuOpen && (
              <PlusMenu
                onClose={() => setPlusMenuOpen(false)}
                onPonctuelle={() => { setPlusMenuOpen(false); setAddSheetOpen(true) }}
                onImport={() => { setPlusMenuOpen(false); setImportPdfOpen(true) }}
                onRecurrente={() => { setPlusMenuOpen(false); setAddRecurringOpen(true) }}
                popupPos={{ bottom: '110%', left: 0 }}
              />
            )}
          </div>

          <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: 'var(--muted-fg)' }}>
            {theme === 'dark'
              ? <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>Mode clair</>
              : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>Mode sombre</>
            }
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--fg)' }}>{profile?.name}</div>
              {partner && <div className="text-xs truncate" style={{ color: 'var(--muted-fg)' }}>avec {partnerName}</div>}
            </div>
            <button onClick={signOut} title="Se déconnecter" style={{ color: 'var(--muted-fg)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 overflow-auto">
        <TabContent tab={tab} />
      </main>

      <ExpenseSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} />
      <RecurringSheet open={addRecurringOpen} onClose={() => setAddRecurringOpen(false)} />
      <ImportPdfSheet open={importPdfOpen} onClose={() => setImportPdfOpen(false)} />
    </div>
  )
}

function TabButton({ t, active, onClick }: { t: { id: string; label: string; icon: React.ReactNode }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors"
      style={{ color: active ? 'var(--primary)' : 'var(--muted-fg)' }}
    >
      <span style={{ color: active ? 'var(--primary)' : 'var(--muted-fg)' }}>{t.icon}</span>
      {t.label}
    </button>
  )
}

function TabContent({ tab }: { tab: Tab }) {
  if (tab === 'releve') return <RelevePage />
  if (tab === 'solde') return <SoldePage />
  if (tab === 'recurrentes') return <RecurrentesPage />
  if (tab === 'parametres') return <ParamètresPage />
  return null
}

interface PlusMenuProps {
  onClose: () => void
  onPonctuelle: () => void
  onImport: () => void
  onRecurrente: () => void
  popupPos?: React.CSSProperties
  sheet?: boolean
}

function PlusMenu({ onClose, onPonctuelle, onImport, onRecurrente, popupPos, sheet }: PlusMenuProps) {
  const actions = (
    <>
      <MenuAction
        label="Dépense ponctuelle"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6z"/><path d="M9 8h6M9 12h6"/></svg>}
        onClick={onPonctuelle}
      />
      <div style={{ height: 1, background: 'var(--border)' }} />
      <MenuAction
        label="Importer un relevé PDF"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
        onClick={onImport}
      />
      <div style={{ height: 1, background: 'var(--border)' }} />
      <MenuAction
        label="Dépense récurrente"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>}
        onClick={onRecurrente}
      />
    </>
  )

  if (sheet) {
    return (
      <div className="fixed inset-0 z-50 flex items-end" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
        <div className="relative w-full rounded-t-3xl overflow-hidden" style={{ background: 'var(--card)' }}>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>
          <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
            {actions}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 w-52 rounded-2xl border shadow-xl overflow-hidden"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          ...(popupPos ?? { bottom: '110%', left: '50%', transform: 'translateX(-50%)' }),
        }}
      >
        {actions}
      </div>
    </>
  )
}

function MenuAction({ label, icon, onClick, muted }: { label: string; icon: React.ReactNode; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium text-left"
      style={{ color: muted ? 'var(--muted-fg)' : 'var(--fg)' }}
    >
      <span style={{ color: muted ? 'var(--muted-fg)' : 'var(--primary)' }}>{icon}</span>
      {label}
    </button>
  )
}
