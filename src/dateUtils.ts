/** Format ISO date string (YYYY-MM-DD) for display as dd/MM/yyyy. */
export function formatDateDisplay(isoDate?: string): string {
  if (!isoDate?.trim()) return ''
  const s = isoDate.trim()
  const parts = s.split('-')
  if (parts.length !== 3) return isoDate
  const y = Number(parts[0])
  const m = Number(parts[1]) - 1
  const d = Number(parts[2])
  const date = new Date(y, m, d)
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return isoDate
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/** Parse dd/MM/yyyy or dd-MM-yyyy to ISO (YYYY-MM-DD). Returns empty string if invalid. */
export function parseDateInput(input?: string): string {
  if (!input?.trim()) return ''
  const s = input.trim()
  const parts = s.split(/[/-]/)
  if (parts.length !== 3) return ''
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  let year = parseInt(parts[2], 10)
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return ''
  if (year >= 0 && year < 100) year += year >= 50 ? 1900 : 2000
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return ''
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Get month (0–11) and day from ISO date YYYY-MM-DD. Returns null if invalid. */
function getMonthDay(isoDate: string): { month: number; day: number } | null {
  if (!isoDate?.trim()) return null
  const parts = isoDate.trim().split('-')
  if (parts.length !== 3) return null
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (Number.isNaN(month) || Number.isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) return null
  const d = new Date(2000, month, day)
  if (d.getMonth() !== month || d.getDate() !== day) return null
  return { month, day }
}

/** Next occurrence of (month, day) on or after ref. Returns that date and days until (0 = today). */
export function getNextOccurrence(
  isoDate: string,
  ref: Date = new Date()
): { date: Date; daysUntil: number } | null {
  const md = getMonthDay(isoDate)
  if (!md) return null
  const refYear = ref.getFullYear()
  let next = new Date(refYear, md.month, md.day)
  next.setHours(0, 0, 0, 0)
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  refDay.setHours(0, 0, 0, 0)
  if (next.getTime() < refDay.getTime()) next = new Date(refYear + 1, md.month, md.day)
  next.setHours(0, 0, 0, 0)
  const daysUntil = Math.round((next.getTime() - refDay.getTime()) / (24 * 60 * 60 * 1000))
  return { date: next, daysUntil }
}

/** Format month-day for display (e.g. "15/03" for display in lists). */
export function formatMonthDay(isoDate: string): string {
  const md = getMonthDay(isoDate)
  if (!md) return ''
  const d = String(md.day).padStart(2, '0')
  const m = String(md.month + 1).padStart(2, '0')
  return `${d}/${m}`
}

/** Current age from birth date; if death date given, age at death. Returns null if no birth date or invalid. */
export function getCurrentAge(birthDate?: string, deathDate?: string): number | null {
  if (!birthDate?.trim()) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const end = deathDate?.trim() ? new Date(deathDate) : new Date()
  if (Number.isNaN(end.getTime())) return null
  let age = end.getFullYear() - birth.getFullYear()
  const monthDiff = end.getMonth() - birth.getMonth()
  const dayDiff = end.getDate() - birth.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1
  return age < 0 ? null : age
}
