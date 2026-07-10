import type { ExpenseRow, RecurringRow, SettlementRow, Person, Split, PriceRate } from './database.types'

export interface LedgerEntry {
  id: string
  kind: 'ponct' | 'recur' | 'remb'
  date: string
  description: string
  amount: number
  payer?: Person
  split?: Split
  categoryId?: string | null
  // ponct only
  expenseId?: string
  expense?: ExpenseRow
  // recur only
  recurringId?: string
  recurring?: RecurringRow
  // remb only
  fromPerson?: Person
  settlementId?: string
  settlement?: SettlementRow
}

// Net impact on the balance for one movement.
// Positive = béa owes phil. Negative = phil owes béa.
export function oneNet(amount: number, payer: Person, split: Split): number {
  const cents = Math.round(amount * 100)
  let beaShare: number, philShare: number
  if (split === 'half') {
    // Other person owes the floor half; payer absorbs the odd cent
    const half = Math.floor(cents / 2)
    beaShare = half / 100
    philShare = half / 100
  } else if (split === 'phil') {
    philShare = amount
    beaShare = 0
  } else {
    beaShare = amount
    philShare = 0
  }
  return payer === 'phil' ? beaShare : -philShare
}

// Price in effect at a given date from a rates history
export function priceAt(rates: PriceRate[], date: string): number {
  const applicable = rates.filter(r => r.from <= date)
  if (applicable.length === 0) return rates[0]?.amount ?? 0
  return applicable[applicable.length - 1].amount
}

// Dates on which a recurring generates an occurrence in a given year
export function occurrenceDates(r: RecurringRow, year: number): string[] {
  const dates: string[] = []
  const ys = String(year)

  if (r.type === 'continue') {
    const sd = r.start_date ?? `${ys}-01-01`
    const yearEnd = `${ys}-12-31`

    if (r.frequency === 'mois') {
      const day = parseInt(sd.slice(8, 10), 10) || 1
      for (let m = 1; m <= 12; m++) {
        const dim = new Date(year, m, 0).getDate()
        const dd = Math.min(day, dim)
        const iso = `${ys}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
        if (iso >= sd && iso <= yearEnd) dates.push(iso)
      }
    } else {
      const step = r.frequency === 'semaine' ? 7 : 14
      let dt = new Date(sd + 'T00:00:00')
      const y0 = new Date(`${ys}-01-01T00:00:00`)
      const end = new Date(`${ys}-12-31T00:00:00`)
      while (dt < y0) dt.setDate(dt.getDate() + step)
      while (dt <= end) {
        dates.push(dt.toISOString().slice(0, 10))
        dt = new Date(dt)
        dt.setDate(dt.getDate() + step)
      }
    }
  } else if (r.type === 'serie' && r.year === year) {
    const n = r.occurrences ?? 1
    const step = 12 / n
    for (let k = 0; k < n; k++) {
      const m = Math.min(12, Math.max(1, Math.round(k * step) + 1))
      dates.push(`${ys}-${String(m).padStart(2, '0')}-15`)
    }
  }
  return dates
}

// Flat sorted ledger from all data sources
export function buildLedger(
  expenses: ExpenseRow[],
  recurrings: RecurringRow[],
  settlements: SettlementRow[],
): LedgerEntry[] {
  const today = new Date().toISOString().slice(0, 10)
  const currentYear = new Date().getFullYear()
  const mv: LedgerEntry[] = []

  for (const e of expenses) {
    mv.push({
      id: 'p-' + e.id,
      kind: 'ponct',
      date: e.date,
      description: e.description,
      amount: e.amount,
      payer: e.payer,
      split: e.split,
      categoryId: e.category_id,
      expenseId: e.id,
      expense: e,
    })
  }

  // Generate occurrences for ±1 year window (past + current year)
  const years = Array.from(new Set([currentYear - 1, currentYear]))
  for (const r of recurrings) {
    if (r.archived) continue
    for (const year of years) {
      const dates = occurrenceDates(r, year).filter(d => d <= today)
      for (const dt of dates) {
        mv.push({
          id: `r-${r.id}-${dt}`,
          kind: 'recur',
          date: dt,
          description: r.description,
          amount: priceAt(r.rates, dt),
          payer: r.payer,
          split: r.split,
          categoryId: r.category_id,
          recurringId: r.id,
          recurring: r,
        })
      }
    }
  }

  for (const s of settlements) {
    mv.push({
      id: 's-' + s.id,
      kind: 'remb',
      date: s.date,
      description: 'Remboursement',
      amount: s.amount,
      fromPerson: s.from_person,
      payer: s.from_person,
      settlementId: s.id,
      settlement: s,
    })
  }

  return mv.sort((a, b) => b.date.localeCompare(a.date))
}

// Net balance for the current year.
// Positive = béa owes phil. Negative = phil owes béa.
export function computeBalance(ledger: LedgerEntry[]): number {
  const ys = String(new Date().getFullYear())
  let net = 0
  for (const m of ledger) {
    if (m.date.slice(0, 4) !== ys) continue
    if (m.kind === 'remb') {
      net += m.fromPerson === 'phil' ? m.amount : -m.amount
    } else {
      net += oneNet(m.amount, m.payer!, m.split!)
    }
  }
  return net
}
