import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { useCategories } from '@/hooks/useCategories'
import { Icon } from '@/lib/icons'
import { formatCAD } from '@/lib/utils'
import { PinPad } from '@/components/PinPad'
import type { RecurringRow, RecurringType, Frequency, Person, Split, PriceRate } from '@/lib/database.types'

interface RecurringSheetProps {
  open: boolean
  onClose: () => void
  recurring?: RecurringRow
  defaultType?: RecurringType
  onSaved?: () => void
}

const TODAY = new Date().toISOString().slice(0, 10)
const CURRENT_YEAR = new Date().getFullYear()

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'semaine', label: 'Par semaine' },
  { value: 'deux_semaines', label: 'Aux 2 sem.' },
  { value: 'mois', label: 'Par mois' },
]

export function RecurringSheet({ open, onClose, recurring, defaultType = 'continue', onSaved }: RecurringSheetProps) {
  const { profile } = useAuth()
  const { household } = useHousehold()
  const { categories } = useCategories()

  const [type, setType] = useState<RecurringType>('continue')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [payer, setPayer] = useState<Person>('bea')
  const [split, setSplit] = useState<Split>('half')
  // Continue fields
  const [frequency, setFrequency] = useState<Frequency>('mois')
  const [startDate, setStartDate] = useState(TODAY)
  const [continueAmountStr, setContinueAmountStr] = useState('')
  const [rates, setRates] = useState<PriceRate[]>([{ from: TODAY, amount: 0 }])
  const [newRateFrom, setNewRateFrom] = useState(TODAY)
  const [newRateAmount, setNewRateAmount] = useState('')
  const [showAddRate, setShowAddRate] = useState(false)
  // Serie fields
  const [occurrences, setOccurrences] = useState(1)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [seriePrice, setSeriePrice] = useState('')
  // State
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    if (recurring) {
      setType(recurring.type)
      setDescription(recurring.description)
      setCategoryId(recurring.category_id ?? null)
      setPayer(recurring.payer)
      setSplit(recurring.split)
      setFrequency(recurring.frequency ?? 'mois')
      setStartDate(recurring.start_date ?? TODAY)
      setRates(recurring.rates.length > 0 ? recurring.rates : [{ from: TODAY, amount: 0 }])
      const currentRateRows = recurring.rates.filter(r => r.from <= TODAY)
      const currentAmt = currentRateRows.length > 0
        ? currentRateRows[currentRateRows.length - 1].amount
        : (recurring.rates[0]?.amount ?? 0)
      setContinueAmountStr(String(currentAmt).replace('.', ','))
      setOccurrences(recurring.occurrences ?? 1)
      setYear(recurring.year ?? CURRENT_YEAR)
      setSeriePrice(recurring.rates[0] ? String(recurring.rates[0].amount).replace('.', ',') : '')
    } else {
      setType(defaultType)
      setDescription('')
      setCategoryId(null)
      setPayer(profile?.person ?? 'bea')
      setSplit('half')
      setFrequency('mois')
      setStartDate(TODAY)
      setContinueAmountStr('')
      setRates([{ from: TODAY, amount: 0 }])
      setOccurrences(1)
      setYear(CURRENT_YEAR)
      setSeriePrice('')
    }
    setShowAddRate(false)
    setNewRateFrom(TODAY)
    setNewRateAmount('')
    setError(null)
    setSaving(false)
    setConfirmDelete(false)
  }, [open, recurring?.id])

  function currentRates(): PriceRate[] {
    if (type === 'serie') {
      const amt = parseFloat(seriePrice.replace(',', '.'))
      return [{ from: `${year}-01-01`, amount: isNaN(amt) ? 0 : Math.round(amt * 100) / 100 }]
    }
    if (!recurring) {
      const amt = parseFloat(continueAmountStr.replace(',', '.'))
      return [{ from: startDate, amount: isNaN(amt) ? 0 : Math.round(amt * 100) / 100 }]
    }
    return rates
  }

  function currentPrice(): number {
    const r = rates.filter(x => x.from <= TODAY)
    return r.length > 0 ? r[r.length - 1].amount : (rates[0]?.amount ?? 0)
  }

  async function handleSave() {
    if (!description.trim()) { setError('La description est requise.'); return }
    if (!household || !profile) return
    const finalRates = currentRates()
    if (type === 'serie') {
      const p = parseFloat(seriePrice.replace(',', '.'))
      if (isNaN(p) || p < 0) { setError('Le prix est invalide.'); return }
    } else if (!recurring) {
      const amt = parseFloat(continueAmountStr.replace(',', '.'))
      if (isNaN(amt) || amt < 0) { setError('Le montant est invalide.'); return }
    } else {
      if (finalRates.some(r => r.amount < 0)) { setError('Un montant est invalide.'); return }
    }
    setError(null); setSaving(true)

    const payload = {
      description: description.trim(),
      category_id: categoryId,
      payer,
      split,
      rates: finalRates,
      ...(type === 'continue'
        ? { type: 'continue' as const, frequency, start_date: startDate, occurrences: null, year: null }
        : { type: 'serie' as const, frequency: null, start_date: null, occurrences, year }),
    }

    if (recurring) {
      const { error: err } = await supabase.from('recurrings').update(payload as never).eq('id', recurring.id)
      setSaving(false)
      if (err) { setError(err.message); return }
    } else {
      const { error: err } = await supabase.from('recurrings').insert({
        household_id: household.id,
        archived: false,
        created_by: profile.id,
        ...payload,
      } as never)
      setSaving(false)
      if (err) { setError(err.message); return }
    }
    onSaved?.()
    onClose()
  }

  async function handleArchive() {
    if (!recurring) return
    setSaving(true)
    await supabase.from('recurrings').update({ archived: !recurring.archived } as never).eq('id', recurring.id)
    setSaving(false)
    onSaved?.()
    onClose()
  }

  async function handleDelete() {
    if (!recurring) return
    setSaving(true)
    await supabase.from('recurrings').delete().eq('id', recurring.id)
    setSaving(false)
    onSaved?.()
    onClose()
  }

  function addRate() {
    const amt = parseFloat(newRateAmount.replace(',', '.'))
    if (isNaN(amt) || amt < 0) { setError('Montant invalide.'); return }
    const entry: PriceRate = { from: newRateFrom, amount: Math.round(amt * 100) / 100 }
    setRates(prev => [...prev.filter(r => r.from !== newRateFrom), entry].sort((a, b) => a.from.localeCompare(b.from)))
    setNewRateAmount('')
    setNewRateFrom(TODAY)
    setShowAddRate(false)
    setError(null)
  }

  function removeRate(from: string) {
    setRates(prev => prev.filter(r => r.from !== from))
  }

  const title = recurring ? 'Modifier' : 'Nouvelle récurrente'

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--appbg)', maxHeight: '92svh' }}
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
          <h2
            className="flex-1 text-center sm:text-left text-base font-semibold"
            style={{ color: 'var(--fg)' }}
          >
            {title}
          </h2>
          <button
            className="hidden sm:flex w-8 h-8 sm:w-[30px] sm:h-[30px] rounded-xl items-center justify-center text-base font-medium"
            style={{ background: 'var(--muted)', color: 'var(--muted-fg)' }}
            onClick={onClose}
          >
            ✕
          </button>
          <div className="sm:hidden" style={{ width: 64 }} />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex flex-col gap-4 p-5 flex-1">

          {/* Type toggle — add mode only */}
          {!recurring && (
            <Seg
              options={[
                { value: 'continue' as RecurringType, label: 'Continue' },
                { value: 'serie' as RecurringType, label: 'Série' },
              ]}
              value={type}
              onChange={setType}
            />
          )}

          {/* Description */}
          <Field label="Description">
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'continue' ? 'Ex. Loyer' : 'Ex. Taxes municipales'}
              className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
              autoFocus
            />
          </Field>

          {/* Category — icon only */}
          <Field label="Catégorie">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
                  className="flex-shrink-0 rounded-xl p-3 transition-all border"
                  style={cat.id === categoryId
                    ? { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary-soft)' }
                    : { background: 'var(--input-bg)', color: 'var(--muted-fg)', borderColor: 'var(--border)' }
                  }
                  title={cat.name}
                >
                  <Icon id={cat.icon} size={22} filled={cat.id === categoryId} />
                </button>
              ))}
            </div>
          </Field>

          {/* Continue fields */}
          {type === 'continue' && (
            <>
              <Field label="Fréquence">
                <Seg options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} />
              </Field>

              {/* Mobile: date standalone + PIN pad (add) or readonly (edit) */}
              <div className="sm:hidden flex flex-col gap-4">
                <Field label="Facturé à partir de">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-base outline-none border"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                  />
                </Field>
                {!recurring ? (
                  <PinPad value={continueAmountStr} onChange={setContinueAmountStr} label="Montant / période ($)" />
                ) : (
                  <Field label="Montant actuel">
                    <div
                      className="w-full rounded-xl px-4 py-3 text-base border"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                    >
                      {formatCAD(currentPrice())}
                    </div>
                  </Field>
                )}
              </div>

              {/* Desktop: date + amount grid */}
              <div className="hidden sm:grid grid-cols-2 gap-3">
                <Field label="Facturé à partir de">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                  />
                </Field>
                <Field label="Montant / période ($)">
                  {recurring ? (
                    <div
                      className="w-full rounded-xl px-4 py-3 text-base sm:text-sm border"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                    >
                      {formatCAD(currentPrice())}
                    </div>
                  ) : (
                    <input
                      inputMode="decimal"
                      value={continueAmountStr}
                      onChange={e => setContinueAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                    />
                  )}
                </Field>
              </div>

              {/* Rates history — edit mode only */}
              {recurring && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Historique des prix</span>
                    <button onClick={() => setShowAddRate(v => !v)} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                      + Ajouter
                    </button>
                  </div>
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {[...rates].sort((a, b) => b.from.localeCompare(a.from)).map((r, i, arr) => (
                      <div key={r.from} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--input-bg)' }}>
                        <div className="flex-1">
                          <div className="text-sm font-semibold" style={{ color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}>{formatCAD(r.amount)}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>depuis le {r.from}</div>
                        </div>
                        {rates.length > 1 && (
                          <button onClick={() => removeRate(r.from)} className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--danger)', background: 'var(--muted)' }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {showAddRate && (
                    <div className="rounded-2xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--border)', background: 'var(--input-bg)' }}>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={newRateFrom} onChange={e => setNewRateFrom(e.target.value)}
                          className="rounded-xl px-3 py-2 text-sm outline-none border"
                          style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }} />
                        <input inputMode="decimal" value={newRateAmount} onChange={e => setNewRateAmount(e.target.value)}
                          placeholder="0,00" className="rounded-xl px-3 py-2 text-sm outline-none border text-right"
                          style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }} />
                      </div>
                      <button onClick={addRate} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
                        Ajouter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Série fields */}
          {type === 'serie' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Occurrences / an">
                  <input
                    inputMode="numeric"
                    value={String(occurrences)}
                    onChange={e => setOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-center"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </Field>
                <Field label="Année">
                  <input
                    inputMode="numeric"
                    value={String(year)}
                    onChange={e => setYear(parseInt(e.target.value) || CURRENT_YEAR)}
                    className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-center"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </Field>
              </div>

              {/* Mobile: PIN pad */}
              <div className="sm:hidden">
                <PinPad value={seriePrice} onChange={setSeriePrice} label="Prix par occurrence ($)" />
              </div>
              {/* Desktop: text input */}
              <div className="hidden sm:block">
                <Field label="Prix par occurrence ($)">
                  <input
                    inputMode="decimal"
                    value={seriePrice}
                    onChange={e => setSeriePrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </Field>
              </div>
            </>
          )}

          {/* Payé par */}
          <Field label="Payé par">
            <Seg
              options={[
                { value: 'bea' as Person, label: 'Béa' },
                { value: 'phil' as Person, label: 'Phil' },
              ]}
              value={payer}
              onChange={setPayer}
            />
          </Field>

          {/* Partage */}
          <Field label="Partage">
            <Seg
              options={[
                { value: 'half' as Split, label: '50/50' },
                { value: 'phil' as Split, label: '100 % Phil' },
                { value: 'bea' as Split, label: '100 % Béa' },
              ]}
              value={split}
              onChange={setSplit}
            />
          </Field>

          {error && <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{error}</p>}

          {/* Edit actions */}
          {recurring && (
            <div className="flex flex-col gap-2">
              {recurring.type === 'continue' && (
                <button
                  onClick={handleArchive}
                  disabled={saving}
                  className="py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}
                >
                  {recurring.archived ? 'Réactiver' : 'Archiver (mettre en pause)'}
                </button>
              )}
              {confirmDelete ? (
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--muted)', color: 'var(--fg)' }}>Annuler</button>
                  <button onClick={handleDelete} disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--danger)', color: '#fff' }}>Supprimer</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                  Supprimer
                </button>
              )}
            </div>
          )}

          {/* Mobile: Enregistrer at bottom of scroll */}
          <button
            className="sm:hidden w-full py-4 rounded-2xl text-sm font-semibold mt-2"
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
            className="w-full py-4 sm:py-3.5 rounded-2xl sm:text-[15px] text-sm font-semibold"
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

// ── Shared helpers ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>{label}</label>
      {children}
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
    <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 py-2.5 rounded-lg text-sm transition-all"
          style={value === opt.value
            ? { background: 'var(--input-bg)', color: 'var(--fg)', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
            : { color: 'var(--muted-fg)' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
