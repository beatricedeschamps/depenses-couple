import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { useCategories } from '@/hooks/useCategories'
import { useSettings } from '@/hooks/useSettings'
import { Icon } from '@/lib/icons'
import { formatCAD } from '@/lib/utils'
import { PinPad } from '@/components/PinPad'
import type { ExpenseRow, GasDetails, Person, Split } from '@/lib/database.types'

interface ExpenseSheetProps {
  open: boolean
  onClose: () => void
  expense?: ExpenseRow
  onSaved?: () => void
}

const TODAY = new Date().toISOString().slice(0, 10)

export function ExpenseSheet({ open, onClose, expense, onSaved }: ExpenseSheetProps) {
  const { profile } = useAuth()
  const { household } = useHousehold()
  const { categories } = useCategories()
  const { settings } = useSettings()

  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(TODAY)
  const [amountStr, setAmountStr] = useState('')
  const [payer, setPayer] = useState<Person>((profile?.person ?? 'bea'))
  const [split, setSplit] = useState<Split>('half')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Gas calculator state
  const [useGas, setUseGas] = useState(false)
  const [gasVehicleId, setGasVehicleId] = useState('')
  const [gasTripId, setGasTripId] = useState<string | null>(null)
  const [gasKm, setGasKm] = useState('')
  const [gasToll, setGasToll] = useState('0')
  const [gasPrice, setGasPrice] = useState('')

  const descRef = useRef<HTMLInputElement>(null)

  const selectedCat = categories.find(c => c.id === categoryId)
  const isCar = selectedCat?.icon === 'car'

  // Reset gas when category leaves 'car'
  useEffect(() => {
    if (!isCar) setUseGas(false)
  }, [isCar])

  // Populate when editing
  useEffect(() => {
    if (open && expense) {
      setDescription(expense.description)
      setCategoryId(expense.category_id ?? null)
      setDate(expense.date)
      setAmountStr(expense.amount.toFixed(2).replace('.', ','))
      setPayer(expense.payer)
      setSplit(expense.split)
      setConfirmDelete(false)
      if (expense.gas) {
        setUseGas(true)
        setGasVehicleId(expense.gas.vehicleId)
        setGasTripId(null)
        setGasKm(String(expense.gas.distanceKm))
        setGasToll(expense.gas.tollAmount.toFixed(2).replace('.', ','))
        setGasPrice(expense.gas.gasPricePerL.toFixed(3).replace('.', ','))
      } else {
        setUseGas(false)
        setGasVehicleId('')
        setGasTripId(null)
        setGasKm('')
        setGasToll('0')
        setGasPrice('')
      }
    } else if (open) {
      setDescription('')
      setCategoryId(null)
      setDate(TODAY)
      setAmountStr('')
      setPayer(profile?.person ?? 'bea')
      setSplit('half')
      setConfirmDelete(false)
      setUseGas(false)
      setGasVehicleId('')
      setGasTripId(null)
      setGasKm('')
      setGasToll('0')
      setGasPrice('')
    }
    setError(null)
    setSaving(false)
  }, [open, expense?.id])

  useEffect(() => {
    if (open) setTimeout(() => descRef.current?.focus(), 100)
  }, [open])

  function parseAmount(): number | null {
    const n = parseFloat(amountStr.replace(',', '.'))
    return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100
  }

  const gasVehicle = settings.vehicles.find(v => v.id === gasVehicleId)
  const gasAmount = (() => {
    if (!useGas || !gasVehicle) return null
    const km = parseFloat(gasKm.replace(',', '.'))
    const toll = parseFloat(gasToll.replace(',', '.')) || 0
    const price = parseFloat(gasPrice.replace(',', '.'))
    if (isNaN(km) || km <= 0 || isNaN(price) || price <= 0) return null
    return Math.round(((km / 100) * gasVehicle.l100 * price + toll) * 100) / 100
  })()

  function finalAmount(): number | null {
    return useGas ? gasAmount : parseAmount()
  }

  function enableGas() {
    setUseGas(true)
    if (!gasPrice) setGasPrice(settings.default_gas_price.toFixed(3).replace('.', ','))
    if (!gasVehicleId && settings.vehicles.length > 0) setGasVehicleId(settings.vehicles[0].id)
  }

  function selectTrip(tripId: string) {
    const trip = settings.trips.find(t => t.id === tripId)
    if (!trip) return
    setGasTripId(tripId)
    setGasKm(String(trip.km))
    setGasToll(trip.toll.toFixed(2).replace('.', ','))
  }

  async function handleSave() {
    const amount = finalAmount()
    if (!description.trim()) { setError('La description est requise.'); return }
    if (!amount) { setError(useGas ? 'Complétez les champs gaz pour calculer le montant.' : 'Le montant doit être un nombre positif.'); return }
    if (!household || !profile) return
    setError(null); setSaving(true)

    const gasDetails: GasDetails | null = (useGas && gasAmount !== null && gasVehicleId) ? {
      distanceKm: parseFloat(gasKm.replace(',', '.')),
      tollAmount: parseFloat(gasToll.replace(',', '.')) || 0,
      gasPricePerL: parseFloat(gasPrice.replace(',', '.')),
      vehicleId: gasVehicleId,
    } : null

    if (expense) {
      const { error: err } = await supabase.from('expenses').update({
        description: description.trim(),
        category_id: categoryId,
        date,
        amount,
        payer,
        split,
        gas: gasDetails,
      } as never).eq('id', expense.id)
      setSaving(false)
      if (err) { setError(err.message); return }
    } else {
      const { error: err } = await supabase.from('expenses').insert({
        household_id: household.id,
        description: description.trim(),
        category_id: categoryId,
        date,
        amount,
        payer,
        split,
        gas: gasDetails,
        created_by: profile.id,
      } as never)
      setSaving(false)
      if (err) { setError(err.message); return }
    }
    onSaved?.()
    onClose()
  }

  async function handleDelete() {
    if (!expense) return
    setSaving(true)
    await supabase.from('expenses').delete().eq('id', expense.id)
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const title = expense ? 'Modifier la dépense' : 'Nouvelle dépense'

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
        <div className="flex items-center px-5 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button className="sm:hidden text-sm font-medium" style={{ color: 'var(--primary)', width: 64 }} onClick={onClose}>
            Annuler
          </button>
          <h2 className="flex-1 text-center sm:text-left text-base font-semibold" style={{ color: 'var(--fg)' }}>
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

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
              Description
            </label>
            <input
              ref={descRef}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex. Épicerie Metro"
              className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
            />
          </div>

          {/* Category — icon only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
              Catégorie
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
                  className="flex-shrink-0 flex items-center justify-center rounded-xl p-3 transition-all border"
                  style={cat.id === categoryId
                    ? { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary)' }
                    : { background: 'var(--input-bg)', color: 'var(--muted-fg)', borderColor: 'var(--border)' }
                  }
                  title={cat.name}
                >
                  <Icon id={cat.icon} size={22} filled={cat.id === categoryId} />
                </button>
              ))}
            </div>
          </div>

          {/* Gas calculator — only when Déplacement category selected */}
          {isCar && (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => useGas ? setUseGas(false) : enableGas()}
                className="flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
                style={useGas
                  ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                  : { background: 'var(--muted)', color: 'var(--muted-fg)', border: '1px solid var(--border)' }
                }
              >
                <Icon id="car" size={16} filled={useGas} />
                {useGas ? 'Calculateur gaz actif' : 'Calculer le gaz'}
              </button>

              {useGas && (
                <div className="flex flex-col gap-4 rounded-2xl p-4 border" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>

                  {/* Vehicle selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
                      Véhicule
                    </label>
                    {settings.vehicles.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>
                        Aucun véhicule — ajoutez-en dans Paramètres.
                      </p>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {settings.vehicles.map(v => (
                          <button
                            key={v.id}
                            onClick={() => setGasVehicleId(v.id)}
                            className="rounded-xl px-3 py-2 text-sm font-medium transition-all"
                            style={gasVehicleId === v.id
                              ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                              : { background: 'var(--input-bg)', color: 'var(--fg)', border: '1px solid var(--border)' }
                            }
                          >
                            {v.name}
                            <span className="ml-1 text-xs opacity-70">{v.l100} L/100</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trip preset selector */}
                  {settings.trips.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
                        Trajet préenregistré
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setGasTripId(null)}
                          className="rounded-xl px-3 py-2 text-sm font-medium transition-all"
                          style={gasTripId === null
                            ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                            : { background: 'var(--input-bg)', color: 'var(--fg)', border: '1px solid var(--border)' }
                          }
                        >
                          Manuel
                        </button>
                        {settings.trips.map(t => (
                          <button
                            key={t.id}
                            onClick={() => selectTrip(t.id)}
                            className="rounded-xl px-3 py-2 text-sm font-medium transition-all"
                            style={gasTripId === t.id
                              ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                              : { background: 'var(--input-bg)', color: 'var(--fg)', border: '1px solid var(--border)' }
                            }
                          >
                            {t.name}
                            <span className="ml-1 text-xs opacity-70">{t.km} km</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Distance + Toll */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
                        Distance (km)
                      </label>
                      <input
                        inputMode="decimal"
                        value={gasKm}
                        onChange={e => { setGasKm(e.target.value); setGasTripId(null) }}
                        placeholder="0"
                        className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
                        Péage ($)
                      </label>
                      <input
                        inputMode="decimal"
                        value={gasToll}
                        onChange={e => { setGasToll(e.target.value); setGasTripId(null) }}
                        placeholder="0,00"
                        className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                      />
                    </div>
                  </div>

                  {/* Gas price */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
                      Prix essence ($/L)
                    </label>
                    <input
                      inputMode="decimal"
                      value={gasPrice}
                      onChange={e => setGasPrice(e.target.value)}
                      placeholder="1,520"
                      className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                    />
                  </div>

                  {/* Computed result */}
                  {gasAmount !== null && gasVehicle && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--primary-soft)', color: 'var(--primary-soft-fg)' }}>
                      <p className="text-sm font-semibold mb-1">
                        Montant calculé : {formatCAD(gasAmount)}
                      </p>
                      <p className="text-xs opacity-80">
                        {gasKm} km × {gasVehicle.l100} L/100 × {parseFloat(gasPrice.replace(',', '.')).toFixed(3)} $/L
                        {parseFloat(gasToll.replace(',', '.')) > 0 ? ` + ${formatCAD(parseFloat(gasToll.replace(',', '.')))} péage` : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mobile: Date standalone + PIN pad for amount (hidden when gas active) */}
          <div className="sm:hidden flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base outline-none border"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
              />
            </div>
            {!useGas && (
              <PinPad value={amountStr} onChange={setAmountStr} label="Montant ($)" />
            )}
          </div>

          {/* Desktop: Date + Amount grid */}
          <div className="hidden sm:grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl px-4 py-3 sm:text-sm outline-none border"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Montant ($)</label>
              {useGas ? (
                <div
                  className="w-full rounded-xl px-4 py-3 sm:text-sm text-right border"
                  style={{
                    background: 'var(--input-bg)', borderColor: 'var(--border)',
                    color: gasAmount !== null ? 'var(--fg)' : 'var(--muted-fg)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {gasAmount !== null ? gasAmount.toFixed(2).replace('.', ',') : '—'}
                </div>
              ) : (
                <input
                  inputMode="decimal"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl px-4 py-3 sm:text-sm outline-none border text-right"
                  style={{
                    background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                />
              )}
            </div>
          </div>

          {/* Payer */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
              Payé par
            </label>
            <Seg
              options={[
                { value: 'bea' as Person, label: 'Béa' },
                { value: 'phil' as Person, label: 'Phil' },
              ]}
              value={payer}
              onChange={setPayer}
            />
          </div>

          {/* Split */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
              Partage
            </label>
            <Seg
              options={[
                { value: 'half' as Split, label: '50/50' },
                { value: 'phil' as Split, label: '100 % Phil' },
                { value: 'bea' as Split, label: '100 % Béa' },
              ]}
              value={split}
              onChange={setSplit}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          {/* Delete */}
          {expense && (
            confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-center" style={{ color: 'var(--muted-fg)' }}>
                  Supprimer cette dépense ?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--muted)', color: 'var(--fg)' }}>
                    Annuler
                  </button>
                  <button onClick={handleDelete} disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--danger)', color: '#fff' }}>
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                Supprimer la dépense
              </button>
            )
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

