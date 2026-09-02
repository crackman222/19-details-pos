import { useEffect, useMemo, useState } from 'react'
import { getLast7DaysRevenue, getTodayPaymentBreakdown, getWorkerOrderCounts } from '../api'
import { formatRupiah, initials } from '../lib/format'
import { getPeriodRange, formatPeriodLabel } from '../lib/dateRange'
import { useAuth } from '../context/useAuth'
import { isAdmin as checkIsAdmin } from '../lib/roles'

const PAYMENT_LABELS = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }
const PAYMENT_COLORS = { cash: '#2c6a9e', qris: '#7bb2d9', transfer: '#dce9f3' }

const WORKER_PERIOD_OPTIONS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
]

function dayLabel(date) {
  const label = date.toLocaleDateString('id-ID', { weekday: 'short' })
  return label.charAt(0).toUpperCase() + label.slice(1, 3)
}

export default function Laporan() {
  const { profile } = useAuth()
  const isAdmin = checkIsAdmin(profile)
  const [last7, setLast7] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workerPeriod, setWorkerPeriod] = useState('daily')
  const [workerCounts, setWorkerCounts] = useState([])
  const [workerLoading, setWorkerLoading] = useState(true)
  // Non-admin staff only ever see today's leaderboard — the period picker
  // is admin-only, so their stored workerPeriod (always 'daily', since they
  // have no control to change it) is redundant here, but this keeps the
  // fetch pinned to daily even if that ever changes.
  const effectiveWorkerPeriod = isAdmin ? workerPeriod : 'daily'

  useEffect(() => {
    // Staff only get today's numbers — the 7-day trend is history, admin-only.
    Promise.all([isAdmin ? getLast7DaysRevenue() : Promise.resolve([]), getTodayPaymentBreakdown()])
      .then(([last7Data, paymentsData]) => {
        setLast7(last7Data)
        setPayments(paymentsData)
      })
      .catch(() => setError('Gagal memuat laporan'))
      .finally(() => setLoading(false))
  }, [isAdmin])

  // Doesn't flip workerLoading back to true on a period switch — only the
  // very first load shows "Memuat...", later switches just swap the table
  // in place once the new counts arrive instead of flashing a spinner.
  function loadWorkerCounts(period) {
    const { start, end } = getPeriodRange(period)
    getWorkerOrderCounts(start, end)
      .then(setWorkerCounts)
      .catch(() => setError('Gagal memuat peringkat pekerja'))
      .finally(() => setWorkerLoading(false))
  }

  useEffect(() => {
    loadWorkerCounts(effectiveWorkerPeriod)
  }, [effectiveWorkerPeriod])

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
        {isAdmin && (
          <div className="laporan-panel laporan-chart">
            <div className="laporan-panel-title">Pendapatan — 7 Hari Terakhir</div>
            <div className="rev-bars">
              {revBars.map((d) => (
                <div key={d.key} className="rev-bar-col">
                  <span className="rev-bar-amount">{formatRupiah(d.revenue)}</span>
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
        )}

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
                <span>{formatRupiah(p.amount)} ({p.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="laporan-panel laporan-workers">
        <div className="laporan-panel-header">
          <div>
            <div className="laporan-panel-title">Peringkat Pekerja</div>
            <p className="laporan-panel-subtitle">{formatPeriodLabel(effectiveWorkerPeriod)}</p>
          </div>
          {isAdmin && (
            <select value={workerPeriod} onChange={(e) => setWorkerPeriod(e.target.value)}>
              {WORKER_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {workerLoading && <p className="riwayat-loading">Memuat...</p>}
        {!workerLoading && workerCounts.length === 0 && (
          <p className="riwayat-empty">Belum ada transaksi dengan petugas tercatat pada periode ini</p>
        )}
        {!workerLoading && workerCounts.length > 0 && (
          <div className="worker-leaderboard">
            {workerCounts.map((w, i) => {
              const rank = i + 1
              const tier = rank <= 3 ? rank : 'other'
              const isYou = w.name === profile?.full_name
              return (
                <div
                  key={w.name}
                  className={`worker-leaderboard-row tier-${tier} ${isYou ? 'is-you' : ''}`}
                >
                  <span className={`worker-rank-badge tier-${tier}`}>{rank}</span>
                  <span className="worker-avatar">{initials(w.name)}</span>
                  <div className="worker-leaderboard-info">
                    <span className="worker-leaderboard-name">
                      {w.name}
                      {isYou && <span className="worker-you-tag">Anda</span>}
                    </span>
                    <span className="worker-leaderboard-sub">
                      {w.washCount} Cuci · {w.qcCount} QC
                    </span>
                  </div>
                  <span className="worker-leaderboard-total">{w.total}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
