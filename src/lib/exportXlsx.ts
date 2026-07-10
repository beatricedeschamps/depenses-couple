import * as XLSX from 'xlsx'
import type { LedgerEntry } from './balance'
import type { CategoryRow } from './database.types'

const TYPE_LABELS: Record<string, string> = {
  ponct: 'Ponctuelle',
  recur_continue: 'Continue',
  recur_serie: 'Série',
  remb: 'Remboursement',
}

function typeLabel(e: LedgerEntry) {
  if (e.kind === 'remb') return TYPE_LABELS.remb
  if (e.kind === 'ponct') return TYPE_LABELS.ponct
  return e.recurring?.type === 'serie' ? TYPE_LABELS.recur_serie : TYPE_LABELS.recur_continue
}

function splitLabel(s?: string) {
  if (s === 'half') return '50/50'
  if (s === 'phil') return '100 % Phil'
  if (s === 'bea') return '100 % Béa'
  return ''
}

function payerLabel(p?: string) {
  if (p === 'bea') return 'Béa'
  if (p === 'phil') return 'Phil'
  return ''
}

export function exportToXlsx(entries: LedgerEntry[], catMap: Record<string, CategoryRow>, filename = 'relevé.xlsx') {
  const rows = [
    ['Date', 'Type', 'Description', 'Catégorie', 'Payé par', 'Partage', 'Montant ($)'],
    ...entries.map(e => {
      const cat = e.categoryId ? catMap[e.categoryId] : null
      if (e.kind === 'remb') {
        return [
          e.date,
          'Remboursement',
          `Remboursement ${e.fromPerson === 'bea' ? 'Béa → Phil' : 'Phil → Béa'}`,
          '',
          payerLabel(e.fromPerson),
          '',
          e.amount,
        ]
      }
      return [
        e.date,
        typeLabel(e),
        e.description,
        cat?.name ?? '',
        payerLabel(e.payer),
        splitLabel(e.split),
        e.amount,
      ]
    }),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 36 }, { wch: 20 },
    { wch: 10 }, { wch: 14 }, { wch: 12 },
  ]

  // Format amount column as number
  for (let r = 1; r < rows.length; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 6 })]
    if (cell) cell.t = 'n'
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relevé')
  XLSX.writeFile(wb, filename)
}
