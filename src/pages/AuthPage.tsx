import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Person } from '@/lib/database.types'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [person, setPerson] = useState<Person>('bea')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    let result: { error: Error | null }
    if (mode === 'login') {
      result = await signIn(email, password)
    } else {
      if (!name.trim()) {
        setError('Le prénom est requis.')
        setLoading(false)
        return
      }
      result = await signUp(email, password, name.trim(), person)
    }

    if (result.error) {
      setError(translateError(result.error.message))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-5 py-12" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
          >
            P&amp;B
          </div>
          <div>
            <h1 className="text-center text-2xl font-bold tracking-tight" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              Dépenses partagées
            </h1>
            <p className="text-center text-sm mt-1" style={{ color: 'var(--muted-fg)' }}>Phil &amp; Béa</p>
          </div>
        </div>

        {/* Carte */}
        <div
          className="rounded-2xl border p-6 shadow-sm"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {/* Toggle login/signup */}
          <div
            className="flex rounded-xl p-1 mb-5 gap-1"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className="flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all"
                style={mode === m ? { background: 'var(--card)', color: 'var(--fg)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: 'var(--muted-fg)' }}
              >
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <>
                <Input
                  label="Prénom"
                  placeholder="Béa ou Phil"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
                {/* Qui es-tu ? */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Tu es…</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['bea', 'phil'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPerson(p)}
                        className="py-2.5 rounded-xl text-sm font-semibold border transition-all"
                        style={person === p
                          ? { background: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)' }
                          : { background: 'var(--card)', color: 'var(--fg)', borderColor: 'var(--border)' }
                        }
                      >
                        {p === 'bea' ? 'Béa' : 'Phil'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Input
              label="Courriel"
              type="email"
              placeholder="toi@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete={mode === 'login' ? 'email' : 'new-email'}
              required
            />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              hint={mode === 'signup' ? 'Minimum 6 caractères' : undefined}
            />

            {error && (
              <div
                className="text-sm rounded-xl px-4 py-3"
                style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}
              >
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
              {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Courriel ou mot de passe incorrect.'
  if (msg.includes('Email not confirmed')) return 'Confirme ton courriel avant de te connecter.'
  if (msg.includes('User already registered')) return 'Ce courriel est déjà utilisé.'
  if (msg.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.'
  return msg
}
