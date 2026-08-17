import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTreatmentDetail, closeTreatment, voidTreatment, completeTreatment } from '../api'
import { formatRupiah, formatDateTime } from '../lib/format'

const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  completed: 'Selesai',
  closed: 'Ditutup',
  voided: 'Dibatalkan',
}

export default function DetailTreatment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [treatment, setTreatment] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    getTreatmentDetail(id)
      .then(setTreatment)
      .catch(() => setError('Gagal memuat transaksi'))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleComplete() {
    setBusy(true)
    try {
      await completeTreatment(id)
      load()
    } catch {
      setError('Gagal menyelesaikan transaksi')
    } finally {
      setBusy(false)
    }
  }

  async function handleClose() {
    setBusy(true)
    try {
      await closeTreatment(id)
      load()
    } catch {
      setError('Gagal menutup transaksi')
    } finally {
      setBusy(false)
    }
  }

  async function handleVoid() {
    if (!confirm('Batalkan transaksi ini?')) return
    setBusy(true)
    try {
      await voidTreatment(id)
      load()
    } catch {
      setError('Gagal membatalkan transaksi')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="detail-screen">
        <p className="form-error">{error}</p>
      </div>
    )
  }
  if (!treatment) {
    return <div className="loading-screen">Memuat...</div>
  }

  const isFinal = treatment.status === 'voided' || treatment.status === 'closed'

  return (
    <div className="detail-screen">
      <h1>Detail Transaksi</h1>
      <span className={`status-badge status-${treatment.status}`}>
        {STATUS_LABELS[treatment.status] || treatment.status}
      </span>

      <div className="struk-row">
        <span>Kode</span>
        <span>{treatment.treatment_code}</span>
      </div>
      <div className="struk-row">
        <span>Plat</span>
        <span>{treatment.plate_number}</span>
      </div>
      <div className="struk-row">
        <span>Kendaraan</span>
        <span>{treatment.treatment_type || '-'}</span>
      </div>
      <div className="struk-row">
        <span>Staf</span>
        <span>{treatment.pic}</span>
      </div>
      <div className="struk-row">
        <span>Tanggal</span>
        <span>{formatDateTime(treatment.created_at)}</span>
      </div>

      <div className="struk-items">
        {treatment.items.map((item) => (
          <div key={item.id} className="struk-item">
            <span>
              {item.service_name} x{item.quantity}
            </span>
            <span>{formatRupiah(item.subtotal)}</span>
          </div>
        ))}
      </div>

      <div className="struk-row struk-total">
        <span>Total</span>
        <span>{formatRupiah(treatment.total)}</span>
      </div>

      <div className="detail-actions">
        <button type="button" onClick={() => navigate(`/struk/${treatment.id}`)}>
          Lihat Struk
        </button>
        {!isFinal && (
          <>
            {treatment.status === 'paid' && (
              <button type="button" onClick={handleComplete} disabled={busy}>
                Tandai Selesai
              </button>
            )}
            {treatment.status === 'completed' && (
              <button type="button" onClick={handleClose} disabled={busy}>
                Tutup Transaksi
              </button>
            )}
            <button type="button" className="danger" onClick={handleVoid} disabled={busy}>
              Batalkan
            </button>
          </>
        )}
      </div>
    </div>
  )
}
