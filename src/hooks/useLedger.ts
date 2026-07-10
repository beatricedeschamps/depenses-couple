import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/contexts/HouseholdContext'
import { buildLedger, computeBalance, type LedgerEntry } from '@/lib/balance'
import type { ExpenseRow, RecurringRow, SettlementRow } from '@/lib/database.types'

export interface LedgerState {
  ledger: LedgerEntry[]
  balance: number    // positive = béa doit à phil, negative = phil doit à béa
  loading: boolean
  reload: () => void
}

export function useLedger(): LedgerState {
  const { household } = useHousehold()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [recurrings, setRecurrings] = useState<RecurringRow[]>([])
  const [settlements, setSettlements] = useState<SettlementRow[]>([])
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchAll = useCallback(async (hhId: string) => {
    setLoading(true)
    const [{ data: exp }, { data: rec }, { data: set }] = await Promise.all([
      supabase.from('expenses').select('*').eq('household_id', hhId).order('date', { ascending: false }),
      supabase.from('recurrings').select('*').eq('household_id', hhId),
      supabase.from('settlements').select('*').eq('household_id', hhId).order('date', { ascending: false }),
    ])
    setExpenses((exp as ExpenseRow[] | null) ?? [])
    setRecurrings((rec as RecurringRow[] | null) ?? [])
    setSettlements((set as SettlementRow[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!household) {
      setExpenses([]); setRecurrings([]); setSettlements([])
      return
    }
    fetchAll(household.id)

    const channel = supabase
      .channel(`ledger:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${household.id}` }, () => fetchAll(household.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurrings', filter: `household_id=eq.${household.id}` }, () => fetchAll(household.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `household_id=eq.${household.id}` }, () => fetchAll(household.id))
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [household?.id, fetchAll])

  const ledger = buildLedger(expenses, recurrings, settlements)
  const balance = computeBalance(ledger)

  return {
    ledger,
    balance,
    loading,
    reload: () => { if (household) fetchAll(household.id) },
  }
}
