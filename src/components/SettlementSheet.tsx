import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { formatCAD } from '@/lib/utils'
import type { Person, SettlementRow } from '@/lib/database.types'

interface SettlementSheetProps {
  open: boolean
  onClose: () => void
  settlement?: SettlementRow
  defaultAmount?: number
  defaultFrom?: Person
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

  const title = settlement ? 'Modifier le remboursement' : 'Enregistrer un remboursement'

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', maxHeight: '92svh' }}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center px-5 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            className="sm:hidden text-sm font-medium"
            style={{ color: 'var(--primary)', width: 64 }}
            onClick={onClose}
          >
            Annuler
          </button>
          <h2 className="flex-1 text-center sm:text-left text-base font-semibold" style={{ color: 'var(--fg)' }}>
            {title}
          </h2>
          <button
            className="hidden sm:flex w-8 h-8 sm:w-[30px] sm:h-[30px] rounded-full items-center justify-center text-base font-medium"
            style={{ background: 'var(--muted)', color: 'var(--muted-fg)' }}
            onClick={onClose}
          >
            ✕
          </button>
          <div className="sm:hidden" style={{ width: 64 }} />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex flex-col gap-4 p-5 flex-1">

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>Montant ($)</label>
            <input
              inputMode="decimal"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl px-4 py-4 text-2xl font-bold outline-none border text-center"
              style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
              autoFocus
            />
          </div>

          {/* Who pays */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>Qui rembourse</label>
            <Seg
              options={[
                { value: 'bea' as Person, label: 'Béa' },
                { value: 'phil' as Person, label: 'Phil' },
              ]}
              value={from}
              onChange={setFrom}
            />
            {parseAmount() !== null && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-fg)' }}>
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
              className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border"
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

          {/* Mobile: Enregistrer at bottom of scroll */}
          <button
            className="sm:hidden w-full py-4 sm:py-3.5 rounded-2xl text-sm sm:text-[15px] font-semibold mt-2"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>

        {/* Desktop: sticky footer */}
        <div className="hidden sm:block px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            className="w-full py-4 sm:py-3.5 rounded-2xl text-sm sm:text-[15px] font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--muted)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 py-2.5 rounded-lg text-sm transition-all"
          style={value === opt.value
            ? { background: 'var(--card)', color: 'var(--fg)', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
            : { color: 'var(--muted-fg)' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
