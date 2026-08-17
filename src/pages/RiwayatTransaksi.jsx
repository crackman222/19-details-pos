import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodayTreatments, searchTreatmentsByPlate } from '../api'
import { formatRupiah, formatDateTime } from '../lib/format'

const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  completed: 'Selesai',
  closed: 'Ditutup',
  voided: 'Dibatalkan',
}

export default function RiwayatTransaksi() {
  const [treatments, setTreatments] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFiltered, setIsFiltered] = useState(false)

  useEffect(() => {
    loadToday()
  }, [])

  function loadToday() {
    setLoading(true)
    setError('')
    setIsFiltered(false)
    getTodayTreatments()
      .then(setTreatments)
      .catch(() => setError('Gagal memuat riwayat'))
      .finally(() => setLoading(false))
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) {
      loadToday()
      return
    }
    setLoading(true)
    setError('')
    try {
      const results = await searchTreatmentsByPlate(query)
      setTreatments(results)
      setIsFiltered(true)
    } catch {
      setError('Gagal mencari transaksi')
    } finally {
      setLoading(false)
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

      {!isFiltered && (
        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-card-label">Transaksi Hari Ini</span>
            <span className="stat-card-value">{stats.count}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Pendapatan Hari Ini</span>
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
            <span>Plat</span>
            <span>Kendaraan</span>
            <span>Waktu</span>
            <span>Status</span>
            <span>Bayar</span>
            <span>Total</span>
          </div>
          {treatments.map((t) => (
            <Link key={t.id} to={`/treatment/${t.id}`} className="riwayat-table-row">
              <span className="riwayat-plate">{t.plate_number}</span>
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
