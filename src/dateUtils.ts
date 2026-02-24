/** True if string looks like lunar calendar (e.g. "04-02 AL", "20-10 AL"). */
function isLunarDate(s: string): boolean {
  return /\s*AL$/i.test(s.trim()) || /âm\s*lịch/i.test(s)
}

/**
 * Format date for display. Supports:
 * - Empty → ''
 * - Full ISO YYYY-MM-DD → dd/MM/yyyy
 * - Year only (4 digits) → "YYYY"
 * - Unknown year (0000-MM-DD) → "dd/MM"
 * - Lunar (e.g. "04-02 AL") → shown as-is
 * - Other text → shown as-is
 */
export function formatDateDisplay(isoDate?: string): string {
  if (!isoDate?.trim()) return ''
  const s = isoDate.trim()
  if (isLunarDate(s)) return s
  const parts = s.split('-')
  if (parts.length === 1) {
    const y = parseInt(parts[0], 10)
    if (!Number.isNaN(y) && parts[0].length >= 1 && parts[0].length <= 4) return parts[0]
    return s
  }
  if (parts.length === 3) {
    const y = Number(parts[0])
    const m = Number(parts[1]) - 1
    const d = Number(parts[2])
    if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return s
    if (y === 0) {
      if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        const date = new Date(2000, m, d)
        if (date.getMonth() === m && date.getDate() === d)
          return `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`
      }
      return s
    }
    const date = new Date(y, m, d)
    if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return s
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${day}/${month}/${date.getFullYear()}`
  }
  return s
}

/**
 * Parse date input. Supports:
 * - Empty → ''
 * - Year only (1–4 digits) → stored as "YYYY"
 * - Month-day only (dd/MM or dd-MM) → stored as "0000-MM-DD" (unknown year)
 * - Full dd/MM/yyyy or dd-MM-yyyy → YYYY-MM-DD
 * - Lunar (e.g. "04-02 AL") → stored as-is
 * - Other text → stored as-is
 */
export function parseDateInput(input?: string): string {
  if (!input?.trim()) return ''
  const s = input.trim()
  if (isLunarDate(s)) return s
  const parts = s.split(/[/-]/)
  if (parts.length === 1) {
    const y = parseInt(parts[0], 10)
    if (!Number.isNaN(y) && y >= 0 && y <= 9999) return String(y)
    return s
  }
  if (parts.length === 2) {
    if (!/^\d+$/.test(parts[0].trim()) || !/^\d+$/.test(parts[1].trim())) return s
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    if (Number.isNaN(day) || Number.isNaN(month) || month < 1 || month > 12) return s
    const d = new Date(2000, month - 1, day)
    if (d.getMonth() !== month - 1 || d.getDate() !== day) return s
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `0000-${mm}-${dd}`
  }
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    let year = parseInt(parts[2], 10)
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return s
    if (year >= 0 && year < 100) year += year >= 50 ? 1900 : 2000
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return s
    const yy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
  }
  return s
}

/** Get month (0–11) and day from YYYY-MM-DD or 0000-MM-DD. Returns null if invalid. */
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

/** Parse a stored date to Date (for age calc). Year-only → Jan 1; 0000-MM-DD → null; full → normal. */
function parseDateForAge(dateStr: string): Date | null {
  const s = dateStr.trim()
  if (!s) return null
  if (/^\d{1,4}$/.test(s)) {
    const y = parseInt(s, 10)
    if (y >= 1 && y <= 9999) return new Date(y, 0, 1)
    return null
  }
  if (s.startsWith('0000-')) return null
  const parts = s.split('-')
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    const date = new Date(y, m, d)
    if (Number.isNaN(date.getTime())) return null
    if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null
    return date
  }
  return null
}

/** Current age from birth date; if death date given, age at death. Returns null if no birth date or partial (e.g. unknown year). */
export function getCurrentAge(birthDate?: string, deathDate?: string): number | null {
  const birth = birthDate ? parseDateForAge(birthDate) : null
  if (!birth) return null
  const end = deathDate?.trim() ? parseDateForAge(deathDate) : new Date()
  if (!end) return null
  if (end.getTime() < birth.getTime()) return null
  let age = end.getFullYear() - birth.getFullYear()
  const monthDiff = end.getMonth() - birth.getMonth()
  const dayDiff = end.getDate() - birth.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1
  return age < 0 ? null : age
}
