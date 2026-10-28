import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]
/** Persian week starts on Saturday. */
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

export interface JDate { jy: number; jm: number; jd: number }

export const toJ = (d: Date): JDate => {
  const { jy, jm, jd } = toJalaali(d)
  return { jy, jm, jd }
}

export function fromJ(jy: number, jm: number, jd: number, h = 0, mi = 0): Date {
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return new Date(gy, gm - 1, gd, h, mi, 0, 0)
}

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function shiftMonth(jy: number, jm: number, delta: number) {
  const total = jy * 12 + (jm - 1) + delta
  return { jy: Math.floor(total / 12), jm: (total % 12) + 1 }
}

/** Grid cells for a Jalali month. `null` entries are leading blanks. */
export function monthGrid(jy: number, jm: number): (number | null)[] {
  const first = fromJ(jy, jm, 1)
  const lead = (first.getDay() + 1) % 7 // Saturday = 0
  const len = jalaaliMonthLength(jy, jm)
  return [...Array<null>(lead).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)]
}

/** Start of a Jalali month (as Date) – handy for grouping reports. */
export const monthKey = (d: Date) => {
  const { jy, jm } = toJ(d)
  return jy * 12 + (jm - 1)
}
export const monthLabelFromKey = (key: number) => JALALI_MONTHS[key % 12]
