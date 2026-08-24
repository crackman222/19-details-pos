import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveServices, createTreatment } from '../api'
import { ServicePicker } from '../components/ServicePicker'
import { formatRupiah } from '../lib/format'
import { useAuth } from '../context/useAuth'

export default function TransaksiBaru() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [services, setServices] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [plateNumber, setPlateNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [vehicleBrand, setVehicleBrand] = useState('')
  const [discountType, setDiscountType] = useState('percent')
  const [discountInput, setDiscountInput] = useState('')
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
          requiresVehicle: service.requires_vehicle,
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
  // Services carry their own requires_vehicle flag (migration 006), so a
  // ticket only asks for plate and brand once something vehicle-related is on
  // it — a Cuci Helm ticket never does.
  const needsVehicle = selectedItems.some((item) => item.requiresVehicle)
  // Staff type the discount as either a percentage of the bill or a straight
  // Rupiah amount. Percentages are resolved against the subtotal and rounded
  // to a whole Rupiah — the DB column is numeric but the app never displays or
  // stores fractional Rupiah (see formatRupiah). A discount can't exceed the
  // bill, whichever way it was entered.
  const discountValue = useMemo(() => {
    const typed = Math.max(Number(discountInput) || 0, 0)
    if (!typed) return 0
    const value =
      discountType === 'percent'
        ? Math.round((subtotal * Math.min(typed, 100)) / 100)
        : Math.round(typed)
    return Math.min(value, subtotal)
  }, [discountInput, discountType, subtotal])
  const total = subtotal - discountValue

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (selectedItems.length === 0) {
      setError('Pilih minimal satu layanan')
      return
    }
    if (needsVehicle && !plateNumber.trim()) {
      setError('Nomor plat wajib diisi')
      return
    }
    if (!customerName.trim()) {
      setError('Nama pelanggan wajib diisi')
      return
    }
    if (!customerPhone.trim()) {
      setError('Nomor telepon wajib diisi')
      return
    }

    setSubmitting(true)
    try {
      // No paymentMethod — a new ticket is always queued unpaid and settled
      // later from Detail Transaksi, so it lands at status 'created' with no
      // payment row.
      const treatment = await createTreatment({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        plateNumber: needsVehicle ? plateNumber : null,
        treatmentType: needsVehicle ? vehicleBrand.trim() || null : null,
        pic: profile.full_name,
        notes: notes.trim() || null,
        items: selectedItems,
        discount: discountValue,
      })
      navigate(`/treatment/${treatment.id}`)
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
          {needsVehicle && (
            <>
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
                Merek Kendaraan
                <input
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder="Contoh: Honda Vario"
                />
              </label>
            </>
          )}
          <label>
            Nama Pelanggan
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama pelanggan"
              required
            />
          </label>
          <label>
            Nomor Telepon
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              required
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

        <div className="ticket-discount">
          <label>
            Diskon
            <select
              value={discountType}
              onChange={(e) => {
                // A number typed as a percentage means something completely
                // different in Rupiah, so don't carry it across.
                setDiscountType(e.target.value)
                setDiscountInput('')
              }}
            >
              <option value="percent">Persentase (%)</option>
              <option value="nominal">Nominal (Rp)</option>
            </select>
          </label>
          <input
            type="number"
            min="0"
            max={discountType === 'percent' ? 100 : undefined}
            inputMode="numeric"
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            placeholder={discountType === 'percent' ? 'Contoh: 10' : 'Contoh: 20000'}
            aria-label={discountType === 'percent' ? 'Diskon dalam persen' : 'Diskon dalam Rupiah'}
          />
        </div>

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
          {submitting ? 'Menyimpan...' : 'Simpan ke Antrian'}
        </button>
      </aside>
    </form>
  )
}
