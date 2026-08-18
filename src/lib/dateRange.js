// Calendar-aligned periods for reporting — weekly is Mon-Sun, not a trailing
// 7 days, so figures match how a bookkeeping report is normally read.
export function getPeriodRange(period) {
  const now = new Date()

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

export function formatPeriodLabel(period) {
  const { start, end } = getPeriodRange(period)

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
