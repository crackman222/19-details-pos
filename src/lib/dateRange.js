// Calendar-aligned periods for reporting — weekly is Mon-Sun, not a trailing
// 7 days, so figures match how a bookkeeping report is normally read.
export function getPeriodRange(period) {
  const now = new Date()

  if (period === 'daily') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  if (period === 'weekly') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const mondayOffset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - mondayOffset)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }

  if (period === 'monthly') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    }
  }

  if (period === 'yearly') {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    }
  }

  throw new Error(`Unknown period: ${period}`)
}

// A single calendar day as a [start, end) range, from a "YYYY-MM-DD" value
// like a <input type="date"> gives you — used by the wage management page's
// day picker. Parsed as local time (not UTC) so the boundary lands on
// midnight where the shop actually is.
export function getDayRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

// Today as a "YYYY-MM-DD" string, for defaulting a date input — toISOString
// is UTC, which drifts a day off around midnight in Indonesia (UTC+7/+8/+9).
export function todayDateInput() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatPeriodLabel(period) {
  const { start, end } = getPeriodRange(period)

  if (period === 'daily') {
    return `Harian - ${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }

  if (period === 'weekly') {
    const lastDay = new Date(end.getTime() - 1)
    const fmt = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    return `Mingguan - ${fmt(start)} s/d ${fmt(lastDay)}`
  }

  if (period === 'monthly') {
    return `Bulanan - ${start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
  }

  return `Tahunan - ${start.getFullYear()}`
}
