import { useState, useEffect } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { useCategories } from '@/hooks/useCategories'
import { useHousehold } from '@/contexts/HouseholdContext'
import { supabase } from '@/lib/supabase'
import { Icon, ALL_ICONS } from '@/lib/icons'
import type { Vehicle, Trip, CategoryRow } from '@/lib/database.types'

function uid() {
  return crypto.randomUUID()
}

export function ParamètresPage() {
  const { settings, update } = useSettings()
  const { categories, loading: catLoading, reload: reloadCats } = useCategories()
  const { household } = useHousehold()

  // ── Véhicules ──
  const [vehName, setVehName] = useState('')
  const [vehL100, setVehL100] = useState('')

  function addVehicle() {
    const l = parseFloat(vehL100.replace(',', '.'))
    if (!vehName.trim() || isNaN(l) || l <= 0) return
    update({ vehicles: [...settings.vehicles, { id: uid(), name: vehName.trim(), l100: l }] })
    setVehName(''); setVehL100('')
  }

  function updateVehicle(id: string, patch: Partial<Vehicle>) {
    update({ vehicles: settings.vehicles.map(v => v.id === id ? { ...v, ...patch } : v) })
  }

  function deleteVehicle(id: string) {
    update({ vehicles: settings.vehicles.filter(v => v.id !== id) })
  }

  // ── Trajets ──
  const [tripName, setTripName] = useState('')
  const [tripKm, setTripKm] = useState('')
  const [tripToll, setTripToll] = useState('')

  function addTrip() {
    const km = parseFloat(tripKm.replace(',', '.'))
    if (!tripName.trim() || isNaN(km) || km <= 0) return
    const toll = parseFloat(tripToll.replace(',', '.')) || 0
    update({ trips: [...settings.trips, { id: uid(), name: tripName.trim(), km, toll }] })
    setTripName(''); setTripKm(''); setTripToll('')
  }

  function updateTrip(id: string, patch: Partial<Trip>) {
    update({ trips: settings.trips.map(t => t.id === id ? { ...t, ...patch } : t) })
  }

  function deleteTrip(id: string) {
    update({ trips: settings.trips.filter(t => t.id !== id) })
  }

  // ── Catégories ──
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('tag')
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null) // categoryId or 'new'
  const [catSaving, setCatSaving] = useState(false)

  async function addCategory() {
    if (!newCatName.trim() || !household) return
    setCatSaving(true)
    await supabase.from('categories').insert({ household_id: household.id, name: newCatName.trim(), icon: newCatIcon } as never)
    setNewCatName(''); setNewCatIcon('tag')
    setCatSaving(false)
    reloadCats()
  }

  async function updateCatIcon(cat: CategoryRow, icon: string) {
    await supabase.from('categories').update({ icon } as never).eq('id', cat.id)
    setIconPickerFor(null)
    reloadCats()
  }

  async function updateCatName(cat: CategoryRow, name: string) {
    await supabase.from('categories').update({ name } as never).eq('id', cat.id)
  }

  async function deleteCategory(cat: CategoryRow) {
    await supabase.from('categories').delete().eq('id', cat.id)
    reloadCats()
  }

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Prix essence ──
  const [gasPriceStr, setGasPriceStr] = useState('')
  const [gasPriceSaved, setGasPriceSaved] = useState(false)

  function saveGasPrice() {
    const p = parseFloat(gasPriceStr.replace(',', '.'))
    if (isNaN(p) || p <= 0) return
    update({ default_gas_price: p })
    setGasPriceSaved(true)
    setTimeout(() => setGasPriceSaved(false), 2000)
  }

  return (
    <div style={isDesktop ? { maxWidth: 640, margin: '0 auto' } : {}}>
      {isDesktop && (
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg)', padding: '30px 20px 24px', margin: 0 }}>
          Paramètres
        </h1>
      )}
      <div className="flex flex-col pb-16">
      {/* ── Prix essence ── */}
      <Section title="Prix d'essence par défaut ($/L)">
        <div className="mx-4 flex gap-2">
          <input
            inputMode="decimal"
            value={gasPriceStr || String(settings.default_gas_price).replace('.', ',')}
            onChange={e => setGasPriceStr(e.target.value)}
            placeholder="1,52"
            className="flex-1 rounded-xl px-4 py-3 text-base outline-none border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
          />
          <button
            onClick={saveGasPrice}
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
          >
            {gasPriceSaved ? '✓' : 'Enregistrer'}
          </button>
        </div>
      </Section>

      {/* ── Véhicules ── */}
      <Section title="Véhicules">
        <div className="mx-4 flex flex-col gap-2">
          {settings.vehicles.map(v => (
            <div key={v.id} className="rounded-2xl border p-3 flex flex-col gap-2" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex gap-2">
                <input
                  value={v.name}
                  onChange={e => updateVehicle(v.id, { name: e.target.value })}
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                  placeholder="Nom"
                />
                {settings.vehicles.length > 1 && (
                  <button onClick={() => deleteVehicle(v.id)} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--danger)' }}>
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs flex-1" style={{ color: 'var(--muted-fg)' }}>Consommation (L/100 km)</span>
                <input
                  inputMode="decimal"
                  value={String(v.l100).replace('.', ',')}
                  onChange={e => { const n = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(n)) updateVehicle(v.id, { l100: n }) }}
                  className="w-20 rounded-xl px-3 py-2 text-sm text-right outline-none border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
                />
              </div>
            </div>
          ))}
          {/* Add vehicle */}
          <div className="rounded-2xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--border)', borderStyle: 'dashed', background: 'var(--card)' }}>
            <div className="flex gap-2">
              <input value={vehName} onChange={e => setVehName(e.target.value)} placeholder="Nom du véhicule"
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none border"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }} />
              <input inputMode="decimal" value={vehL100} onChange={e => setVehL100(e.target.value)} placeholder="L/100"
                className="w-20 rounded-xl px-3 py-2 text-sm text-right outline-none border"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }} />
            </div>
            <button onClick={addVehicle} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
              Ajouter le véhicule
            </button>
          </div>
        </div>
      </Section>

      {/* ── Trajets ── */}
      <Section title="Trajets enregistrés">
        <div className="mx-4 flex flex-col gap-2">
          {settings.trips.map(t => (
            <div key={t.id} className="rounded-2xl border p-3 flex flex-col gap-2" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="flex gap-2">
                <input value={t.name} onChange={e => updateTrip(t.id, { name: e.target.value })}
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none border"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }} placeholder="Nom" />
                <button onClick={() => deleteTrip(t.id)} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--danger)' }}>
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
                  </svg>
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>km</span>
                  <input inputMode="decimal" value={String(t.km).replace('.', ',')}
                    onChange={e => { const n = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(n)) updateTrip(t.id, { km: n }) }}
                    className="flex-1 rounded-xl px-3 py-2 text-sm text-right outline-none border"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }} />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>péage $</span>
                  <input inputMode="decimal" value={String(t.toll).replace('.', ',')}
                    onChange={e => { const n = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(n)) updateTrip(t.id, { toll: n }) }}
                    className="flex-1 rounded-xl px-3 py-2 text-sm text-right outline-none border"
                    style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }} />
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--border)', borderStyle: 'dashed', background: 'var(--card)' }}>
            <input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="Nom du trajet"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border"
              style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }} />
            <div className="flex gap-2">
              <input inputMode="decimal" value={tripKm} onChange={e => setTripKm(e.target.value)} placeholder="Distance (km)"
                className="flex-1 rounded-xl px-3 py-2 text-sm text-right outline-none border"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }} />
              <input inputMode="decimal" value={tripToll} onChange={e => setTripToll(e.target.value)} placeholder="Péage ($)"
                className="flex-1 rounded-xl px-3 py-2 text-sm text-right outline-none border"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }} />
            </div>
            <button onClick={addTrip} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
              Ajouter le trajet
            </button>
          </div>
        </div>
      </Section>

      {/* ── Catégories ── */}
      <Section title="Catégories">
        <div className="mx-4 flex flex-col gap-2">
          {catLoading ? null : categories.map(cat => (
            <div key={cat.id} className="relative">
              <div className="rounded-2xl border flex items-center gap-3 px-3 py-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <button onClick={() => setIconPickerFor(iconPickerFor === cat.id ? null : cat.id)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <Icon id={cat.icon} size={20} filled />
                </button>
                <input
                  defaultValue={cat.name}
                  onBlur={e => updateCatName(cat, e.target.value)}
                  className="flex-1 text-sm font-medium outline-none bg-transparent"
                  style={{ color: 'var(--fg)' }}
                />
                <button onClick={() => deleteCategory(cat)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: 'var(--danger)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
                  </svg>
                </button>
              </div>
              {iconPickerFor === cat.id && (
                <IconPicker onSelect={icon => updateCatIcon(cat, icon)} />
              )}
            </div>
          ))}
          {/* Add category */}
          <div className="rounded-2xl border p-3 flex flex-col gap-2" style={{ borderColor: 'var(--border)', borderStyle: 'dashed', background: 'var(--card)' }}>
            <div className="flex gap-2 items-center">
              <button onClick={() => setIconPickerFor(iconPickerFor === 'new' ? null : 'new')}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <Icon id={newCatIcon} size={20} filled />
              </button>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nom de la catégorie"
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none border"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }} />
            </div>
            {iconPickerFor === 'new' && (
              <IconPicker onSelect={icon => { setNewCatIcon(icon); setIconPickerFor(null) }} />
            )}
            <button onClick={addCategory} disabled={catSaving} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
              {catSaving ? '…' : 'Ajouter la catégorie'}
            </button>
          </div>
        </div>
      </Section>
      </div>
    </div>
  )
}

function IconPicker({ onSelect }: { onSelect: (icon: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2 p-3 rounded-2xl border" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
      {ALL_ICONS.map(id => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--card)', color: 'var(--fg)' }}
        >
          <Icon id={id} size={20} />
        </button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="px-5 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}
