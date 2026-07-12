import { useRef } from 'react'

interface PinPadProps {
  value: string    // formatted e.g. "1,74" or ""
  onChange: (v: string) => void
  label?: string
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const

export function PinPad({ value, onChange, label }: PinPadProps) {
  const bsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasLong = useRef(false)

  // Derive current digit string from formatted value (e.g. "1,74" → "174")
  const digits = value
    ? String(Math.round(parseFloat(value.replace(',', '.')) * 100))
    : ''

  function handleKey(key: string) {
    if (key === '⌫') {
      const d = digits.slice(0, -1)
      const cents = parseInt(d || '0')
      onChange(cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : '')
    } else {
      if (digits === '' && (key === '0' || key === '00')) return
      const d = digits + key
      const cents = parseInt(d)
      onChange((cents / 100).toFixed(2).replace('.', ','))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>{label}</label>
      )}

      {/* Amount readout */}
      <div
        className="text-center py-3 leading-none font-bold tracking-tight"
        style={{
          fontSize: '2.75rem',
          color: value ? 'var(--fg)' : 'var(--muted-fg)',
          fontFamily: "'Geist Mono', monospace",
        }}
      >
        {value || '0,00'}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map(key => {
          const isBs = key === '⌫'
          return (
            <button
              key={key}
              type="button"
              className="rounded-xl py-3.5 text-xl font-semibold select-none transition-opacity active:opacity-60"
              style={{
                background: isBs ? 'var(--muted)' : 'var(--input-bg)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
              }}
              onPointerDown={isBs ? () => {
                wasLong.current = false
                bsTimer.current = setTimeout(() => {
                  wasLong.current = true
                  onChange('')
                }, 600)
              } : undefined}
              onPointerUp={isBs ? () => {
                if (bsTimer.current) clearTimeout(bsTimer.current)
                if (!wasLong.current) handleKey('⌫')
              } : undefined}
              onPointerLeave={isBs ? () => {
                if (bsTimer.current) clearTimeout(bsTimer.current)
              } : undefined}
              onContextMenu={isBs ? (e) => e.preventDefault() : undefined}
              onClick={!isBs ? () => handleKey(key) : undefined}
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
