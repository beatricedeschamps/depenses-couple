import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/contexts/HouseholdContext'
import type { RecurringRow } from '@/lib/database.types'

export function useRecurrings() {
  const { household } = useHousehold()
  const [recurrings, setRecurrings] = useState<RecurringRow[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async (hhId: string) => {
    setLoading(true)
    const { data } = await supabase.from('recurrings').select('*').eq('household_id', hhId)
    setRecurrings((data as RecurringRow[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!household) { setRecurrings([]); return }
    fetchAll(household.id)

    const channel = supabase
      .channel(`recurrings:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurrings', filter: `household_id=eq.${household.id}` }, () => fetchAll(household.id))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [household?.id, fetchAll])

  return { recurrings, loading, reload: () => { if (household) fetchAll(household.id) } }
}
