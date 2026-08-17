import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getTreatmentDetail,
  closeTreatment,
  voidTreatment,
  completeTreatment,
  recordPayment,
} from '../api'
import { PaymentMethodSelector } from '../components/PaymentMethodSelector'
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
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const load = useCallback(() => {
    getTreatmentDetail(id)
      .then(setTreatment)
      .catch(() => setError('Gagal memuat transaksi'))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleRecordPayment() {
    setBusy(true)
    try {
      await recordPayment(id, { amount: treatment.total, paymentMethod })
      setShowPaymentForm(false)
      load()
    } catch {
      setError('Gagal mencatat pembayaran')
    } finally {
      setBusy(false)
    }
  }

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
  const isPaid = Boolean(treatment.payment)

  return (
    <div className="detail-screen">
      <h1>Detail Transaksi</h1>

      <div className="detail-card">
        <div className="detail-card-header">
          <div>
            <div className="detail-card-code">{treatment.treatment_code}</div>
            <div className="detail-card-plate">{treatment.plate_number}</div>
          </div>
          <div className="detail-card-badges">
            <span className={`status-badge status-${treatment.status}`}>
              {STATUS_LABELS[treatment.status] || treatment.status}
            </span>
            <span className={`status-badge ${isPaid ? 'status-closed' : 'status-created'}`}>
              {isPaid ? 'Lunas' : 'Belum Dibayar'}
            </span>
          </div>
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

        <hr />
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
        <hr />

        <div className="struk-row struk-total">
          <span>Total</span>
          <span>{formatRupiah(treatment.total)}</span>
        </div>

        {!isFinal && !isPaid && (
          <div className="payment-form">
            {showPaymentForm ? (
              <>
                <div className="payment-form-title">Catat Pembayaran</div>
                <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
                <div className="detail-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowPaymentForm(false)}>
                    Batal
                  </button>
                  <button type="button" className="btn-primary" onClick={handleRecordPayment} disabled={busy}>
                    Konfirmasi · {formatRupiah(treatment.total)}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary payment-form-trigger"
                onClick={() => setShowPaymentForm(true)}
              >
                Catat Pembayaran
              </button>
            )}
          </div>
        )}

        {treatment.status === 'completed' && !isPaid && !showPaymentForm && (
          <p className="detail-hint">Pembayaran diperlukan sebelum transaksi bisa ditutup.</p>
        )}

        <div className="detail-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/struk/${treatment.id}`)}>
            Lihat Struk
          </button>
          {!isFinal && (
            <>
              {treatment.status !== 'completed' && (
                <button type="button" className="btn-primary" onClick={handleComplete} disabled={busy}>
                  Tandai Selesai
                </button>
              )}
              {treatment.status === 'completed' && isPaid && (
                <button type="button" className="btn-primary" onClick={handleClose} disabled={busy}>
                  Tutup Transaksi
                </button>
              )}
              <button type="button" className="btn-danger" onClick={handleVoid} disabled={busy}>
                Batalkan
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
