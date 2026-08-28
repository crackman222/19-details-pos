import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchTreatmentsByPlate, getTreatmentsInRange } from '../api'
import { formatRupiah, formatDateTime } from '../lib/format'
import { getPeriodRange, formatPeriodLabel } from '../lib/dateRange'
import { useAuth } from '../context/useAuth'
import { isAdmin as checkIsAdmin } from '../lib/roles'

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
]

const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  diproses: 'Diproses',
  qc: 'QC',
  selesai: 'Selesai',
  closed: 'Ditutup',
  voided: 'Dibatalkan',
}

export default function RiwayatTransaksi() {
  const { profile } = useAuth()
  const isAdmin = checkIsAdmin(profile)
  const [treatments, setTreatments] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFiltered, setIsFiltered] = useState(false)
  const [period, setPeriod] = useState('daily')
  const [exporting, setExporting] = useState(false)
  // Same arrangement as Laporan's leaderboard: the period picker is admin-only,
  // so staff stay pinned to today's rows no matter what's in state.
  const effectivePeriod = isAdmin ? period : 'daily'

  useEffect(() => {
    loadPeriod(effectivePeriod)
  }, [effectivePeriod])

  function loadPeriod(p) {
    setLoading(true)
    setError('')
    setIsFiltered(false)
    const { start, end } = getPeriodRange(p)
    getTreatmentsInRange(start, end)
      .then(setTreatments)
      .catch(() => setError('Gagal memuat riwayat'))
      .finally(() => setLoading(false))
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) {
      loadPeriod(effectivePeriod)
      return
    }
    setLoading(true)
    setError('')
    try {
      const results = await searchTreatmentsByPlate(query, { todayOnly: !isAdmin })
      setTreatments(results)
      setIsFiltered(true)
    } catch {
      setError('Gagal mencari transaksi')
    } finally {
      setLoading(false)
    }
  }

  async function handleExportPdf() {
    setExporting(true)
    setError('')
    try {
      const { start, end } = getPeriodRange(period)
      const [results, { exportTreatmentsToPdf }] = await Promise.all([
        getTreatmentsInRange(start, end),
        import('../lib/pdf'),
      ])
      exportTreatmentsToPdf(results, formatPeriodLabel(period))
    } catch {
      setError('Gagal membuat PDF')
    } finally {
      setExporting(false)
    }
  }

  const stats = useMemo(() => {
    // Revenue reflects money actually collected — treatments can now sit in
    // the queue unpaid, so only paid ones count toward it.
    const paid = treatments.filter((t) => t.status !== 'voided' && t.isPaid)
    const revenue = paid.reduce((sum, t) => sum + Number(t.total || 0), 0)
    const avg = paid.length ? revenue / paid.length : 0
    return {
      count: treatments.length,
      revenue,
      avg,
    }
  }, [treatments])

  return (
    <div className="riwayat-screen">
      <div className="riwayat-header">
        <h1>Riwayat Transaksi</h1>
        <form onSubmit={handleSearch} className="riwayat-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor plat..."
          />
          <button type="submit">Cari</button>
        </form>
      </div>
      {!isAdmin && (
        <p className="riwayat-scope-note">Pencarian dan riwayat hanya menampilkan transaksi hari ini.</p>
      )}

      {isAdmin && (
        <div className="riwayat-export">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'Membuat PDF...' : 'Unduh PDF'}
          </button>
          <span className="riwayat-period-label">{formatPeriodLabel(period)}</span>
        </div>
      )}

      {!isFiltered && (
        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-card-label">{isAdmin ? 'Jumlah Transaksi' : 'Transaksi Hari Ini'}</span>
            <span className="stat-card-value">{stats.count}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">{isAdmin ? 'Pendapatan' : 'Pendapatan Hari Ini'}</span>
            <span className="stat-card-value stat-card-value-accent">{formatRupiah(stats.revenue)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Rata-rata Transaksi</span>
            <span className="stat-card-value">{formatRupiah(stats.avg)}</span>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="riwayat-loading">Memuat...</p>}

      {!loading && treatments.length > 0 && (
        <div className="riwayat-table">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Layanan</span>
            <span>Merek</span>
            <span>Waktu</span>
            <span>Status</span>
            <span>Bayar</span>
            <span>Total</span>
          </div>
          {treatments.map((t) => (
            <Link key={t.id} to={`/treatment/${t.id}`} className="riwayat-table-row">
              <span className="riwayat-service">{t.serviceSummary || '-'}</span>
              <span>{t.treatment_type || '-'}</span>
              <span>{formatDateTime(t.created_at)}</span>
              <span className={`status-badge status-${t.status}`}>
                {STATUS_LABELS[t.status] || t.status}
              </span>
              <span className={`status-badge ${t.isPaid ? 'status-closed' : 'status-created'}`}>
                {t.isPaid ? 'Lunas' : 'Belum'}
              </span>
              <span className="riwayat-total">{formatRupiah(t.total)}</span>
            </Link>
          ))}
        </div>
      )}
      {!loading && treatments.length === 0 && <p className="riwayat-empty">Tidak ada transaksi</p>}
    </div>
  )
}
