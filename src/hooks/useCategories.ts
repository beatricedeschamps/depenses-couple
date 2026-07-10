import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/contexts/HouseholdContext'
import type { CategoryRow } from '@/lib/database.types'

export function useCategories() {
  const { household } = useHousehold()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async (hhId: string) => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').eq('household_id', hhId).order('name')
    setCategories((data as CategoryRow[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!household) { setCategories([]); return }
    fetch(household.id)
  }, [household?.id, fetch])

  return { categories, loading, reload: () => { if (household) fetch(household.id) } }
}
