import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formate un montant en CAD : 1 234,56 $ (espace fine + virgule) */
export function formatCAD(amount: number): string {
  return (
    new Intl.NumberFormat('fr-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' $'
  )
}

/** Génère un code alphanumérique à 6 caractères (majuscules + chiffres, sans ambiguïtés) */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const array = new Uint8Array(6)
  crypto.getRandomValues(array)
  for (const byte of array) {
    code += chars[byte % chars.length]
  }
  return code
}

/** Arrondi 50/50 : cent supérieur pour le payeur */
export function splitHalf(amount: number): { payerPart: number; otherPart: number } {
  const cents = Math.round(amount * 100)
  const half = Math.floor(cents / 2)
  const otherPart = half / 100
  const payerPart = (cents - half) / 100
  return { payerPart, otherPart }
}
