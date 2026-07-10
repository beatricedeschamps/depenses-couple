import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { formatCAD } from '@/lib/utils'
import type { Person, SettlementRow } from '@/lib/database.types'

interface SettlementSheetProps {
  open: boolean
  onClose: () => void
  settlement?: SettlementRow      // edit mode
  defaultAmount?: number          // pre-fill (absolute balance)
  defaultFrom?: Person            // pre-fill (debtor)
  onSaved?: () => void
}

const TODAY = new Date().toISOString().slice(0, 10)

export function SettlementSheet({ open, onClose, settlement, defaultAmount, defaultFrom, onSaved }: SettlementSheetProps) {
  const { profile } = useAuth()
  const { household } = useHousehold()

  const [amountStr, setAmountStr] = useState('')
  const [from, setFrom] = useState<Person>('bea')
  const [date, setDate] = useState(TODAY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    if (settlement) {
      setAmountStr(settlement.amount.toFixed(2).replace('.', ','))
      setFrom(settlement.from_person)
      setDate(settlement.date)
    } else {
      setAmountStr(defaultAmount ? defaultAmount.toFixed(2).replace('.', ',') : '')
      setFrom(defaultFrom ?? 'bea')
      setDate(TODAY)
    }
    setError(null)
    setSaving(false)
    setConfirmDelete(false)
  }, [open, settlement?.id])

  function parseAmount(): number | null {
    const n = parseFloat(amountStr.replace(',', '.'))
    return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100
  }

  async function handleSave() {
    const amount = parseAmount()
    if (!amount) { setError('Le montant doit être un nombre positif.'); return }
    if (!household || !profile) return
    setError(null); setSaving(true)

    if (settlement) {
      const { error: err } = await supabase.from('settlements').update({
        amount, from_person: from, date,
      } as never).eq('id', settlement.id)
      setSaving(false)
      if (err) { setError(err.message); return }
    } else {
      const { error: err } = await supabase.from('settlements').insert({
        household_id: household.id,
        amount,
        from_person: from,
        date,
        created_by: profile.id,
      } as never)
      setSaving(false)
      if (err) { setError(err.message); return }
    }
    onSaved?.()
    onClose()
  }

  async function handleDelete() {
    if (!settlement) return
    setSaving(true)
    await supabase.from('settlements').delete().eq('id', settlement.id)
    setSaving(false)
    onSaved?.()
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div
        className="relative w-full max-w-lg flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', maxHeight: '80svh' }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="text-sm font-medium" style={{ color: 'var(--primary)' }}>Annuler</button>
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>
            {settlement ? 'Modifier le remboursement' : 'Enregistrer un remboursement'}
          </h2>
          <button onClick={handleSave} disabled={saving} className="text-sm font-semibold" style={{ color: saving ? 'var(--muted-fg)' : 'var(--primary)' }}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>

        <div className="overflow-y-auto flex flex-col gap-5 p-5 pb-8">
          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>Montant ($)</label>
            <input
              inputMode="decimal"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl px-4 py-4 text-2xl font-bold outline-none border text-center"
              style={{
                background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)',
                fontFamily: "'Geist Mono', monospace",
              }}
              autoFocus
            />
          </div>

          {/* Who pays */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>Qui rembourse</label>
            <div className="flex gap-2">
              {(['bea', 'phil'] as Person[]).map(p => (
                <button
                  key={p}
                  onClick={() => setFrom(p)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={from === p
                    ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                    : { background: 'var(--muted)', color: 'var(--muted-fg)' }
                  }
                >
                  {p === 'bea' ? 'Béa' : 'Phil'}
                </button>
              ))}
            </div>
            {parseAmount() !== null && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted-fg)' }}>
                {from === 'bea' ? 'Béa' : 'Phil'} rembourse {from === 'bea' ? 'Phil' : 'Béa'} de {formatCAD(parseAmount()!)}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-base outline-none border"
              style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }}
            />
          </div>

          {error && <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{error}</p>}

          {settlement && (
            confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-center" style={{ color: 'var(--muted-fg)' }}>Supprimer ce remboursement ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--muted)', color: 'var(--fg)' }}>Annuler</button>
                  <button onClick={handleDelete} disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--danger)', color: '#fff' }}>Supprimer</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                Supprimer le remboursement
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
