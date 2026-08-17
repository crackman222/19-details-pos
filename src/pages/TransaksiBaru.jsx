import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveServices, createTreatment } from '../api'
import { ServicePicker } from '../components/ServicePicker'
import { PaymentMethodSelector } from '../components/PaymentMethodSelector'
import { formatRupiah } from '../lib/format'
import { useAuth } from '../context/useAuth'

export default function TransaksiBaru() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [services, setServices] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [plateNumber, setPlateNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [treatmentType, setTreatmentType] = useState('')
  const [payNow, setPayNow] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getActiveServices()
      .then(setServices)
      .catch(() => setError('Gagal memuat daftar layanan'))
  }, [])

  function addService(service) {
    setSelectedItems((items) => {
      const existing = items.find((item) => item.serviceId === service.id)
      if (existing) {
        return items.map((item) =>
          item.serviceId === service.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [
        ...items,
        {
          serviceId: service.id,
          serviceName: service.name,
          unitPrice: service.price,
          quantity: 1,
        },
      ]
    })
  }

  function removeService(serviceId) {
    setSelectedItems((items) => items.filter((item) => item.serviceId !== serviceId))
  }

  function changeQuantity(serviceId, quantity) {
    if (quantity < 1) {
      removeService(serviceId)
      return
    }
    setSelectedItems((items) =>
      items.map((item) => (item.serviceId === serviceId ? { ...item, quantity } : item))
    )
  }

  const subtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [selectedItems]
  )
  const discountValue = Number(discount) || 0
  const total = Math.max(subtotal - discountValue, 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!plateNumber.trim()) {
      setError('Nomor plat wajib diisi')
      return
    }
    if (selectedItems.length === 0) {
      setError('Pilih minimal satu layanan')
      return
    }

    setSubmitting(true)
    try {
      const treatment = await createTreatment({
        customerName: customerName.trim() || null,
        plateNumber,
        treatmentType: treatmentType.trim() || null,
        pic: profile.full_name,
        notes: notes.trim() || null,
        items: selectedItems,
        discount: discountValue,
        paymentMethod: payNow ? paymentMethod : undefined,
      })
      navigate(payNow ? `/struk/${treatment.id}` : `/treatment/${treatment.id}`)
    } catch {
      setError('Gagal menyimpan transaksi, coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="transaksi-baru-screen" onSubmit={handleSubmit}>
      <div className="transaksi-catalog">
        <div className="transaksi-catalog-header">
          <h1>Transaksi Baru</h1>
        </div>
        <h2 className="transaksi-section-label">Layanan</h2>
        <ServicePicker services={services} selectedItems={selectedItems} onAdd={addService} />
      </div>

      <aside className="ticket-panel">
        <div className="ticket-panel-title">Tiket Saat Ini</div>

        <div className="ticket-fields">
          <label>
            Nomor Plat
            <input
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="Contoh: B 1234 XYZ"
              required
            />
          </label>
          <label>
            Nama Pelanggan (opsional)
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama pelanggan"
            />
          </label>
          <label>
            Jenis Kendaraan
            <input
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
              placeholder="Mobil / Motor"
            />
          </label>
        </div>

        <div className="ticket-lines">
          {selectedItems.length === 0 ? (
            <p className="ticket-lines-empty">Belum ada layanan — pilih layanan di sebelah kiri</p>
          ) : (
            selectedItems.map((item) => (
              <div key={item.serviceId} className="ticket-line">
                <div className="ticket-line-info">
                  <span className="ticket-line-name">{item.serviceName}</span>
                  <span className="ticket-line-unit">{formatRupiah(item.unitPrice)} / item</span>
                </div>
                <div className="ticket-line-qty">
                  <button type="button" onClick={() => changeQuantity(item.serviceId, item.quantity - 1)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => changeQuantity(item.serviceId, item.quantity + 1)}>
                    +
                  </button>
                </div>
                <span className="ticket-line-total">
                  {formatRupiah(item.unitPrice * item.quantity)}
                </span>
                <button
                  type="button"
                  className="ticket-line-remove"
                  onClick={() => removeService(item.serviceId)}
                  aria-label="Hapus layanan"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <label className="ticket-discount">
          Diskon (Rp)
          <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>

        <h2 className="transaksi-section-label">Pembayaran</h2>
        <div className="pay-toggle">
          <button
            type="button"
            className={!payNow ? 'active' : ''}
            onClick={() => setPayNow(false)}
          >
            Bayar Nanti
          </button>
          <button
            type="button"
            className={payNow ? 'active' : ''}
            onClick={() => setPayNow(true)}
          >
            Bayar Sekarang
          </button>
        </div>
        {payNow ? (
          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
        ) : (
          <p className="pay-toggle-note">
            Kendaraan masuk antrian dulu — pembayaran bisa dicatat kapan saja dari halaman Antrian atau Detail Transaksi.
          </p>
        )}

        <label className="ticket-notes">
          Catatan
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan tambahan (opsional)"
          />
        </label>

        <div className="transaksi-summary">
          <div>
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          <div>
            <span>Diskon</span>
            <span>{formatRupiah(discountValue)}</span>
          </div>
          <div className="transaksi-total">
            <span>Total</span>
            <span>{formatRupiah(total)}</span>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="ticket-submit" disabled={submitting}>
          {submitting
            ? 'Menyimpan...'
            : payNow
              ? `Terima Pembayaran · ${formatRupiah(total)}`
              : 'Simpan ke Antrian'}
        </button>
      </aside>
    </form>
  )
}
