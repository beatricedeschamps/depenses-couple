import { Icon } from '@/lib/icons'
import { formatCAD } from '@/lib/utils'

interface Vehicle { id: string; name: string; l100: number }
interface Trip { id: string; name: string; km: number; toll: number }

interface GasModuleProps {
  vehicles: Vehicle[]
  trips: Trip[]
  vehicleId: string
  tripId: string | null
  km: string
  toll: string
  gasPrice: string
  onVehicleChange: (id: string) => void
  // Unified callback for trip select + manual km/toll edits (all three update atomically)
  onTripChange: (id: string | null, km: string, toll: string) => void
  onGasPriceChange: (price: string) => void
}

export function GasModule({
  vehicles, trips, vehicleId, tripId, km, toll, gasPrice,
  onVehicleChange, onTripChange, onGasPriceChange,
}: GasModuleProps) {
  const vehicle = vehicles.find(v => v.id === vehicleId)

  const computed = (() => {
    if (!vehicle) return null
    const kmN = parseFloat(km.replace(',', '.'))
    const tollN = parseFloat(toll.replace(',', '.')) || 0
    const priceN = parseFloat(gasPrice.replace(',', '.'))
    if (isNaN(kmN) || kmN <= 0 || isNaN(priceN) || priceN <= 0) return null
    return Math.round(((kmN / 100) * vehicle.l100 * priceN + tollN) * 100) / 100
  })()

  function handleTripSelect(id: string) {
    if (!id) { onTripChange(null, km, toll); return }
    const trip = trips.find(t => t.id === id)
    if (trip) onTripChange(id, String(trip.km), trip.toll.toFixed(2).replace('.', ','))
  }

  const inputStyle = { background: 'var(--muted)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }
  const divider = { borderColor: 'var(--border)' }
  const sectionBase = { background: 'var(--card)' }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Montant — calculé automatiquement</span>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>

        {/* Trajet enregistré */}
        {trips.length > 0 && (
          <div className="px-4 py-3 border-b" style={{ ...sectionBase, ...divider }}>
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Trajet enregistré</label>
            <select
              value={tripId ?? ''}
              onChange={e => handleTripSelect(e.target.value)}
              className="mt-1.5 w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none"
              style={{ background: 'var(--muted)', color: 'var(--fg)' }}
            >
              <option value="">Choisir un trajet…</option>
              {trips.map(t => (
                <option key={t.id} value={t.id}>{t.name} — {t.km} km</option>
              ))}
            </select>
          </div>
        )}

        {/* Distance + Péage */}
        <div className="px-4 py-3 border-b grid grid-cols-2 gap-4" style={{ ...sectionBase, ...divider }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Distance (km)</label>
            <input
              inputMode="decimal"
              value={km}
              onChange={e => onTripChange(null, e.target.value, toll)}
              placeholder="0"
              className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none text-right"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Péage ($)</label>
            <input
              inputMode="decimal"
              value={toll}
              onChange={e => onTripChange(null, km, e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none text-right"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Véhicule — only if 0 or 2+ */}
        {vehicles.length === 0 && (
          <div className="px-4 py-3 border-b" style={{ ...sectionBase, ...divider }}>
            <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>Aucun véhicule — ajoutez-en dans Paramètres.</p>
          </div>
        )}
        {vehicles.length >= 2 && (
          <div className="px-4 py-3 border-b" style={{ ...sectionBase, ...divider }}>
            <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Véhicule</label>
            <div className="flex gap-2 flex-wrap mt-1.5">
              {vehicles.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { if (v.id !== vehicleId) onVehicleChange(v.id) }}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border"
                  style={vehicleId === v.id
                    ? { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary)' }
                    : { background: 'var(--muted)', color: 'var(--muted-fg)', borderColor: 'var(--border)' }
                  }
                >
                  <Icon id="car" size={15} filled={vehicleId === v.id} />
                  {v.name}
                  <span className="opacity-60">{v.l100} L/100</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prix essence */}
        <div className="px-4 py-3 border-b" style={{ ...sectionBase, ...divider }}>
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Prix essence ($/L)</label>
          <input
            inputMode="decimal"
            value={gasPrice}
            onChange={e => onGasPriceChange(e.target.value)}
            placeholder="1,520"
            className="mt-1.5 w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none text-right"
            style={inputStyle}
          />
        </div>

        {/* Résultat calculé */}
        <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'var(--muted)' }}>
          <p className="text-xs leading-snug" style={{ color: 'var(--muted-fg)' }}>
            {vehicle
              ? `${km || '0'} km × ${vehicle.l100} L/100 × ${parseFloat(gasPrice.replace(',', '.') || '0').toFixed(2)}${parseFloat(toll.replace(',', '.')) > 0 ? ` + ${formatCAD(parseFloat(toll.replace(',', '.')))} péage` : ''}`
              : 'Ajoutez un véhicule dans Paramètres.'}
          </p>
          <p className="text-xl font-bold flex-shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: 'var(--fg)' }}>
            {formatCAD(computed ?? 0)}
          </p>
        </div>

      </div>
    </div>
  )
}

// Exported utility so parent components can compute the same amount for saving
export function computeGasAmount(
  vehicle: { l100: number } | undefined,
  km: string,
  toll: string,
  gasPrice: string,
): number | null {
  if (!vehicle) return null
  const kmN = parseFloat(km.replace(',', '.'))
  const tollN = parseFloat(toll.replace(',', '.')) || 0
  const priceN = parseFloat(gasPrice.replace(',', '.'))
  if (isNaN(kmN) || kmN <= 0 || isNaN(priceN) || priceN <= 0) return null
  return Math.round(((kmN / 100) * vehicle.l100 * priceN + tollN) * 100) / 100
}
