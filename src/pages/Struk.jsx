import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTreatmentDetail } from '../api'
import { formatRupiah, formatDateTime } from '../lib/format'

const PAYMENT_LABELS = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' }

export default function Struk() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [treatment, setTreatment] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getTreatmentDetail(id)
      .then(setTreatment)
      .catch(() => setError('Gagal memuat struk'))
  }, [id])

  if (error) {
    return (
      <div className="struk-screen">
        <p className="form-error">{error}</p>
      </div>
    )
  }
  if (!treatment) {
    return <div className="loading-screen">Memuat...</div>
  }

  const isPaid = Boolean(treatment.payment)

  return (
    <div className="struk-screen">
      <div className="struk-card">
        <div className={`struk-check ${isPaid ? '' : 'struk-check-pending'}`}>{isPaid ? '✓' : '⏳'}</div>
        <h1>Nineteen Details</h1>
        <p className="struk-meta">{formatDateTime(treatment.created_at)}</p>
        <p className="struk-meta">{treatment.treatment_code}</p>

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

        <div className="struk-row">
          <span>Subtotal</span>
          <span>{formatRupiah(treatment.subtotal)}</span>
        </div>
        {treatment.discount > 0 && (
          <div className="struk-row">
            <span>Diskon</span>
            <span>-{formatRupiah(treatment.discount)}</span>
          </div>
        )}
        <div className="struk-row struk-total">
          <span>Total</span>
          <span>{formatRupiah(treatment.total)}</span>
        </div>
        <div className="struk-row">
          <span>Pembayaran</span>
          <span>{isPaid ? PAYMENT_LABELS[treatment.payment.payment_method] : 'Belum dibayar'}</span>
        </div>

        {treatment.notes && <p className="struk-notes">Catatan: {treatment.notes}</p>}

        <button type="button" className="btn-primary struk-done" onClick={() => navigate('/')}>
          Selesai
        </button>
      </div>
    </div>
  )
}
