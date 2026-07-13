import { useState, useMemo, useRef } from 'react'
import { useLedger } from '@/hooks/useLedger'
import { useCategories } from '@/hooks/useCategories'
import { ExpenseSheet } from '@/components/ExpenseSheet'
import { Icon } from '@/lib/icons'
import { formatCAD } from '@/lib/utils'
import { exportToXlsx } from '@/lib/exportXlsx'
import type { LedgerEntry } from '@/lib/balance'
import type { ExpenseRow, CategoryRow } from '@/lib/database.types'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const PAGE_SIZE = 40

type EntryKind = 'ponctuelle' | 'continue' | 'serie' | 'remboursement'

interface Filters {
  types: EntryKind[]
  payer: 'all' | 'bea' | 'phil'
  split: 'all' | 'half' | 'phil' | 'bea'
  year: string
}

const DEFAULT_FILTERS: Filters = { types: [], payer: 'all', split: 'all', year: 'all' }

function entryKind(e: LedgerEntry): EntryKind {
  if (e.kind === 'remb') return 'remboursement'
  if (e.kind === 'ponct') return 'ponctuelle'
  return e.recurring?.type === 'serie' ? 'serie' : 'continue'
}

function applyFilters(ledger: LedgerEntry[], f: Filters): LedgerEntry[] {
  return ledger.filter(e => {
    if (f.types.length && !f.types.includes(entryKind(e))) return false
    if (f.year !== 'all' && !e.date.startsWith(f.year)) return false
    if (f.payer !== 'all') {
      const p = e.kind === 'remb' ? e.fromPerson : e.payer
      if (p !== f.payer) return false
    }
    if (f.split !== 'all') {
      if (e.kind === 'remb') return false
      if (e.split !== f.split) return false
    }
    return true
  })
}

function dateLabel(iso: string) {
  const today = new Date().toISOString().slice(0, 10)
  if (iso === today) return "Aujourd'hui"
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (iso === yesterday) return 'Hier'
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`
}

function groupByDate(entries: LedgerEntry[]) {
  const groups: { date: string; label: string; entries: LedgerEntry[] }[] = []
  for (const e of entries) {
    const last = groups[groups.length - 1]
    if (last && last.date === e.date) last.entries.push(e)
    else groups.push({ date: e.date, label: dateLabel(e.date), entries: [e] })
  }
  return groups
}

function hasFilters(f: Filters) {
  return f.types.length > 0 || f.payer !== 'all' || f.split !== 'all' || f.year !== 'all'
}

export function RelevePage() {
  const { ledger, balance, loading, reload } = useLedger()
  const { categories } = useCategories()
  const [balanceCollapsed, setBalanceCollapsed] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [editExpense, setEditExpense] = useState<ExpenseRow | undefined>()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])

  // Available years from ledger
  const years = useMemo(() => {
    const ys = new Set(ledger.map(e => e.date.slice(0, 4)))
    return [...ys].sort((a, b) => b.localeCompare(a))
  }, [ledger])

  const filtered = useMemo(() => applyFilters(ledger, filters), [ledger, filters])
  const visibleEntries = filtered.slice(0, visible)
  const groups = groupByDate(visibleEntries)
  const hasMore = filtered.length > visible
  const active = hasFilters(filters)

  function handleEntryClick(e: LedgerEntry) {
    if (e.kind === 'ponct' && e.expense) {
      setEditExpense(e.expense)
      setSheetOpen(true)
    }
  }

  function doExport() {
    exportToXlsx(filtered, catMap)
  }

  const abs = Math.abs(balance)
  const debtor = balance > 0 ? 'Béa' : 'Phil'
  const creditor = balance > 0 ? 'Phil' : 'Béa'

  return (
    <div className="flex flex-col min-h-0">
      {/* Balance header */}
      <div
        className="mx-4 mt-4 mb-0 rounded-2xl border overflow-hidden cursor-pointer"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={() => setBalanceCollapsed(v => !v)}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--muted-fg)' }}>
              Solde {new Date().getFullYear()}
            </div>
            {Math.round(balance * 100) === 0 ? (
              <div className="text-base font-bold" style={{ color: 'var(--fg)' }}>À jour !</div>
            ) : (
              <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                <span style={{ color: 'var(--danger)' }}>{debtor}</span> doit{' '}
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{formatCAD(abs)}</span> à {creditor}
              </div>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--muted-fg)', transform: balanceCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {!balanceCollapsed && Math.round(balance * 100) !== 0 && (
          <div className="px-4 pb-3 pt-0">
            <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
              {debtor} doit rembourser{' '}
              <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600, color: 'var(--fg)' }}>{formatCAD(abs)}</span>{' '}
              à {creditor} pour l'année en cours.
            </p>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          ref={filterBtnRef}
          onClick={() => setFilterPanelOpen(v => !v)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
          style={{
            background: filterPanelOpen ? 'var(--primary-soft)' : 'var(--card)',
            borderColor: filterPanelOpen || active ? 'var(--primary)' : 'var(--border)',
            color: filterPanelOpen || active ? 'var(--primary)' : 'var(--fg)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16M7 12h10M10 19h4"/>
          </svg>
          Filtrer
        </button>
        {/* Active filter pills */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto min-w-0">
          <ActiveFilterPills filters={filters} onChange={setFilters} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--fg)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>
            </svg>
            xlsx
          </button>
          <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>
            {filtered.length} entrée{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        ledger.length === 0 ? <EmptyState /> : (
          <div className="mx-4 rounded-2xl border p-8 text-center text-sm" style={{ borderColor: 'var(--border)', borderStyle: 'dashed', color: 'var(--muted-fg)' }}>
            Aucune entrée ne correspond aux filtres.
          </div>
        )
      ) : (
        <div className="flex flex-col mx-4">
          {groups.map(group => (
            <div key={group.date} className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: 'var(--muted-fg)' }}>
                {group.label}
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                {group.entries.map((entry, i) => (
                  <LedgerRow key={entry.id} entry={entry} catMap={catMap} isLast={i === group.entries.length - 1} onClick={() => handleEntryClick(entry)} />
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setVisible(v => v + PAGE_SIZE)}
              className="mb-4 py-3 rounded-2xl border text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'var(--card)' }}
            >
              Afficher {Math.min(PAGE_SIZE, filtered.length - visible)} de plus
            </button>
          )}
        </div>
      )}

      {/* Filter panel */}
      {filterPanelOpen && (
        <FilterPanel
          filters={filters}
          years={years}
          onChange={setFilters}
          onClose={() => setFilterPanelOpen(false)}
          anchorEl={filterBtnRef.current}
        />
      )}

      <ExpenseSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditExpense(undefined) }}
        expense={editExpense}
        onSaved={reload}
      />
    </div>
  )
}

// ── Active filter pills ────────────────────────────────────────────────────────

function ActiveFilterPills({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const KIND_LABELS: Record<EntryKind, string> = {
    ponctuelle: 'Ponctuelle', continue: 'Continue', serie: 'Série', remboursement: 'Remb.',
  }
  const SPLIT_LABELS: Record<string, string> = { half: '50/50', phil: 'Phil seul', bea: 'Béa seule' }

  const pills: { label: string; onRemove: () => void }[] = []
  if (filters.types.length > 0) {
    pills.push({ label: filters.types.map(t => KIND_LABELS[t]).join(', '), onRemove: () => onChange({ ...filters, types: [] }) })
  }
  if (filters.year !== 'all') {
    pills.push({ label: filters.year, onRemove: () => onChange({ ...filters, year: 'all' }) })
  }
  if (filters.payer !== 'all') {
    pills.push({ label: filters.payer === 'bea' ? 'Béa' : 'Phil', onRemove: () => onChange({ ...filters, payer: 'all' }) })
  }
  if (filters.split !== 'all') {
    pills.push({ label: SPLIT_LABELS[filters.split], onRemove: () => onChange({ ...filters, split: 'all' }) })
  }

  return (
    <>
      {pills.map((p, i) => (
        <button
          key={i}
          onClick={p.onRemove}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
          style={{ background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary)' }}
        >
          {p.label}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M2 2l6 6M8 2l-6 6"/>
          </svg>
        </button>
      ))}
    </>
  )
}

// ── Filter panel ──────────────────────────────────────────────────────────────

function FilterPanel({ filters, years, onChange, onClose, anchorEl }: {
  filters: Filters
  years: string[]
  onChange: (f: Filters) => void
  onClose: () => void
  anchorEl?: HTMLElement | null
}) {
  const KINDS: { value: EntryKind; label: string }[] = [
    { value: 'ponctuelle', label: 'Ponctuelles' },
    { value: 'continue', label: 'Continues' },
    { value: 'serie', label: 'Séries' },
    { value: 'remboursement', label: 'Remboursements' },
  ]

  function toggleType(t: EntryKind) {
    onChange({ ...filters, types: filters.types.includes(t) ? filters.types.filter(x => x !== t) : [...filters.types, t] })
  }

  const isDesktop = window.innerWidth >= 1024
  const anchorRect = (isDesktop && anchorEl) ? anchorEl.getBoundingClientRect() : null

  const body = (
    <div className="p-4 flex flex-col gap-4">
      <FilterSection label="Type">
        <div className="flex flex-wrap gap-2">
          {KINDS.map(k => (
            <button key={k.value} onClick={() => toggleType(k.value)}
              className="px-3 py-2 rounded-xl text-sm font-medium"
              style={filters.types.includes(k.value)
                ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                : { background: 'var(--muted)', color: 'var(--fg)' }
              }>
              {k.label}
            </button>
          ))}
        </div>
      </FilterSection>
      <FilterSection label="Année">
        <div className="flex flex-wrap gap-2">
          <PillOption label="Toutes" active={filters.year === 'all'} onClick={() => onChange({ ...filters, year: 'all' })} />
          {years.map(y => (
            <PillOption key={y} label={y} active={filters.year === y} onClick={() => onChange({ ...filters, year: y })} />
          ))}
        </div>
      </FilterSection>
      <FilterSection label="Payé par">
        <div className="flex gap-2">
          {(['all', 'bea', 'phil'] as const).map(p => (
            <PillOption key={p} label={p === 'all' ? 'Tous' : p === 'bea' ? 'Béa' : 'Phil'}
              active={filters.payer === p} onClick={() => onChange({ ...filters, payer: p })} />
          ))}
        </div>
      </FilterSection>
      <FilterSection label="Partage">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'half', 'phil', 'bea'] as const).map(s => (
            <PillOption key={s}
              label={s === 'all' ? 'Tous' : s === 'half' ? '50/50' : s === 'phil' ? 'Phil seul' : 'Béa seule'}
              active={filters.split === s} onClick={() => onChange({ ...filters, split: s })} />
          ))}
        </div>
      </FilterSection>
    </div>
  )

  // Desktop: headerless popover anchored to the filter button
  if (anchorRect) {
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div
          className="fixed z-50 rounded-2xl border shadow-xl overflow-hidden"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            top: anchorRect.bottom + 8,
            left: anchorRect.left,
            width: 300,
          }}
        >
          {body}
        </div>
      </>
    )
  }

  // Mobile: bottom sheet, close via handle or backdrop
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div className="relative w-full flex flex-col rounded-t-3xl overflow-hidden" style={{ background: 'var(--card)', maxHeight: '80svh' }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Filtres</h2>
          <button onClick={onClose} className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>Fermer</button>
        </div>
        <div className="overflow-y-auto">{body}</div>
      </div>
    </div>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>{label}</span>
      {children}
    </div>
  )
}

function PillOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-xl text-sm font-medium"
      style={active ? { background: 'var(--primary)', color: 'var(--primary-fg)' } : { background: 'var(--muted)', color: 'var(--fg)' }}>
      {label}
    </button>
  )
}

// ── Ledger row ────────────────────────────────────────────────────────────────

function LedgerRow({ entry, catMap, isLast, onClick }: {
  entry: LedgerEntry; catMap: Record<string, CategoryRow>; isLast: boolean; onClick: () => void
}) {
  const cat = entry.categoryId ? catMap[entry.categoryId] : null
  const iconId = cat?.icon ?? (entry.kind === 'remb' ? 'refund' : 'receipt')
  const isClickable = entry.kind === 'ponct'

  return (
    <div onClick={isClickable ? onClick : undefined} className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor: isClickable ? 'pointer' : 'default' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: entry.kind === 'remb' ? 'var(--primary-soft)' : 'var(--muted)', color: entry.kind === 'remb' ? 'var(--primary)' : 'var(--muted-fg)' }}>
        <Icon id={iconId} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
          {entry.kind === 'remb'
            ? `Remboursement · ${entry.fromPerson === 'bea' ? 'Béa → Phil' : 'Phil → Béa'}`
            : entry.description}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {entry.kind !== 'remb' && (
            <span className="text-xs font-medium" style={{ color: 'var(--muted-fg)' }}>{entry.payer === 'bea' ? 'Béa' : 'Phil'}</span>
          )}
          {cat && <><span style={{ color: 'var(--border)' }}>·</span><span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{cat.name}</span></>}
          {entry.kind === 'recur' && <><span style={{ color: 'var(--border)' }}>·</span><span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{entry.recurring?.type === 'serie' ? 'Série' : 'Continue'}</span></>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <div className="text-sm font-semibold" style={{ color: entry.kind === 'remb' ? 'var(--primary)' : 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}>
            {entry.kind === 'remb' ? '+' : ''}{formatCAD(entry.amount)}
          </div>
          {entry.kind !== 'remb' && entry.split && (
            <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>{entry.split === 'half' ? '50/50' : entry.split === 'phil' ? 'Phil' : 'Béa'}</div>
          )}
        </div>
        {isClickable && (
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--border)' }}>
            <path d="M1 1l6 6-6 6" />
          </svg>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 gap-3">
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--muted)' }}>
        <Icon id="receipt" size={28} style={{ color: 'var(--muted-fg)' }} />
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Aucune transaction</p>
      <p className="text-sm text-center" style={{ color: 'var(--muted-fg)' }}>Appuie sur + pour ajouter ta première dépense.</p>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted-fg)' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  )
}
