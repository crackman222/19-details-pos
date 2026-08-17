import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveQueue } from '../api'
import { formatRupiah, formatDateTime } from '../lib/format'

const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  completed: 'Selesai',
}

export default function Antrian() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getActiveQueue()
      .then(setQueue)
      .catch(() => setError('Gagal memuat antrian'))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const unpaid = queue.filter((t) => !t.isPaid).length
    const revenue = queue.reduce((sum, t) => sum + Number(t.total || 0), 0)
    return { count: queue.length, unpaid, revenue }
  }, [queue])

  return (
    <div className="antrian-screen">
      <div className="riwayat-header">
        <h1>Antrian Hari Ini</h1>
        <Link to="/transaksi-baru" className="btn-primary antrian-new-link">
          + Transaksi Baru
        </Link>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-card-label">Dalam Antrian</span>
          <span className="stat-card-value">{stats.count}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Belum Dibayar</span>
          <span className="stat-card-value stat-card-value-accent">{stats.unpaid}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Nilai Antrian</span>
          <span className="stat-card-value">{formatRupiah(stats.revenue)}</span>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="riwayat-loading">Memuat...</p>}

      {!loading && queue.length > 0 && (
        <div className="riwayat-table antrian-table">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Plat</span>
            <span>Kendaraan</span>
            <span>Staf</span>
            <span>Status</span>
            <span>Bayar</span>
            <span>Waktu</span>
          </div>
          {queue.map((t) => (
            <Link key={t.id} to={`/treatment/${t.id}`} className="riwayat-table-row">
              <span className="riwayat-plate">{t.plate_number}</span>
              <span>{t.treatment_type || '-'}</span>
              <span>{t.pic || '-'}</span>
              <span className={`status-badge status-${t.status}`}>
                {STATUS_LABELS[t.status] || t.status}
              </span>
              <span className={`status-badge ${t.isPaid ? 'status-closed' : 'status-created'}`}>
                {t.isPaid ? 'Lunas' : 'Belum'}
              </span>
              <span>{formatDateTime(t.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
      {!loading && queue.length === 0 && !error && (
        <p className="riwayat-empty">Tidak ada antrian aktif — semua transaksi hari ini sudah ditutup</p>
      )}
    </div>
  )
}
