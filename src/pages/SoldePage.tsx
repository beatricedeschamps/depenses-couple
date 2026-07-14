import { useState, useEffect } from 'react'
import { useLedger } from '@/hooks/useLedger'
import { SettlementSheet } from '@/components/SettlementSheet'
import { Icon } from '@/lib/icons'
import { formatCAD } from '@/lib/utils'
import type { SettlementRow, Person } from '@/lib/database.types'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`
}

export function SoldePage() {
  const { ledger, balance, loading, reload } = useLedger()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editSettlement, setEditSettlement] = useState<SettlementRow | undefined>()

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const currentYear = new Date().getFullYear()
  const ys = String(currentYear)
  const abs = Math.abs(balance)
  const debtor: Person = balance > 0 ? 'bea' : 'phil'

  // Totals paid this year (excluding settlements)
  const yearEntries = ledger.filter(m => m.date.startsWith(ys) && m.kind !== 'remb')
  const beaPaid = yearEntries.filter(m => m.payer === 'bea').reduce((s, m) => s + m.amount, 0)
  const philPaid = yearEntries.filter(m => m.payer === 'phil').reduce((s, m) => s + m.amount, 0)

  // Settlement history (all years, newest first)
  const settlements = ledger.filter(m => m.kind === 'remb').map(m => m.settlement!)

  function openEdit(s: SettlementRow) {
    setEditSettlement(s)
    setSheetOpen(true)
  }

  function openNew() {
    setEditSettlement(undefined)
    setSheetOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted-fg)' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
        </svg>
      </div>
    )
  }

  return (
    <div style={isDesktop ? { maxWidth: 620, margin: '0 auto' } : {}}>
      {isDesktop && (
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg)', padding: '30px 20px 24px', margin: 0 }}>
          Solde
        </h1>
      )}
      <div className="flex flex-col gap-0 pb-10">
      {/* Solde principal */}
      <div className="mx-4 mt-4 rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="px-5 pt-5 pb-4">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-fg)' }}>
            Solde {currentYear}
          </div>
          {Math.round(balance * 100) === 0 ? (
            <>
              <div className="text-3xl font-bold tracking-tight" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>À jour !</div>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-fg)' }}>Aucune dette en cours.</p>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold tracking-tight" style={{ color: 'var(--fg)', letterSpacing: '-0.02em', fontFamily: "'Geist Mono', monospace" }}>
                {formatCAD(abs)}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-fg)' }}>
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{debtor === 'bea' ? 'Béa' : 'Phil'}</span>
                {' '}doit à{' '}
                <span style={{ fontWeight: 600 }}>{debtor === 'bea' ? 'Phil' : 'Béa'}</span>
              </p>
            </>
          )}
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={openNew}
            className="w-full py-3.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
          >
            Enregistrer un remboursement
          </button>
        </div>
      </div>

      {/* Détail de l'année */}
      <div className="px-5 pt-5 pb-2">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>
          Détail {currentYear}
        </div>
      </div>
      <div className="flex flex-col gap-2 mx-4">
        <StatRow label="Béa a payé" value={formatCAD(beaPaid)} />
        <StatRow label="Phil a payé" value={formatCAD(philPaid)} />
        <StatRow label="Total des dépenses" value={formatCAD(beaPaid + philPaid)} muted />
      </div>

      {/* Historique des remboursements */}
      <div className="px-5 pt-5 pb-2">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>
          Historique des remboursements
        </div>
      </div>
      <div className="flex flex-col gap-2 mx-4">
        {settlements.length === 0 ? (
          <div className="rounded-2xl border p-5 text-center text-sm" style={{ borderColor: 'var(--border)', borderStyle: 'dashed', color: 'var(--muted-fg)', background: 'var(--card)' }}>
            Aucun remboursement pour l'instant.
          </div>
        ) : (
          settlements.map(s => (
            <button
              key={s.id}
              onClick={() => openEdit(s)}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <Icon id="refund" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                  {s.from_person === 'bea' ? 'Béa → Phil' : 'Phil → Béa'}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted-fg)' }}>{fmtDate(s.date)}</div>
              </div>
              <div className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--primary)', fontFamily: "'Geist Mono', monospace" }}>
                {formatCAD(s.amount)}
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--border)', flexShrink: 0 }}>
                <path d="M1 1l6 6-6 6" />
              </svg>
            </button>
          ))
        )}
      </div>

      <SettlementSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditSettlement(undefined) }}
        settlement={editSettlement}
        defaultAmount={Math.round(abs * 100) === 0 ? undefined : abs}
        defaultFrom={debtor}
        onSaved={reload}
      />
      </div>
    </div>
  )
}

function StatRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border px-4 py-3.5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <span className="text-sm" style={{ color: muted ? 'var(--muted-fg)' : 'var(--fg)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}>{value}</span>
    </div>
  )
}
