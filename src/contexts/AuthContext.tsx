import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ProfileRow, Person } from '@/lib/database.types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  loading: boolean
  signUp: (email: string, password: string, name: string, person: Person) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  // Bloque onAuthStateChange pendant que signUp crée le profil
  const suppressAuthChange = useRef(false)

  async function loadProfile(userId: string): Promise<ProfileRow | null> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    const p = (data as ProfileRow | null) ?? null
    setProfile(p)
    return p
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (suppressAuthChange.current) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, name: string, person: Person) {
    suppressAuthChange.current = true

    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error || !data.user) return { error: error ?? new Error('Erreur inconnue') }

      const { error: rpcError } = await supabase.rpc('create_my_profile', {
        p_name: name,
        p_person: person,
      })
      if (rpcError) return { error: rpcError }

      await loadProfile(data.user.id)
      setSession(data.session)
      setUser(data.user)

      return { error: null }
    } finally {
      suppressAuthChange.current = false
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
