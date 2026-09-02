import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getTreatmentDetail,
  closeTreatment,
  voidTreatment,
  startProcessing,
  sendToQC,
  markSelesai,
  recordPayment,
  assignWashStaff,
  assignQcStaff,
  getWashProofPhoto,
  getWashProofSignedUrl,
} from '../api'
import { PaymentMethodSelector } from '../components/PaymentMethodSelector'
import { WashProofButton } from '../components/WashProofButton'
import { StaffPicker } from '../components/StaffPicker'
import { MultiStaffPicker } from '../components/MultiStaffPicker'
import { formatRupiah, formatDateTime } from '../lib/format'
import { parseStaffNames } from '../lib/staffNames'

const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  diproses: 'Diproses',
  qc: 'QC',
  selesai: 'Selesai',
  closed: 'Ditutup',
  voided: 'Dibatalkan',
}

export default function DetailTreatment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [treatment, setTreatment] = useState(null)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const load = useCallback(() => {
    getTreatmentDetail(id)
      .then(setTreatment)
      .catch(() => setError('Gagal memuat transaksi'))
    getWashProofPhoto(id)
      .then(async (path) => {
        setHasPhoto(Boolean(path))
        setPhotoUrl(path ? await getWashProofSignedUrl(path) : null)
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!lightboxOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen])

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

  async function handleAssignWash(staffNames) {
    setBusy(true)
    try {
      await assignWashStaff(id, staffNames)
      load()
    } catch {
      setError('Gagal menetapkan petugas cuci')
    } finally {
      setBusy(false)
    }
  }

  async function handleAssignQc(staffName) {
    setBusy(true)
    try {
      await assignQcStaff(id, staffName)
      load()
    } catch {
      setError('Gagal menetapkan petugas QC')
    } finally {
      setBusy(false)
    }
  }

  async function handleStartProcessing() {
    setBusy(true)
    try {
      await startProcessing(id)
      load()
    } catch {
      setError('Gagal memulai proses')
    } finally {
      setBusy(false)
    }
  }

  async function handleSendToQC() {
    if (!hasPhoto) return
    setBusy(true)
    try {
      await sendToQC(id)
      load()
    } catch {
      setError('Gagal mengirim ke QC')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkSelesai() {
    setBusy(true)
    try {
      await markSelesai(id)
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
            <div className="detail-card-plate">{treatment.plate_number || '-'}</div>
          </div>
          <div className="detail-card-badges">
            <span className={`status-badge status-${treatment.status}`}>
              {STATUS_LABELS[treatment.status] || treatment.status}
            </span>
            <span className={`status-badge ${isPaid ? 'status-closed' : 'status-created'}`}>
              {isPaid ? 'Lunas' : 'Belum Dibayar'}
            </span>
            <WashProofButton
              treatmentId={treatment.id}
              hasPhoto={hasPhoto}
              onUploaded={() => {   
                setPhotoError('')
                load()
              }}
              onError={setPhotoError}
            />
          </div>
        </div>

        {treatment.customer_name && (
          <div className="struk-row">
            <span>Pelanggan</span>
            <span>{treatment.customer_name}</span>
          </div>
        )}
        <div className="struk-row">
          <span>Kendaraan</span>
          <span>{treatment.treatment_type || '-'}</span>
        </div>
        <div className="struk-row">
          <span>Staf</span>
          <span>{treatment.pic}</span>
        </div>
        <div className="struk-row struk-row-picker">
          <span>Petugas Cuci</span>
          <MultiStaffPicker
            value={parseStaffNames(treatment.wash_staff)}
            onChange={handleAssignWash}
            disabled={busy || isFinal}
          />
        </div>
        <div className="struk-row">
          <span>Petugas QC</span>
          <StaffPicker value={treatment.qc_staff} onChange={handleAssignQc} disabled={busy || isFinal} />
        </div>
        <div className="struk-row">
          <span>Tanggal</span>
          <span>{formatDateTime(treatment.created_at)}</span>
        </div>
        <div className="struk-row">
          <span>Bukti Foto</span>
          {photoUrl ? (
            <button
              type="button"
              className="wash-proof-thumb-btn"
              onClick={() => setLightboxOpen(true)}
              aria-label="Perbesar bukti foto cuci"
            >
              <img src={photoUrl} alt="Bukti foto cuci" className="wash-proof-thumb" />
            </button>
          ) : (
            <span>Belum ada foto</span>
          )}
        </div>
        {photoError && <p className="form-error">{photoError}</p>}

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

        {treatment.status === 'selesai' && !isPaid && !showPaymentForm && (
          <p className="detail-hint">Pembayaran diperlukan sebelum transaksi bisa ditutup.</p>
        )}

        {treatment.status === 'diproses' && !hasPhoto && (
          <p className="detail-hint">Unggah bukti foto cuci terlebih dahulu sebelum mengirim ke QC.</p>
        )}

        {treatment.notes && <p className="struk-notes">Catatan: {treatment.notes}</p>}

        <div className="detail-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/struk/${treatment.id}`)}>
            Lihat Struk
          </button>
          {!isFinal && (
            <>
              {(treatment.status === 'created' || treatment.status === 'paid') && (
                <button type="button" className="btn-primary" onClick={handleStartProcessing} disabled={busy}>
                  Mulai Proses
                </button>
              )}
              {treatment.status === 'diproses' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSendToQC}
                  disabled={busy || !hasPhoto}
                  title={hasPhoto ? undefined : 'Unggah bukti foto cuci terlebih dahulu'}
                >
                  Kirim ke QC
                </button>
              )}
              {treatment.status === 'qc' && (
                <button type="button" className="btn-primary" onClick={handleMarkSelesai} disabled={busy}>
                  Tandai Selesai
                </button>
              )}
              {treatment.status === 'selesai' && isPaid && (
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

      {lightboxOpen && photoUrl && (
        <div className="photo-lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <button
            type="button"
            className="photo-lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label="Tutup"
          >
            ✕
          </button>
          <img
            src={photoUrl}
            alt="Bukti foto cuci"
            className="photo-lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
