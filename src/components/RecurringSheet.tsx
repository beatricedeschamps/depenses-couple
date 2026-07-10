import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { useCategories } from '@/hooks/useCategories'
import { Icon } from '@/lib/icons'
import { formatCAD } from '@/lib/utils'
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
  { value: 'deux_semaines', label: 'Aux 2 semaines' },
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
  const [rates, setRates] = useState<PriceRate[]>([{ from: TODAY, amount: 0 }])
  // New rate form
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div className="relative w-full max-w-lg flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden" style={{ background: 'var(--card)', maxHeight: '92svh' }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="text-sm font-medium" style={{ color: 'var(--primary)' }}>Annuler</button>
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>
            {recurring ? 'Modifier' : 'Nouvelle récurrente'}
          </h2>
          <button onClick={handleSave} disabled={saving} className="text-sm font-semibold" style={{ color: saving ? 'var(--muted-fg)' : 'var(--primary)' }}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>

        <div className="overflow-y-auto flex flex-col gap-5 p-5 pb-8">
          {/* Type toggle */}
          {!recurring && (
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              {(['continue', 'serie'] as RecurringType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style={type === t
                    ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                    : { background: 'var(--muted)', color: 'var(--muted-fg)' }
                  }
                >
                  {t === 'continue' ? 'Continue' : 'Série'}
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          <Field label="Description">
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'continue' ? 'Ex. Loyer' : 'Ex. Taxes municipales'}
              className="w-full rounded-xl px-4 py-3 text-base outline-none border"
              style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }}
              autoFocus
            />
          </Field>

          {/* Category */}
          <Field label="Catégorie">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 rounded-xl p-2.5"
                  style={cat.id === categoryId
                    ? { background: 'var(--primary-soft)', color: 'var(--primary)', minWidth: 60 }
                    : { background: 'var(--muted)', color: 'var(--muted-fg)', minWidth: 60 }
                  }
                >
                  <Icon id={cat.icon} size={20} filled={cat.id === categoryId} />
                  <span className="text-[10px] font-medium text-center leading-tight" style={{ maxWidth: 56 }}>{cat.name}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Payer + Split */}
          <Field label="Payé par">
            <div className="flex gap-2">
              {(['bea', 'phil'] as Person[]).map(p => (
                <button key={p} onClick={() => setPayer(p)} className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={payer === p ? { background: 'var(--primary)', color: 'var(--primary-fg)' } : { background: 'var(--muted)', color: 'var(--muted-fg)' }}>
                  {p === 'bea' ? 'Béa' : 'Phil'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Partage">
            <div className="flex gap-2">
              {([['half', '50 / 50'], ['phil', 'Phil seul'], ['bea', 'Béa seule']] as [Split, string][]).map(([s, label]) => (
                <button key={s} onClick={() => setSplit(s)} className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={split === s ? { background: 'var(--primary)', color: 'var(--primary-fg)' } : { background: 'var(--muted)', color: 'var(--muted-fg)' }}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* Continue fields */}
          {type === 'continue' && (
            <>
              <Field label="Fréquence">
                <div className="flex flex-col gap-1">
                  {FREQ_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFrequency(opt.value)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium"
                      style={frequency === opt.value
                        ? { background: 'var(--primary-soft)', color: 'var(--primary)' }
                        : { background: 'var(--muted)', color: 'var(--fg)' }
                      }
                    >
                      {opt.label}
                      {frequency === opt.value && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      )}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Date de début">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-base outline-none border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }} />
              </Field>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>Historique des prix</span>
                  <button onClick={() => setShowAddRate(v => !v)} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                    + Ajouter un prix daté
                  </button>
                </div>
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {[...rates].sort((a, b) => b.from.localeCompare(a.from)).map((r, i, arr) => (
                    <div key={r.from} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                  <div className="rounded-2xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
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
                <p className="text-xs px-1" style={{ color: 'var(--muted-fg)' }}>
                  Prix actuel : <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>{formatCAD(currentPrice())}</span>
                </p>
              </div>
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
                    className="w-full rounded-xl px-4 py-3 text-base outline-none border text-center"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </Field>
                <Field label="Année">
                  <input
                    inputMode="numeric"
                    value={String(year)}
                    onChange={e => setYear(parseInt(e.target.value) || CURRENT_YEAR)}
                    className="w-full rounded-xl px-4 py-3 text-base outline-none border text-center"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                  />
                </Field>
              </div>
              <Field label="Prix par occurrence ($)">
                <input
                  inputMode="decimal"
                  value={seriePrice}
                  onChange={e => setSeriePrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl px-4 py-3 text-base outline-none border text-right"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                />
              </Field>
            </>
          )}

          {error && <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{error}</p>}

          {/* Edit actions */}
          {recurring && (
            <div className="flex flex-col gap-2 pt-2">
              {recurring.type === 'continue' && (
                <button onClick={handleArchive} disabled={saving} className="py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}>
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
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>{label}</label>
      {children}
    </div>
  )
}
