import { useState } from 'react'
import { useRecurrings } from '@/hooks/useRecurrings'
import { useCategories } from '@/hooks/useCategories'
import { RecurringSheet } from '@/components/RecurringSheet'
import { Icon } from '@/lib/icons'
import { formatCAD } from '@/lib/utils'
import { occurrenceDates, priceAt } from '@/lib/balance'
import type { RecurringRow } from '@/lib/database.types'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const CURRENT_YEAR = new Date().getFullYear()
const TODAY = new Date().toISOString().slice(0, 10)

function dateShort(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

function nextOccLabel(r: RecurringRow): string {
  const dates = occurrenceDates(r, CURRENT_YEAR).filter(d => d > TODAY)
  if (dates.length > 0) return dateShort(dates[0])
  if (r.type === 'continue') {
    // Check next year
    const nextYear = occurrenceDates(r, CURRENT_YEAR + 1)
    if (nextYear.length > 0) return `${dateShort(nextYear[0])} ${CURRENT_YEAR + 1}`
  }
  return "terminée"
}

function freqLabel(r: RecurringRow) {
  if (r.type === 'serie') return `${r.occurrences ?? 1}× par an`
  if (r.frequency === 'semaine') return 'Par semaine'
  if (r.frequency === 'deux_semaines') return 'Aux 2 sem.'
  return 'Par mois'
}

function currentPrice(r: RecurringRow): number {
  return priceAt(r.rates, TODAY)
}

export function RecurrentesPage() {
  const { recurrings, loading, reload } = useRecurrings()
  const { categories } = useCategories()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editRecurring, setEditRecurring] = useState<RecurringRow | undefined>()
  const [finishedOpen, setFinishedOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  const actives = recurrings.filter(r => !r.archived)
  const continues = actives.filter(r => r.type === 'continue')
  const seriesCurrent = actives.filter(r => r.type === 'serie' && r.year === CURRENT_YEAR)
  const seriesFinished = actives.filter(r => r.type === 'serie' && r.year !== CURRENT_YEAR)
  const archived = recurrings.filter(r => r.archived)

  function openEdit(r: RecurringRow) {
    setEditRecurring(r)
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
    <div className="flex flex-col pb-10">
      {/* Continues */}
      <Section title="Continues">
        {continues.length === 0 ? (
          <EmptyCard label="Aucune dépense continue." />
        ) : (
          <RecurringList items={continues} catMap={catMap} onEdit={openEdit} subtitle={r => freqLabel(r)} badge={r => nextOccLabel(r)} />
        )}
      </Section>

      {/* Séries année courante */}
      <Section title={`Séries ${CURRENT_YEAR}`}>
        {seriesCurrent.length === 0 ? (
          <EmptyCard label={`Aucune série pour ${CURRENT_YEAR}.`} />
        ) : (
          <RecurringList items={seriesCurrent} catMap={catMap} onEdit={openEdit} subtitle={r => freqLabel(r)} badge={r => nextOccLabel(r)} />
        )}
      </Section>

      {/* Terminées (past series) */}
      {seriesFinished.length > 0 && (
        <Section
          title="Terminées"
          collapsible
          open={finishedOpen}
          onToggle={() => setFinishedOpen(v => !v)}
        >
          {finishedOpen && (
            <RecurringList items={seriesFinished} catMap={catMap} onEdit={openEdit} subtitle={r => String(r.year)} />
          )}
        </Section>
      )}

      {/* Archivées */}
      {archived.length > 0 && (
        <Section
          title="Archivées"
          collapsible
          open={archivedOpen}
          onToggle={() => setArchivedOpen(v => !v)}
        >
          {archivedOpen && (
            <RecurringList items={archived} catMap={catMap} onEdit={openEdit} subtitle={r => freqLabel(r)} muted />
          )}
        </Section>
      )}

      <RecurringSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditRecurring(undefined) }}
        recurring={editRecurring}
        onSaved={reload}
      />
    </div>
  )
}

interface RecurringListProps {
  items: RecurringRow[]
  catMap: Record<string, { icon: string; name: string }>
  onEdit: (r: RecurringRow) => void
  subtitle: (r: RecurringRow) => string
  badge?: (r: RecurringRow) => string
  muted?: boolean
}

function RecurringList({ items, catMap, onEdit, subtitle, badge, muted }: RecurringListProps) {
  return (
    <div className="rounded-2xl border overflow-hidden mx-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      {items.map((r, i) => {
        const cat = r.category_id ? catMap[r.category_id] : null
        const iconId = cat?.icon ?? 'receipt'
        const price = currentPrice(r)
        return (
          <button
            key={r.id}
            onClick={() => onEdit(r)}
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
            style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: muted ? 'var(--muted)' : 'var(--primary-soft)', color: muted ? 'var(--muted-fg)' : 'var(--primary)' }}>
              <Icon id={iconId} size={18} filled={!muted} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: muted ? 'var(--muted-fg)' : 'var(--fg)' }}>{r.description}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{subtitle(r)}</span>
                {cat && (
                  <>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{cat.name}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-sm font-semibold" style={{ color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}>{formatCAD(price)}</span>
              {badge && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: 'var(--primary-soft)', color: 'var(--primary-soft-fg)' }}>
                  {badge(r)}
                </span>
              )}
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--border)', flexShrink: 0 }}>
              <path d="M1 1l6 6-6 6" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

function Section({ title, children, collapsible, open, onToggle }: {
  title: string
  children: React.ReactNode
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="mt-5">
      <div
        className={`flex items-center justify-between px-5 mb-3 ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? onToggle : undefined}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>{title}</h3>
        {collapsible && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--muted-fg)', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="mx-4 rounded-2xl border p-5 text-center text-sm" style={{ borderColor: 'var(--border)', borderStyle: 'dashed', color: 'var(--muted-fg)', background: 'var(--card)' }}>
      {label}
    </div>
  )
}
