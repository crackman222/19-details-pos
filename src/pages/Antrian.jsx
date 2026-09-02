import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getActiveQueue, getWashProofMap } from '../api'
import { formatRupiah, formatDateTime } from '../lib/format'
import { WashProofButton } from '../components/WashProofButton'
import { TASK_REMINDER_DAYS, daysOpen, isOverdue } from '../lib/taskReminder'

// Only the statuses that can appear in the queue — 'selesai' and later drop
// out of it (see QUEUE_STATUSES in api/treatments.js).
const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  diproses: 'Diproses',
  qc: 'QC',
}

export default function Antrian() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [photoMap, setPhotoMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getActiveQueue()
      .then((data) => {
        setQueue(data)
        return getWashProofMap(data.map((t) => t.id))
      })
      .then((map) => map && setPhotoMap(map))
      .catch(() => setError('Gagal memuat antrian'))
      .finally(() => setLoading(false))
  }, [])

  function markPhotoUploaded(treatmentId) {
    setPhotoMap((map) => ({ ...map, [treatmentId]: true }))
  }

  const stats = useMemo(() => {
    const unpaid = queue.filter((t) => !t.isPaid).length
    const revenue = queue.reduce((sum, t) => sum + Number(t.total || 0), 0)
    // Work not started yet covers both 'created' and 'paid' — paying up front
    // doesn't move the job along, it's still waiting for someone to start it.
    const byStatus = (statuses) => queue.filter((t) => statuses.includes(t.status)).length
    return {
      count: queue.length,
      unpaid,
      revenue,
      belumDiproses: byStatus(['created', 'paid']),
      diproses: byStatus(['diproses']),
      qc: byStatus(['qc']),
    }
  }, [queue])

  const overdueTreatments = useMemo(() => queue.filter((t) => isOverdue(t.created_at)), [queue])

  return (
    <div className="antrian-screen">
      <div className="riwayat-header">
        <h1>Dashboard</h1>
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

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-card-label">
            <span className="status-badge status-created">Belum Diproses</span>
          </span>
          <span className="stat-card-value">{stats.belumDiproses}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            <span className="status-badge status-diproses">Diproses</span>
          </span>
          <span className="stat-card-value">{stats.diproses}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            <span className="status-badge status-qc">QC</span>
          </span>
          <span className="stat-card-value">{stats.qc}</span>
        </div>
      </div>

      {!loading && overdueTreatments.length > 0 && (
        <div className="overdue-alert" role="alert">
          <span className="overdue-alert-icon">⚠️</span>
          <span>
            {overdueTreatments.length} transaksi sudah {TASK_REMINDER_DAYS} hari atau lebih belum
            selesai — segera tindak lanjuti:{' '}
            {overdueTreatments.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ', '}
                <Link to={`/treatment/${t.id}`} className="overdue-alert-link">
                  {t.plate_number || t.treatment_code}
                </Link>
              </span>
            ))}
          </span>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="riwayat-loading">Memuat...</p>}

      {!loading && queue.length > 0 && (
        <div className="riwayat-table antrian-table">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Layanan</span>
            <span>Merek</span>
            <span>Staf</span>
            <span>Status</span>
            <span>Bayar</span>
            <span>Waktu</span>
            <span>Bukti Foto</span>
          </div>
          {queue.map((t) => {
            const overdue = isOverdue(t.created_at)
            return (
            <div
              key={t.id}
              className={`riwayat-table-row ${overdue ? 'overdue' : ''}`}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/treatment/${t.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/treatment/${t.id}`)}
            >
              <span className="riwayat-service">{t.serviceSummary || '-'}</span>
              <span>{t.treatment_type || '-'}</span>
              <span>{t.pic || '-'}</span>
              <span className={`status-badge status-${t.status}`}>
                {STATUS_LABELS[t.status] || t.status}
              </span>
              <span className={`status-badge ${t.isPaid ? 'status-closed' : 'status-created'}`}>
                {t.isPaid ? 'Lunas' : 'Belum'}
              </span>
              <span>
                {formatDateTime(t.created_at)}
                {overdue && (
                  <span className="overdue-badge" title={`Sudah ${daysOpen(t.created_at)} hari belum selesai`}>
                    ⚠️ {daysOpen(t.created_at)} hari
                  </span>
                )}
              </span>
              <span>
                <WashProofButton
                  treatmentId={t.id}
                  hasPhoto={Boolean(photoMap[t.id])}
                  onUploaded={markPhotoUploaded}
                />
              </span>
            </div>
            )
          })}
        </div>
      )}
      {!loading && queue.length === 0 && !error && (
        <p className="riwayat-empty">Tidak ada antrian aktif — semua transaksi sudah selesai</p>
      )}
    </div>
  )
}
