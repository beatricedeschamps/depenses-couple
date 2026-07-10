import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useHousehold } from '@/contexts/HouseholdContext'
import { useCategories } from '@/hooks/useCategories'
import { formatCAD } from '@/lib/utils'
import type { Person, Split } from '@/lib/database.types'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

// ── Types ──────────────────────────────────────────────────────────────────

interface ParsedRow {
  key: number
  date: string
  description: string
  amount: number
  selected: boolean
  categoryId: string | null
  payer: Person
  split: Split
  isDuplicate: boolean
}

interface ExistingExpense {
  date: string
  amount: number
  description: string
}

// ── PDF text extraction ────────────────────────────────────────────────────

type TextLine = string[]  // cells sorted left-to-right on one horizontal line

async function extractPdfLines(file: File): Promise<{ lines: TextLine[]; fullText: string }> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const collected: { cells: string[]; sortKey: number }[] = []
  const fullParts: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const byY = new Map<number, { x: number; str: string }[]>()

    for (const item of tc.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round((item as { transform: number[] }).transform[5])
      const x = (item as { transform: number[] }).transform[4]
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push({ x, str: item.str.trim() })
      fullParts.push(item.str)
    }

    for (const [y, items] of byY) {
      const cells = items.sort((a, b) => a.x - b.x).map(i => i.str).filter(Boolean)
      // sortKey: pages in order, y descending (PDF y-axis is bottom-up)
      collected.push({ cells, sortKey: p * 1_000_000 - y })
    }
  }

  collected.sort((a, b) => a.sortKey - b.sortKey)
  return {
    lines: collected.map(r => r.cells),
    fullText: fullParts.join(' '),
  }
}

// ── Parsing helpers ────────────────────────────────────────────────────────

function inferYear(fullText: string): number {
  const matches = [...fullText.matchAll(/20\d{2}/g)].map(m => parseInt(m[0]))
  if (!matches.length) return new Date().getFullYear()
  const counts: Record<number, number> = {}
  for (const y of matches) counts[y] = (counts[y] || 0) + 1
  return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0])
}

const FR_MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function normFrMonth(s: string): string {
  return s.toLowerCase().replace(/féb|feb/, 'fév').replace(/aou|aug/, 'aoû').slice(0, 3)
}

function buildDate(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Returns { date: 'YYYY-MM-DD', consumed: number_of_cells } or null
function tryParseDate(cells: TextLine, year: number): { date: string; consumed: number } | null {
  const c0 = cells[0]?.trim() ?? ''
  const c1 = cells[1]?.trim() ?? ''

  // ISO: 2024-01-15
  const iso = c0.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, consumed: 1 }

  // DD/MM/YYYY
  const dmy = c0.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return { date: buildDate(parseInt(dmy[3]), parseInt(dmy[2]), parseInt(dmy[1])), consumed: 1 }

  // French "04 jan." in one cell
  const fr1 = c0.match(/^(\d{1,2})\s+(jan|fév|féb|mar|avr|mai|juin|juil|aoû|aou|sep|oct|nov|déc)\.?\s*(\d{2,4})?$/i)
  if (fr1) {
    const norm = normFrMonth(fr1[2])
    const idx = FR_MONTHS.map(m => m.slice(0, 3)).indexOf(norm)
    if (idx >= 0) {
      const y = fr1[3] ? (fr1[3].length === 2 ? 2000 + parseInt(fr1[3]) : parseInt(fr1[3])) : year
      return { date: buildDate(y, idx + 1, parseInt(fr1[1])), consumed: 1 }
    }
  }

  // French split: "04" | "jan." (two cells)
  if (/^\d{1,2}$/.test(c0) && c1) {
    const fr2 = c1.match(/^(jan|fév|féb|mar|avr|mai|juin|juil|aoû|aou|sep|oct|nov|déc)\.?\s*(\d{2,4})?$/i)
    if (fr2) {
      const norm = normFrMonth(fr2[1])
      const idx = FR_MONTHS.map(m => m.slice(0, 3)).indexOf(norm)
      if (idx >= 0) {
        const y = fr2[2] ? (fr2[2].length === 2 ? 2000 + parseInt(fr2[2]) : parseInt(fr2[2])) : year
        return { date: buildDate(y, idx + 1, parseInt(c0)), consumed: 2 }
      }
    }
  }

  // English "JAN 04" in one cell
  const en1 = c0.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})$/i)
  if (en1) {
    const idx = EN_MONTHS.indexOf(en1[1].toLowerCase())
    if (idx >= 0) return { date: buildDate(year, idx + 1, parseInt(en1[2])), consumed: 1 }
  }

  // English split: "JAN" | "04" (two cells)
  if (c0 && /^[a-zA-Z]{3,4}$/.test(c0) && c1 && /^\d{1,2}$/.test(c1)) {
    const idx = EN_MONTHS.indexOf(c0.toLowerCase())
    if (idx >= 0) return { date: buildDate(year, idx + 1, parseInt(c1)), consumed: 2 }
  }

  return null
}

function parseAmountStr(s: string): number | null {
  // Remove thousand separators (space or comma before 3-digit group)
  const clean = s.trim().replace(/[ ,](\d{3})(?=\.|$)/g, '$1').replace(',', '.')
  if (/^\d+\.\d{2}$/.test(clean)) {
    const v = parseFloat(clean)
    return v > 0 && v < 100_000 ? v : null
  }
  return null
}

function tryParseAmount(cells: TextLine, startIdx: number): { amount: number; idx: number } | null {
  for (let i = startIdx; i < cells.length; i++) {
    const v = parseAmountStr(cells[i])
    if (v !== null) return { amount: v, idx: i }
  }
  return null
}

// ── Main parser ────────────────────────────────────────────────────────────

const SKIP_DESC = /solde|total|balance|report|brought forward|page|no\. de compte|numéro|relevé/i

function parseTransactions(
  lines: TextLine[],
  fullText: string,
  existing: ExistingExpense[],
  defaultPayer: Person,
): ParsedRow[] {
  const year = inferYear(fullText)
  const results: ParsedRow[] = []

  for (const cells of lines) {
    if (cells.length < 2) continue

    const dateParsed = tryParseDate(cells, year)
    if (!dateParsed) continue

    const { date, consumed } = dateParsed
    const rest = cells.slice(consumed)
    if (!rest.length) continue

    const amountParsed = tryParseAmount(rest, 0)
    if (!amountParsed) continue

    // Description = cells between date and first amount, joined
    const descCells = rest.slice(0, amountParsed.idx)
    const description = descCells.join(' ').trim().replace(/\s+/g, ' ')
    if (!description || description.length < 2) continue
    if (SKIP_DESC.test(description)) continue

    const isDuplicate = existing.some(e =>
      e.date === date &&
      Math.abs(e.amount - amountParsed.amount) < 0.005 &&
      e.description.toLowerCase().includes(description.toLowerCase().slice(0, 8)),
    )

    results.push({
      key: results.length,
      date,
      description,
      amount: amountParsed.amount,
      selected: !isDuplicate,
      categoryId: null,
      payer: defaultPayer,
      split: 'half',
      isDuplicate,
    })
  }

  return results
}

// ── Component ──────────────────────────────────────────────────────────────

interface ImportPdfSheetProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export function ImportPdfSheet({ open, onClose, onSaved }: ImportPdfSheetProps) {
  const { profile } = useAuth()
  const { household } = useHousehold()
  const { categories } = useCategories()

  const [step, setStep] = useState<'pick' | 'review'>('pick')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [defaultPayer, setDefaultPayer] = useState<Person>('bea')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setStep('pick')
      setRows([])
      setParseError(null)
      setParsing(false)
    }
  }, [open])

  async function handleFile(file: File) {
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      setParseError('Veuillez sélectionner un fichier PDF.')
      return
    }
    setParsing(true)
    setParseError(null)
    try {
      const { lines, fullText } = await extractPdfLines(file)

      const { data: existing } = household
        ? await supabase.from('expenses').select('date, amount, description').eq('household_id', household.id)
        : { data: [] }

      const parsed = parseTransactions(lines, fullText, (existing ?? []) as ExistingExpense[], defaultPayer)

      if (parsed.length === 0) {
        setParseError("Aucune transaction détectée. Ce format de relevé n'est peut-être pas pris en charge.")
        setParsing(false)
        return
      }

      setRows(parsed)
      setStep('review')
    } catch (e) {
      setParseError(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setParsing(false)
    }
  }

  function updateRow(key: number, patch: Partial<ParsedRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
  }

  const selectedRows = rows.filter(r => r.selected)
  const total = selectedRows.reduce((s, r) => s + r.amount, 0)

  async function handleSave() {
    if (!household || !profile) return
    setSaving(true)
    const inserts = selectedRows.map(r => ({
      household_id: household.id,
      date: r.date,
      description: r.description,
      category_id: r.categoryId,
      amount: r.amount,
      payer: r.payer,
      split: r.split,
      gas: null,
      created_by: profile.id,
    }))
    await supabase.from('expenses').insert(inserts as never)
    setSaving(false)
    onSaved?.()
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div
        className="relative w-full max-w-2xl flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', maxHeight: '92svh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={step === 'review' ? () => setStep('pick') : onClose}
            className="text-sm font-medium"
            style={{ color: 'var(--primary)' }}
          >
            {step === 'review' ? '← Retour' : 'Annuler'}
          </button>
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>
            {step === 'pick' ? 'Importer un relevé PDF' : `${rows.length} transactions détectées`}
          </h2>
          {step === 'review' ? (
            <button
              onClick={handleSave}
              disabled={saving || selectedRows.length === 0}
              className="text-sm font-semibold"
              style={{ color: saving || selectedRows.length === 0 ? 'var(--muted-fg)' : 'var(--primary)' }}
            >
              {saving ? '…' : `Importer (${selectedRows.length})`}
            </button>
          ) : (
            <div style={{ width: 60 }} />
          )}
        </div>

        {step === 'pick' ? (
          <div className="overflow-y-auto flex flex-col gap-5 p-5 pb-8">
            {/* Default payer */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-fg)' }}>
                Titulaire du compte
              </label>
              <div className="flex gap-2">
                {(['bea', 'phil'] as Person[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setDefaultPayer(p)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={defaultPayer === p
                      ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                      : { background: 'var(--muted)', color: 'var(--muted-fg)' }
                    }
                  >
                    {p === 'bea' ? 'Béa' : 'Phil'}
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
                La personne dont c'est le compte bancaire (payeuse par défaut).
              </p>
            </div>

            {/* Drop zone */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
              className="flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed py-12 px-6 transition-all"
              style={{
                borderColor: 'var(--primary)',
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
              }}
            >
              {parsing ? (
                <>
                  <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                  <span className="text-sm font-semibold">Lecture du PDF…</span>
                </>
              ) : (
                <>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="text-center">
                    <p className="text-base font-semibold">Choisir un fichier PDF</p>
                    <p className="text-xs mt-1 opacity-70">Relevé bancaire (Desjardins, TD, Banque Nationale…)</p>
                  </div>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            {parseError && (
              <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{parseError}</p>
            )}

            <p className="text-xs text-center" style={{ color: 'var(--muted-fg)' }}>
              Le fichier est traité localement — aucune donnée n'est envoyée à un serveur tiers.
            </p>
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
            {/* Summary bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: true })))}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--primary)' }}
                >
                  Tout
                </button>
                <button
                  onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: false })))}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--muted-fg)' }}
                >
                  Aucun
                </button>
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                {selectedRows.length} · {formatCAD(total)}
              </span>
            </div>

            {/* Row list */}
            <div className="overflow-y-auto flex flex-col divide-y" style={{ borderColor: 'var(--border)', flex: 1 }}>
              {rows.map(row => (
                <ReviewRow
                  key={row.key}
                  row={row}
                  categories={categories}
                  onChange={patch => updateRow(row.key, patch)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ReviewRow ──────────────────────────────────────────────────────────────

interface CategoryLike { id: string; name: string }

function ReviewRow({
  row,
  categories,
  onChange,
}: {
  row: ParsedRow
  categories: CategoryLike[]
  onChange: (patch: Partial<ParsedRow>) => void
}) {
  const [showCats, setShowCats] = useState(false)

  return (
    <div
      className="p-4 flex flex-col gap-2.5 transition-all"
      style={{ opacity: row.selected ? 1 : 0.45 }}
    >
      {/* Top row: checkbox + date + amount */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={row.selected}
          onChange={e => onChange({ selected: e.target.checked })}
          className="w-5 h-5 rounded flex-shrink-0"
          style={{ accentColor: 'var(--primary)' }}
        />
        <input
          type="date"
          value={row.date}
          onChange={e => onChange({ date: e.target.value })}
          className="rounded-lg px-2 py-1.5 text-xs border outline-none"
          style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
        />
        <div className="flex-1" />
        <input
          inputMode="decimal"
          value={row.amount.toFixed(2).replace('.', ',')}
          onChange={e => {
            const v = parseFloat(e.target.value.replace(',', '.'))
            if (!isNaN(v) && v > 0) onChange({ amount: v })
          }}
          className="rounded-lg px-2 py-1.5 text-xs border outline-none text-right w-24"
          style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: "'Geist Mono', monospace" }}
        />
        {row.isDuplicate && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--muted)', color: 'var(--muted-fg)' }}>
            doublon?
          </span>
        )}
      </div>

      {/* Description */}
      <input
        value={row.description}
        onChange={e => onChange({ description: e.target.value })}
        className="w-full rounded-lg px-3 py-1.5 text-sm border outline-none"
        style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--fg)' }}
      />

      {/* Category + Payer + Split */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category button */}
        <button
          onClick={() => setShowCats(v => !v)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium border"
          style={{
            background: row.categoryId ? 'var(--primary-soft)' : 'var(--muted)',
            borderColor: 'var(--border)',
            color: row.categoryId ? 'var(--primary)' : 'var(--muted-fg)',
          }}
        >
          {row.categoryId ? (categories.find(c => c.id === row.categoryId)?.name ?? 'Catégorie') : 'Catégorie'}
        </button>

        {/* Payer */}
        {(['bea', 'phil'] as Person[]).map(p => (
          <button
            key={p}
            onClick={() => onChange({ payer: p })}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={row.payer === p
              ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
              : { background: 'var(--muted)', color: 'var(--muted-fg)' }
            }
          >
            {p === 'bea' ? 'Béa' : 'Phil'}
          </button>
        ))}

        {/* Split */}
        {([['half', '50/50'], ['phil', 'Phil'], ['bea', 'Béa']] as [Split, string][]).map(([s, label]) => (
          <button
            key={s}
            onClick={() => onChange({ split: s })}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={row.split === s
              ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
              : { background: 'var(--muted)', color: 'var(--muted-fg)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category picker inline */}
      {showCats && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { onChange({ categoryId: null }); setShowCats(false) }}
            className="rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{ background: !row.categoryId ? 'var(--primary)' : 'var(--muted)', color: !row.categoryId ? 'var(--primary-fg)' : 'var(--muted-fg)' }}
          >
            Aucune
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { onChange({ categoryId: cat.id }); setShowCats(false) }}
              className="rounded-lg px-2.5 py-1 text-xs font-medium"
              style={row.categoryId === cat.id
                ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                : { background: 'var(--muted)', color: 'var(--muted-fg)' }
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
