import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/contexts/HouseholdContext'
import type { SettingsRow } from '@/lib/database.types'

type SettingsPatch = Partial<Pick<SettingsRow, 'vehicles' | 'trips' | 'default_gas_price'>>

const DEFAULTS: Pick<SettingsRow, 'vehicles' | 'trips' | 'default_gas_price'> = {
  vehicles: [],
  trips: [],
  default_gas_price: 1.52,
}

export function useSettings() {
  const { household } = useHousehold()
  const [settings, setSettings] = useState<SettingsRow | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async (hhId: string) => {
    setLoading(true)
    const { data } = await supabase.from('settings').select('*').eq('household_id', hhId).single()
    setSettings((data as SettingsRow | null) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!household) { setSettings(null); return }
    fetch(household.id)
  }, [household?.id, fetch])

  async function update(patch: SettingsPatch) {
    if (!household) return
    const { data } = await supabase
      .from('settings')
      .upsert({ household_id: household.id, ...DEFAULTS, ...settings, ...patch } as never, { onConflict: 'household_id' })
      .select()
      .single()
    if (data) setSettings(data as SettingsRow)
  }

  const current: SettingsRow = settings ?? {
    id: '',
    household_id: household?.id ?? '',
    updated_at: '',
    ...DEFAULTS,
  }

  return { settings: current, loading, update, reload: () => { if (household) fetch(household.id) } }
}
