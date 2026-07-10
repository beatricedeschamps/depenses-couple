import { useState } from 'react'
import { useHousehold } from '@/contexts/HouseholdContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Step = 'choice' | 'create-done' | 'join'

export function PairingPage() {
  const { profile, signOut } = useAuth()
  const { createHousehold, joinHousehold } = useHousehold()
  const [step, setStep] = useState<Step>('choice')
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = profile?.name ?? 'Toi'

  async function handleCreate() {
    setLoading(true)
    setError(null)
    const { code, error } = await createHousehold()
    if (error) {
      setError(error.message)
    } else {
      setGeneratedCode(code)
      setInviteCode(code)
      setStep('create-done')
    }
    setLoading(false)
  }

  async function handleJoin() {
    if (codeInput.trim().length < 6) {
      setError('Entre le code à 6 caractères.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await joinHousehold(codeInput)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-5 py-12" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
          >
            P&amp;B
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            Bienvenue, {firstName} !
          </h1>
          <p className="text-sm text-center" style={{ color: 'var(--muted-fg)' }}>
            Pour partager les dépenses, il faut lier vos deux comptes.
          </p>
        </div>

        <div className="rounded-2xl border p-6 shadow-sm" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {step === 'choice' && (
            <div className="flex flex-col gap-3">
              {error && (
                <div className="text-sm rounded-xl px-4 py-3" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                  {error}
                </div>
              )}
              <Button size="lg" className="w-full" loading={loading} onClick={handleCreate}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Créer le foyer
              </Button>
              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--muted-fg)' }}>ou</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
              <Button size="lg" variant="outline" className="w-full" onClick={() => { setStep('join'); setError(null) }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>
                </svg>
                Rejoindre avec un code
              </Button>
              <p className="text-xs text-center mt-1" style={{ color: 'var(--muted-fg)' }}>
                Un seul foyer par couple. Celui qui crée génère le code à partager.
              </p>
            </div>
          )}

          {step === 'create-done' && (
            <div className="flex flex-col items-center gap-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--primary-soft)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-base" style={{ color: 'var(--fg)' }}>Foyer créé !</p>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-fg)' }}>
                  Partage ce code à ton partenaire pour qu'il rejoigne le foyer.
                </p>
              </div>

              {/* Code affiché */}
              <div className="w-full">
                <div
                  className="rounded-2xl p-5 text-center"
                  style={{ background: 'var(--primary-soft)', border: '1.5px dashed var(--primary)' }}
                >
                  <div className="text-xs font-semibold mb-2 tracking-widest uppercase" style={{ color: 'var(--primary-soft-fg)' }}>
                    Code d'invitation
                  </div>
                  <div
                    className="text-4xl font-bold tracking-[0.2em] font-mono"
                    style={{ color: 'var(--primary)', fontFamily: "'Geist Mono', monospace" }}
                  >
                    {generatedCode}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--primary-soft-fg)' }}>
                    Valide 7 jours
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigator.clipboard.writeText(inviteCode)}
                className="text-sm font-semibold flex items-center gap-2"
                style={{ color: 'var(--primary)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copier le code
              </button>

              <p className="text-xs text-center" style={{ color: 'var(--muted-fg)' }}>
                En attente que ton partenaire rejoigne… La page se mettra à jour automatiquement.
              </p>
            </div>
          )}

          {step === 'join' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-semibold text-base mb-1" style={{ color: 'var(--fg)' }}>Rejoindre un foyer</p>
                <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>
                  Entre le code à 6 caractères que ton partenaire a généré.
                </p>
              </div>

              <Input
                label="Code d'invitation"
                placeholder="ABC123"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                className="text-center text-xl tracking-[0.3em] font-mono uppercase"
                style={{ fontFamily: "'Geist Mono', monospace" } as React.CSSProperties}
                error={!!error}
                hint={error ?? undefined}
                autoComplete="off"
                autoCapitalize="characters"
              />

              <Button size="lg" className="w-full" loading={loading} onClick={handleJoin}>
                Rejoindre
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setStep('choice'); setError(null); setCodeInput('') }}>
                ← Retour
              </Button>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="mt-5 text-sm text-center w-full"
          style={{ color: 'var(--muted-fg)' }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
