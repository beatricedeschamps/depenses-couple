import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { HouseholdRow, ProfileRow } from '@/lib/database.types'

interface HouseholdContextValue {
  household: HouseholdRow | null
  partner: ProfileRow | null
  loading: boolean
  createHousehold: () => Promise<{ code: string; error: Error | null }>
  joinHousehold: (code: string) => Promise<{ error: Error | null }>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth()
  const [household, setHousehold] = useState<HouseholdRow | null>(null)
  const [partner, setPartner] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(false)

  const loadHousehold = useCallback(async (householdId: string) => {
    setLoading(true)
    const { data: hh } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single()
    setHousehold((hh as HouseholdRow | null) ?? null)

    if (hh && user) {
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('household_id', (hh as HouseholdRow).id)
        .neq('id', user.id)
        .single()
      setPartner((partnerProfile as ProfileRow | null) ?? null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (profile?.household_id) {
      loadHousehold(profile.household_id)
    } else {
      setHousehold(null)
      setPartner(null)
    }
  }, [profile?.household_id, loadHousehold])

  // Realtime : écoute si le partenaire rejoint le foyer
  useEffect(() => {
    if (!household) return
    const channel = supabase
      .channel(`household:${household.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'profiles',
        filter: `household_id=eq.${household.id}`,
      }, () => { loadHousehold(household.id) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [household, loadHousehold])

  async function createHousehold(): Promise<{ code: string; error: Error | null }> {
    const { data, error } = await supabase.rpc('create_household_for_user')
    if (error) return { code: '', error }

    const result = data as { household_id: string; code: string }
    await refreshProfile()
    return { code: result.code, error: null }
  }

  async function joinHousehold(code: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.rpc('join_household_with_code', { p_code: code })
    if (error) return { error }
    await refreshProfile()
    return { error: null }
  }

  return (
    <HouseholdContext.Provider value={{ household, partner, loading, createHousehold, joinHousehold }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
