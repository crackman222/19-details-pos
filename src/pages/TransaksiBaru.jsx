import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveServices, getAvailableShelfItems, createTreatment } from '../api'
import { ServicePicker } from '../components/ServicePicker'
import { ShelfItemPicker } from '../components/ShelfItemPicker'
import { formatRupiah } from '../lib/format'
import { useAuth } from '../context/useAuth'
import { isStaff } from '../lib/roles'
import { describePlateNumber, plateNumberError } from '../lib/plateNumber'

export default function TransaksiBaru() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  // On a phone the ticket panel sits below a long catalog, so the submit
  // button scrolls away. Workers get a fixed bar with the running total
  // instead; the in-panel button is hidden for them in CSS.
  const workerView = isStaff(profile)

  const [services, setServices] = useState([])
  const [shelfItems, setShelfItems] = useState([])
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
    // Only what's in stock right now — a ticket can't sell what isn't there,
    // and the database rejects it anyway if the last one goes while this form
    // is open.
    getAvailableShelfItems()
      .then(setShelfItems)
      .catch(() => setError('Gagal memuat daftar barang'))
  }, [])

  // A ticket line is a service or a shelf item, so lines are keyed by a
  // composite key rather than a service id — the two id spaces are separate
  // and would otherwise collide.
  function addLine(line) {
    const existing = selectedItems.find((item) => item.key === line.key)
    // maxQuantity is the stock on hand for goods, undefined for services —
    // this branch never applies to a service line.
    if (existing?.maxQuantity != null && existing.quantity >= existing.maxQuantity) {
      setError('Stok barang ini sudah habis, tidak bisa menambah lagi')
      return
    }
    setError('')
    setSelectedItems((items) => {
      if (!existing) return [...items, { ...line, quantity: 1 }]
      return items.map((item) =>
        item.key === line.key ? { ...item, quantity: item.quantity + 1 } : item
      )
    })
  }

  function addService(service) {
    addLine({
      key: `service-${service.id}`,
      serviceId: service.id,
      serviceName: service.name,
      unitPrice: service.price,
      requiresVehicle: service.requires_vehicle,
    })
  }

  // soldOut comes straight from the picker's own stock check, so an item that
  // ran out is rejected here before it ever reaches addLine.
  function addShelfItem(item, soldOut) {
    if (soldOut) {
      setError('Stok barang ini sudah habis, tidak bisa menambah lagi')
      return
    }
    addLine({
      key: `shelf-${item.id}`,
      shelfItemId: item.id,
      serviceName: item.name,
      unitPrice: item.price,
      requiresVehicle: false,
      maxQuantity: item.stock,
    })
  }

  function removeLine(key) {
    setSelectedItems((items) => items.filter((item) => item.key !== key))
  }

  function changeQuantity(key, quantity) {
    if (quantity < 1) {
      removeLine(key)
      return
    }
    setSelectedItems((items) =>
      items.map((item) =>
        item.key === key
          ? { ...item, quantity: Math.min(quantity, item.maxQuantity ?? quantity) }
          : item
      )
    )
  }

  const subtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [selectedItems]
  )
  // Units on the ticket, not distinct lines — two of the same shelf item is
  // "2 item" on the worker action bar, matching what the quantity steppers say.
  const lineCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems]
  )
  // Services carry their own requires_vehicle flag (migration 006), so a
  // ticket only asks for plate and brand once something vehicle-related is on
  // it — a Cuci Helm ticket never does.
  const needsVehicle = selectedItems.some((item) => item.requiresVehicle)
  // Live read of the plate field against the real regional-code table (see
  // lib/plateNumber.js) — this is what "scans" it: not a camera, a format +
  // region check that catches a fabricated plate before the ticket saves.
  const plateCheck = useMemo(
    () => (needsVehicle ? describePlateNumber(plateNumber) : null),
    [needsVehicle, plateNumber]
  )
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
      setError('Pilih minimal satu layanan atau barang')
      return
    }
    if (needsVehicle) {
      const plateError = plateNumberError(plateNumber)
      if (plateError) {
        setError(plateError)
        return
      }
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
    } catch (err) {
      // Stock can run out between loading this form and submitting it, and
      // that message names the actual problem — don't bury it.
      setError(err.message?.includes('Stok') ? err.message : 'Gagal menyimpan transaksi, coba lagi')
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

        <h2 className="transaksi-section-label transaksi-section-label-spaced">Barang</h2>
        <ShelfItemPicker items={shelfItems} selectedItems={selectedItems} onAdd={addShelfItem} />
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
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="Contoh: B 1234 XYZ"
                  className={plateCheck?.empty === false ? (plateCheck.valid ? 'plate-input-valid' : 'plate-input-invalid') : ''}
                  required
                />
                {plateCheck?.valid && (
                  <span className="plate-check plate-check-valid">✓ Wilayah {plateCheck.region}</span>
                )}
                {plateCheck && !plateCheck.valid && !plateCheck.empty && (
                  <span className="plate-check plate-check-invalid">
                    {plateCheck.reason === 'region'
                      ? `Kode wilayah "${plateCheck.code}" tidak dikenali`
                      : 'Format belum lengkap — contoh: B 1234 XYZ'}
                  </span>
                )}
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
            <p className="ticket-lines-empty">Belum ada item — pilih layanan atau barang di sebelah kiri</p>
          ) : (
            selectedItems.map((item) => (
              <div key={item.key} className="ticket-line">
                <div className="ticket-line-info">
                  <span className="ticket-line-name">{item.serviceName}</span>
                  <span className="ticket-line-unit">
                    {formatRupiah(item.unitPrice)} / item
                    {item.maxQuantity != null && ` · stok ${item.maxQuantity}`}
                  </span>
                </div>
                <div className="ticket-line-qty">
                  <button type="button" onClick={() => changeQuantity(item.key, item.quantity - 1)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.key, item.quantity + 1)}
                    disabled={item.maxQuantity != null && item.quantity >= item.maxQuantity}
                  >
                    +
                  </button>
                </div>
                <span className="ticket-line-total">
                  {formatRupiah(item.unitPrice * item.quantity)}
                </span>
                <button
                  type="button"
                  className="ticket-line-remove"
                  onClick={() => removeLine(item.key)}
                  aria-label="Hapus item"
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

      {workerView && (
        <div className="worker-actionbar">
          <div className="worker-actionbar-summary">
            <span className="worker-actionbar-count">
              {lineCount} item{lineCount === 0 ? ' dipilih' : ''}
            </span>
            <span className="worker-actionbar-total">{formatRupiah(total)}</span>
          </div>
          {/* Inside the same <form>, so this submits it exactly like the
              button above — no duplicated handler. */}
          <button
            type="submit"
            className="worker-actionbar-submit"
            disabled={submitting || selectedItems.length === 0}
          >
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      )}
    </form>
  )
}
