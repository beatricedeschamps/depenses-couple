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

type TextLine = string[]

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

    for (const [, items] of byY) {
      const cells = items.sort((a, b) => a.x - b.x).map(i => i.str).filter(Boolean)
      const sortKey = p * 1_000_000 - items[0].x
      collected.push({ cells, sortKey })
    }
  }

  collected.sort((a, b) => a.sortKey - b.sortKey)
  return { lines: collected.map(r => r.cells), fullText: fullParts.join(' ') }
}

// ── Parsing helpers ────────────────────────────────────────────────────────

function inferYear(text: string): number {
  const matches = [...text.matchAll(/20\d{2}/g)].map(m => parseInt(m[0]))
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

function tryParseDate(cells: TextLine, year: number): { date: string; consumed: number } | null {
  const c0 = cells[0]?.trim() ?? ''
  const c1 = cells[1]?.trim() ?? ''

  const iso = c0.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, consumed: 1 }

  const dmy = c0.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return { date: buildDate(parseInt(dmy[3]), parseInt(dmy[2]), parseInt(dmy[1])), consumed: 1 }

  const fr1 = c0.match(/^(\d{1,2})\s+(jan|fév|féb|mar|avr|mai|juin|juil|aoû|aou|sep|oct|nov|déc)\.?\s*(\d{2,4})?$/i)
  if (fr1) {
    const norm = normFrMonth(fr1[2])
    const idx = FR_MONTHS.map(m => m.slice(0, 3)).indexOf(norm)
    if (idx >= 0) {
      const y = fr1[3] ? (fr1[3].length === 2 ? 2000 + parseInt(fr1[3]) : parseInt(fr1[3])) : year
      return { date: buildDate(y, idx + 1, parseInt(fr1[1])), consumed: 1 }
    }
  }

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

  const en1 = c0.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})$/i)
  if (en1) {
    const idx = EN_MONTHS.indexOf(en1[1].toLowerCase())
    if (idx >= 0) return { date: buildDate(year, idx + 1, parseInt(en1[2])), consumed: 1 }
  }

  if (c0 && /^[a-zA-Z]{3,4}$/.test(c0) && c1 && /^\d{1,2}$/.test(c1)) {
    const idx = EN_MONTHS.indexOf(c0.toLowerCase())
    if (idx >= 0) return { date: buildDate(year, idx + 1, parseInt(c1)), consumed: 2 }
  }

  return null
}

function parseAmountStr(s: string): number | null {
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

const SKIP_DESC = /solde|total|balance|report|brought forward|page|no\. de compte|numéro|relevé/i

function parsePdfTransactions(
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

// ── Text paste parser (Desjardins web banking) ─────────────────────────────
// Targets "Lien" column summary lines: "12 Juillet Dollarama 6,71 $"

const FR_MONTHS_FULL: Record<string, number> = {
  'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
  'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12,
}

// day · full-FR-month · description · optional-sign · amount (with optional thousands space) · $
const LIEN_RE = /^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(.*?)\s+(\+?[\d]+(?:\s\d{3})?,\d{2})\s*\$\s*$/

// Desjardins category labels → app icon IDs (primary categorization source)
const DESJARDINS_CAT_MAP: Record<string, string> = {
  'épicerie': 'cart', 'épiceries': 'cart', 'supermarché': 'cart', 'supermarchés': 'cart',
  'restaurant': 'coffee', 'restaurants': 'coffee', 'café': 'coffee', 'cafés': 'coffee', 'bar': 'coffee', 'bars': 'coffee',
  'téléphone': 'bolt', 'télécommunications': 'bolt', 'services': 'bolt',
  'transport': 'car', 'transports': 'car',
  'voyage': 'plane', 'voyages': 'plane', 'hôtel': 'plane', 'hôtels': 'plane',
  'santé': 'heart', 'soins de santé': 'heart', 'pharmacie': 'heart', 'pharmacies': 'heart', 'soins personnels': 'heart',
  'sport': 'dumbbell', 'sports': 'dumbbell', 'loisirs': 'ticket', 'divertissement': 'ticket',
  'éducation': 'book', 'livres': 'book',
  'maison': 'home', 'ameublement': 'home', 'rénovation': 'home',
  'vêtements': 'gift', 'habillement': 'gift', 'boutique': 'gift',
  'animaux': 'paw',
  'assurance': 'shield', 'assurances': 'shield',
  'électronique': 'wrench', 'informatique': 'wrench', 'logiciels': 'wrench',
}

function parseDesjardinsText(
  raw: string,
  existing: ExistingExpense[],
  defaultPayer: Person,
  categories: { id: string; icon: string }[],
): ParsedRow[] {
  const year = inferYear(raw)
  const lines = raw.split('\n').map(l => l.trim())
  const results: ParsedRow[] = []

  // Collect all Lien lines with their positions
  type LienMatch = { idx: number; day: number; month: number; description: string; amount: number }
  const lienLines: LienMatch[] = []

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LIEN_RE)
    if (!m) continue
    const day = parseInt(m[1])
    const month = FR_MONTHS_FULL[m[2].toLowerCase()]
    if (!month) continue
    if (m[4].startsWith('+')) continue
    const description = m[3].replace(/\.\s*$/, '').trim()
    if (!description || description.length < 2 || /^total$/i.test(description)) continue
    const amount = parseFloat(m[4].replace(/\s/g, '').replace(',', '.'))
    if (isNaN(amount) || amount <= 0 || amount >= 100_000) continue
    lienLines.push({ idx: i, day, month, description, amount })
  }

  for (let li = 0; li < lienLines.length; li++) {
    const { idx, day, month, description, amount } = lienLines[li]

    // Lines between the previous Lien line (exclusive) and this one contain
    // the Desjardins category label, merchant name, and amount detail.
    const searchStart = li > 0 ? lienLines[li - 1].idx + 1 : 0
    const contextLines = lines.slice(searchStart, idx)

    let categoryId: string | null = null
    for (const ctxLine of contextLines) {
      const icon = DESJARDINS_CAT_MAP[ctxLine.toLowerCase()]
      if (icon) {
        categoryId = categories.find(c => c.icon === icon)?.id ?? null
        break
      }
    }
    if (!categoryId) categoryId = autoAssignCategory(description, categories)

    const date = buildDate(year, month, day)
    const isDuplicate = existing.some(e =>
      e.date === date &&
      Math.abs(e.amount - amount) < 0.005 &&
      e.description.toLowerCase().includes(description.toLowerCase().slice(0, 8)),
    )

    results.push({
      key: results.length,
      date,
      description,
      amount,
      selected: !isDuplicate,
      categoryId,
      payer: defaultPayer,
      split: 'half',
      isDuplicate,
    })
  }

  return results
}

// ── Image parser via Supabase Edge Function ────────────────────────────────

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const MAX_PX = 1280
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.onerror = reject
    img.src = url
  })
}

async function parseImageViaEdge(
  file: File,
  existing: ExistingExpense[],
  defaultPayer: Person,
): Promise<ParsedRow[]> {
  const year = new Date().getFullYear()
  const { base64, mimeType } = await fileToBase64(file)

  const { data, error } = await supabase.functions.invoke('parse-statement', {
    body: { image: base64, mimeType, year },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  const items = data.transactions as { date: string; description: string; amount: number }[]
  return items.map((item, idx) => {
    const isDuplicate = existing.some(e =>
      e.date === item.date &&
      Math.abs(e.amount - item.amount) < 0.005 &&
      e.description.toLowerCase().includes(item.description.toLowerCase().slice(0, 8)),
    )
    return {
      key: idx,
      date: item.date,
      description: item.description,
      amount: item.amount,
      selected: !isDuplicate,
      categoryId: null,
      payer: defaultPayer,
      split: 'half' as Split,
      isDuplicate,
    }
  })
}

// ── Auto-catégorisation par mots-clés ──────────────────────────────────────
// Chaque règle : [mots-clés, icon de la catégorie cible]

const CAT_RULES: [string[], string][] = [
  // Épicerie & courses courantes
  [['metro', 'iga', 'maxi', 'provigo', 'loblaws', 'walmart', 'costco', 'dollarama', 'dollar', 'marché', 'épicerie'], 'cart'],
  // Restaurants & cafés
  [['restaurant', 'resto', 'café', 'cafe', 'brasserie', 'bistro', 'taverne', 'pizza', 'sushi', 'burger', 'mcdonald', 'subway', 'tim horton', 'starbucks', 'second cup', 'goza', 'reggiano', 'boulangerie'], 'coffee'],
  // Streaming & abonnements numériques
  [['netflix', 'disney', 'prime video', 'crave', 'tubi', 'apple tv', 'dazn', 'spotify', 'apple music', 'tidal', 'youtube premium'], 'music'],
  // Logiciels & tech
  [['anthropic', 'claude sub', 'openai', 'chatgpt', 'github', 'microsoft', 'adobe', 'google one', 'dropbox', 'notion', 'slack', 'cursor', '1password'], 'wrench'],
  // Téléphone & télécoms
  [['fizz', 'vidéotron', 'videotron', 'bell', 'rogers', 'telus', 'koodo', 'public mobile', 'fido', 'chatr', 'illico', 'helix'], 'bolt'],
  // Électricité, gaz & énergie
  [['hydro', 'hydro-québec', 'énergir', 'gaz métro', 'éngie', 'engie'], 'bolt'],
  // Transport en commun & mobilité
  [['opus', 'stm', 'exo', 'bixi', 'chrono-recharge', 'chrono recharge', 'réseau express', 'via rail', 'amtrak', 'uber', 'lyft', 'taxi'], 'car'],
  // Voyage & hôtels
  [['air canada', 'westjet', 'air transat', 'hôtel', 'hotel', 'airbnb', 'booking', 'expedia', 'trivago', 'aéroport', 'airport'], 'plane'],
  // Santé & pharmacie
  [['pharmaprix', 'jean coutu', 'brunet', 'uniprix', 'shoppers', 'pharmacie', 'médecin', 'dentiste', 'optique', 'clinique', 'physio', 'massothérapie'], 'heart'],
  // Sport & plein air
  [['sail', 'sport expert', 'décathlon', 'atmosphere', 'altitude', 'gym', 'crossfit', 'yoga', 'swimming', 'natation'], 'dumbbell'],
  // Culture & spectacles
  [['place des arts', 'cinéma', 'cinema', 'théâtre', 'festival', 'musée', 'concert', 'spectacle', 'billetterie', 'evenko', 'ticketmaster'], 'ticket'],
  // Éducation & livres
  [['librairie', 'renaud-bray', 'archambault', 'udemy', 'coursera', 'école', 'université', 'kindle'], 'book'],
  // Maison & rénovation
  [['ikea', 'structube', 'homesense', 'rona', 'canadian tire', 'home depot', 'pascal', 'réno-dépôt', 'réno dépôt'], 'home'],
  // Assurance
  [['assurance', 'intact', 'la capitale', 'desjardins assurances'], 'shield'],
  // Animaux
  [['vétérinaire', 'veto', 'animalerie', 'petsmart', 'global pet', 'mondou'], 'paw'],
  // Vêtements & shopping
  [['zara', 'h&m', 'simons', 'aritzia', 'winners', 'reitmans', 'ardène', 'aldo', 'le château', 'eva b', 'friperie', 'renaissance', 'seconde main'], 'gift'],
]

function autoAssignCategory(
  description: string,
  categories: { id: string; icon: string }[],
): string | null {
  const desc = description.toLowerCase()
  for (const [keywords, icon] of CAT_RULES) {
    if (keywords.some(k => desc.includes(k))) {
      return categories.find(c => c.icon === icon)?.id ?? null
    }
  }
  return null
}

const FR_MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${FR_MONTHS_LONG[parseInt(m) - 1]}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
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
  const [inputMode, setInputMode] = useState<null | 'text' | 'file'>(null)
  const [inputFile, setInputFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const defaultPayer: Person = (profile?.person as Person) ?? 'bea'

  useEffect(() => {
    if (!open) {
      setStep('pick')
      setRows([])
      setParseError(null)
      setParsing(false)
      setDragOver(false)
      setTextInput('')
      setInputMode(null)
      setInputFile(null)
    }
  }, [open])

  // Generate/revoke object URL for image preview
  useEffect(() => {
    if (!inputFile?.type.startsWith('image/')) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(inputFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [inputFile])

  // Global paste handler when the zone is in empty state
  useEffect(() => {
    if (!open || step !== 'pick' || inputMode !== null) return
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile()
            if (file) { setInputFile(file); setInputMode('file') }
            return
          }
        }
      }
      const text = e.clipboardData?.getData('text')
      if (text?.trim()) { setTextInput(text); setInputMode('text') }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open, step, inputMode])

  async function fetchExisting(): Promise<ExistingExpense[]> {
    if (!household) return []
    const { data } = await supabase
      .from('expenses')
      .select('date, amount, description')
      .eq('household_id', household.id)
    return (data ?? []) as ExistingExpense[]
  }

  async function handleText() {
    if (!textInput.trim()) return
    setParsing(true)
    setParseError(null)
    try {
      const existing = await fetchExisting()
      const parsed = parseDesjardinsText(textInput, existing, defaultPayer, categories)
      if (parsed.length === 0) {
        setParseError("Aucune transaction détectée. Vérifie que le texte est bien copié depuis ton relevé en ligne.")
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

  async function handleFile(file: File) {
    if (file.type.startsWith('image/')) {
      setParsing(true)
      setParseError(null)
      try {
        const existing = await fetchExisting()
        const parsed = (await parseImageViaEdge(file, existing, defaultPayer))
          .map(r => ({ ...r, categoryId: autoAssignCategory(r.description, categories) }))
        if (parsed.length === 0) {
          setParseError("Aucune transaction détectée dans la capture.")
          return
        }
        setRows(parsed)
        setStep('review')
      } catch (e) {
        setParseError(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setParsing(false)
      }
      return
    }

    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      setParseError('Sélectionne une image ou un fichier PDF.')
      return
    }

    setParsing(true)
    setParseError(null)
    try {
      const { lines, fullText } = await extractPdfLines(file)
      const existing = await fetchExisting()
      const parsed = parsePdfTransactions(lines, fullText, existing, defaultPayer)
        .map(r => ({ ...r, categoryId: autoAssignCategory(r.description, categories) }))
      if (parsed.length === 0) {
        setParseError("Aucune transaction détectée. Ce format n'est peut-être pas pris en charge.")
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

  async function handleAnalyze() {
    if (inputMode === 'text') await handleText()
    else if (inputMode === 'file' && inputFile) await handleFile(inputFile)
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

  const stepBars = [
    { label: 'Source', active: true },
    { label: 'Transactions', active: step === 'review' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div
        className="relative w-full sm:max-w-[480px] flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--appbg)', maxHeight: 'calc(100svh - 28px)' }}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '16px 18px 10px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>Importer un relevé</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--muted)', color: 'var(--muted-fg)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Step bars */}
        <div className="flex gap-2 flex-shrink-0" style={{ padding: '0 18px 12px' }}>
          {stepBars.map(s => (
            <div key={s.label} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 999, background: s.active ? 'var(--primary)' : 'var(--muted)', transition: 'background 0.2s' }} />
              <div style={{ fontSize: 11.5, fontWeight: 600, color: s.active ? 'var(--fg)' : 'var(--muted-fg)', marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 18px 14px' }}>
          {step === 'pick' ? (
            <>
              {/* Unified input zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f) { setInputFile(f); setInputMode('file'); setParseError(null) }
                }}
                style={{
                  border: inputMode
                    ? '1.5px solid var(--primary)'
                    : `1.5px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 16,
                  background: dragOver && !inputMode ? 'var(--primary-soft)' : 'var(--card)',
                  transition: 'border-color 0.15s, background 0.15s',
                  overflow: 'hidden',
                }}
              >
                {/* ── État vide ── */}
                {!inputMode && (
                  <div style={{ padding: '32px 20px 24px', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--primary)' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="3"/>
                        <path d="M3 15l5-5 4 4 3-3 6 6"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M19 2v6M22 5h-6"/>
                      </svg>
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>
                      Colle le texte de ton relevé
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', lineHeight: 1.5 }}>
                      ou glisse-dépose une capture d'écran
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--muted-fg)', background: 'var(--muted)', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                      </svg>
                      Choisir un fichier
                    </button>
                  </div>
                )}

                {/* ── État texte ── */}
                {inputMode === 'text' && (
                  <>
                    <textarea
                      value={textInput}
                      onChange={e => setTextInput(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        minHeight: 190,
                        padding: '12px 13px',
                        background: 'transparent',
                        border: 'none',
                        fontSize: 12.5,
                        color: 'var(--fg)',
                        resize: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.55,
                        outline: 'none',
                        boxSizing: 'border-box',
                        display: 'block',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 13px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>
                        Texte détecté · {textInput.split('\n').filter(l => l.trim()).length} lignes
                      </span>
                      <button
                        onClick={() => { setTextInput(''); setInputMode(null); setParseError(null) }}
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Effacer
                      </button>
                    </div>
                  </>
                )}

                {/* ── État image/fichier ── */}
                {inputMode === 'file' && inputFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--primary)', overflow: 'hidden' }}>
                      {previewUrl ? (
                        <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inputFile.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted-fg)', marginTop: 2 }}>
                        {formatFileSize(inputFile.size)}
                      </div>
                    </div>
                    <button
                      onClick={() => { setInputFile(null); setInputMode(null); setParseError(null) }}
                      style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                    >
                      Retirer
                    </button>
                  </div>
                )}
              </div>

              {/* Action button */}
              <button
                onClick={handleAnalyze}
                disabled={!inputMode || parsing}
                style={{
                  marginTop: 10,
                  width: '100%',
                  background: !inputMode || parsing ? 'var(--muted)' : 'var(--primary)',
                  color: !inputMode || parsing ? 'var(--muted-fg)' : 'var(--primary-fg)',
                  borderRadius: 11,
                  padding: '12px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !inputMode || parsing ? 'not-allowed' : 'pointer',
                  border: 'none',
                  transition: 'background 0.15s',
                }}
              >
                {parsing ? 'Analyse en cours…' : 'Analyser'}
              </button>

              {parseError && (
                <p style={{ marginTop: 10, fontSize: 13, fontWeight: 500, color: 'var(--danger)' }}>{parseError}</p>
              )}

              {/* Info */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 13, padding: '12px 13px', background: 'var(--muted)', borderRadius: 12 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--muted-fg)', marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                <div style={{ fontSize: 12, color: 'var(--muted-fg)', lineHeight: 1.5 }}>
                  Colle le texte de ton relevé, ou dépose une capture d'écran. Les doublons et paiements sont filtrés automatiquement.
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setInputFile(f); setInputMode('file'); setParseError(null) }
                  e.target.value = ''
                }}
              />
            </>
          ) : (
            <>
              {/* Count + select-all + retry */}
              {(() => {
                const allSelected = rows.length > 0 && rows.every(r => r.selected)
                const someSelected = !allSelected && rows.some(r => r.selected)
                const indeterminate = someSelected
                const active = allSelected || indeterminate
                function toggleAll() {
                  setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })))
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                    <button
                      onClick={toggleAll}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`, background: active ? 'var(--primary)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s', padding: 0 }}
                      aria-label="Tout sélectionner"
                    >
                      {allSelected && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary-fg)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                      {indeterminate && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--primary-fg)" strokeWidth="3.5" strokeLinecap="round">
                          <path d="M5 12h14"/>
                        </svg>
                      )}
                    </button>
                    <div style={{ fontSize: 12.5, color: 'var(--muted-fg)', flex: 1 }}>
                      {rows.length} transaction{rows.length !== 1 ? 's' : ''} trouvée{rows.length !== 1 ? 's' : ''}
                    </div>
                    <button
                      onClick={() => { setStep('pick'); setRows([]) }}
                      style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                    >
                      Recommencer
                    </button>
                  </div>
                )
              })()}

              {/* Row list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {rows.map(row => (
                  <ReviewRow
                    key={row.key}
                    row={row}
                    categories={categories}
                    onChange={patch => setRows(prev => prev.map(r => r.key === row.key ? { ...r, ...patch } : r))}
                  />
                ))}
              </div>

              {/* Footer note */}
              <div style={{ marginTop: 11, padding: '10px 12px', background: 'var(--muted)', borderRadius: 11, fontSize: 11.5, color: 'var(--muted-fg)', lineHeight: 1.45 }}>
                Payé par toi, partagé 50/50 par défaut. Tu ajusteras les exceptions dans le Relevé.
              </div>
            </>
          )}
        </div>

        {/* Sticky footer — review step only */}
        {step === 'review' && (
          <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', padding: '12px 18px 16px' }}>
            <button
              onClick={handleSave}
              disabled={saving || selectedRows.length === 0}
              style={{
                width: '100%',
                background: selectedRows.length === 0 ? 'var(--muted)' : 'var(--primary)',
                color: selectedRows.length === 0 ? 'var(--muted-fg)' : 'var(--primary-fg)',
                borderRadius: 12,
                padding: 14,
                textAlign: 'center',
                fontSize: 15,
                fontWeight: 600,
                cursor: selectedRows.length === 0 ? 'not-allowed' : 'pointer',
                border: 'none',
              }}
            >
              {saving ? '…' : `Importer ${selectedRows.length} transaction${selectedRows.length !== 1 ? 's' : ''} · ${formatCAD(total)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ReviewRow ──────────────────────────────────────────────────────────────

function ReviewRow({
  row,
  categories,
  onChange,
}: {
  row: ParsedRow
  categories: { id: string; name: string; icon: string }[]
  onChange: (patch: Partial<ParsedRow>) => void
}) {
  return (
    <div
      onClick={() => onChange({ selected: !row.selected })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        cursor: 'pointer',
        opacity: row.selected ? 1 : 0.5,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        border: `1.5px solid ${row.selected ? 'var(--primary)' : 'var(--border)'}`,
        background: row.selected ? 'var(--primary)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}>
        {row.selected && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary-fg)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.description}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted-fg)', marginTop: 1 }}>
          {fmtDateShort(row.date)}
          {row.categoryId ? ` · ${categories.find(c => c.id === row.categoryId)?.name ?? ''}` : ''}
          {row.isDuplicate ? ' · doublon probable' : ''}
        </div>
      </div>

      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 600, color: 'var(--fg)', flexShrink: 0 }}>
        {formatCAD(row.amount)}
      </div>
    </div>
  )
}
