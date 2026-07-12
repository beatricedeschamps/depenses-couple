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

  return (
    <div className="flex flex-col gap-3">

      {/* Saved trip dropdown */}
      {trips.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Trajet enregistré</label>
          <select
            value={tripId ?? ''}
            onChange={e => handleTripSelect(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border"
            style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
          >
            <option value="">Aucun trajet</option>
            {trips.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.km} km</option>
            ))}
          </select>
        </div>
      )}

      {/* Distance + Toll */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Distance (km)</label>
          <input
            inputMode="decimal"
            value={km}
            onChange={e => onTripChange(null, e.target.value, toll)}
            placeholder="0"
            className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
            style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Péage ($)</label>
          <input
            inputMode="decimal"
            value={toll}
            onChange={e => onTripChange(null, km, e.target.value)}
            placeholder="0,00"
            className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
            style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
          />
        </div>
      </div>

      {/* Vehicle selector — only if 2+ vehicles */}
      {vehicles.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>
          Aucun véhicule — ajoutez-en dans Paramètres.
        </p>
      )}
      {vehicles.length >= 2 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Véhicule</label>
          <div className="flex gap-2 flex-wrap">
            {vehicles.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => { if (v.id !== vehicleId) onVehicleChange(v.id) }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border"
                style={vehicleId === v.id
                  ? { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary)' }
                  : { background: 'var(--input-bg)', color: 'var(--muted-fg)', borderColor: 'var(--border)' }
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

      {/* Gas price */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Prix essence ($/L)</label>
        <input
          inputMode="decimal"
          value={gasPrice}
          onChange={e => onGasPriceChange(e.target.value)}
          placeholder="1,520"
          className="w-full rounded-xl px-4 py-3 text-base sm:text-sm outline-none border text-right"
          style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
        />
      </div>

      {/* Computed result */}
      {computed !== null && vehicle ? (
        <div className="rounded-xl px-4 py-3" style={{ background: 'var(--primary-soft)', color: 'var(--primary-soft-fg)' }}>
          <p className="text-sm font-semibold">{formatCAD(computed)}</p>
          <p className="text-xs opacity-70 mt-0.5">
            {km} km × {vehicle.l100} L/100 × {parseFloat(gasPrice.replace(',', '.')).toFixed(3)} $/L
            {parseFloat(toll.replace(',', '.')) > 0 ? ` + ${formatCAD(parseFloat(toll.replace(',', '.')))} péage` : ''}
          </p>
        </div>
      ) : (
        <div className="rounded-xl px-4 py-3" style={{ background: 'var(--muted)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>
            {vehicles.length === 0 ? 'Ajoutez un véhicule dans Paramètres.' : 'Entrez la distance pour calculer le montant.'}
          </p>
        </div>
      )}
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
