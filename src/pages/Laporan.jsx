import { useEffect, useMemo, useState } from 'react'
import { getLast7DaysRevenue, getTodayPaymentBreakdown } from '../api'
import { formatRupiah } from '../lib/format'

const PAYMENT_LABELS = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }
const PAYMENT_COLORS = { cash: '#2c6a9e', qris: '#7bb2d9', transfer: '#dce9f3' }

function dayLabel(date) {
  const label = date.toLocaleDateString('id-ID', { weekday: 'short' })
  return label.charAt(0).toUpperCase() + label.slice(1, 3)
}

export default function Laporan() {
  const [last7, setLast7] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getLast7DaysRevenue(), getTodayPaymentBreakdown()])
      .then(([last7Data, paymentsData]) => {
        setLast7(last7Data)
        setPayments(paymentsData)
      })
      .catch(() => setError('Gagal memuat laporan'))
      .finally(() => setLoading(false))
  }, [])

  // Revenue/count/avg all come from payments actually collected today, not
  // from treatment totals — a queued-but-unpaid job isn't revenue yet.
  const stats = useMemo(() => {
    const revenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const count = payments.length
    return { revenue, count, avg: count ? revenue / count : 0 }
  }, [payments])

  const revBars = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push({ date: d, key: d.toDateString(), label: dayLabel(d), revenue: 0 })
    }
    const byDay = new Map(days.map((d) => [d.key, d]))
    for (const p of last7) {
      const key = new Date(p.paid_at).toDateString()
      const bucket = byDay.get(key)
      if (bucket) bucket.revenue += Number(p.amount || 0)
    }
    const max = Math.max(1, ...days.map((d) => d.revenue))
    const todayKey = new Date().toDateString()
    return days.map((d) => ({
      ...d,
      heightPct: Math.round((d.revenue / max) * 100),
      isToday: d.key === todayKey,
    }))
  }, [last7])

  const paymentBreakdown = useMemo(() => {
    const totals = { cash: 0, qris: 0, transfer: 0 }
    for (const p of payments) {
      if (totals[p.payment_method] !== undefined) totals[p.payment_method] += Number(p.amount || 0)
    }
    const grandTotal = totals.cash + totals.qris + totals.transfer
    return Object.entries(totals).map(([method, amount]) => ({
      method,
      label: PAYMENT_LABELS[method],
      color: PAYMENT_COLORS[method],
      amount,
      pct: grandTotal ? Math.round((amount / grandTotal) * 100) : 0,
    }))
  }, [payments])

  if (loading) return <div className="loading-screen">Memuat...</div>

  return (
    <div className="laporan-screen">
      <h1>Laporan Harian</h1>
      {error && <p className="form-error">{error}</p>}

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-card-label">Pendapatan Hari Ini</span>
          <span className="stat-card-value stat-card-value-accent">{formatRupiah(stats.revenue)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Transaksi</span>
          <span className="stat-card-value">{stats.count}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Rata-rata Transaksi</span>
          <span className="stat-card-value">{formatRupiah(stats.avg)}</span>
        </div>
      </div>

      <div className="laporan-panels">
        <div className="laporan-panel laporan-chart">
          <div className="laporan-panel-title">Pendapatan — 7 Hari Terakhir</div>
          <div className="rev-bars">
            {revBars.map((d) => (
              <div key={d.key} className="rev-bar-col">
                <div
                  className={`rev-bar ${d.isToday ? 'rev-bar-today' : ''}`}
                  style={{ height: `${Math.max(d.heightPct, 3)}%` }}
                  title={formatRupiah(d.revenue)}
                />
                <span className="rev-bar-label">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="laporan-panel laporan-payments">
          <div className="laporan-panel-title">Metode Pembayaran</div>
          <div className="payment-breakdown-bar">
            {paymentBreakdown.map((p) => (
              <div key={p.method} style={{ width: `${p.pct}%`, background: p.color }} />
            ))}
          </div>
          <div className="payment-breakdown-legend">
            {paymentBreakdown.map((p) => (
              <div key={p.method} className="payment-breakdown-row">
                <span>{p.label}</span>
                <span>{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
