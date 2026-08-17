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

  function toggleService(service) {
    setSelectedItems((items) => {
      const exists = items.find((item) => item.serviceId === service.id)
      if (exists) {
        return items.filter((item) => item.serviceId !== service.id)
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

  function changeQuantity(serviceId, quantity) {
    if (quantity < 1) return
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
        paymentMethod,
      })
      navigate(`/struk/${treatment.id}`)
    } catch {
      setError('Gagal menyimpan transaksi, coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="transaksi-baru-screen">
      <h1>Transaksi Baru</h1>
      <form onSubmit={handleSubmit}>
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

        <h2>Layanan</h2>
        <ServicePicker
          services={services}
          selectedItems={selectedItems}
          onToggle={toggleService}
          onQuantityChange={changeQuantity}
        />

        <label>
          Diskon (Rp)
          <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>

        <h2>Metode Pembayaran</h2>
        <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />

        <label>
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

        <button type="submit" disabled={submitting}>
          {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </form>
    </div>
  )
}
