import { useEffect, useState } from 'react'
import { getActiveServices, getShelfItems, createShelfItem, addShelfStock } from '../api'
import { formatRupiah } from '../lib/format'
import { ServiceIcon } from '../components/ServiceIcon'
import { useAuth } from '../context/useAuth'
import { isSupervisor } from '../lib/roles'

export default function Katalog() {
  const { profile } = useAuth()
  const canManageStock = isSupervisor(profile)
  const [services, setServices] = useState([])
  const [shelfItems, setShelfItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getActiveServices(), getShelfItems()])
      .then(([s, items]) => {
        setServices(s)
        setShelfItems(items)
      })
      .catch(() => setError('Gagal memuat katalog'))
      .finally(() => setLoading(false))
  }, [])

  function reloadShelf() {
    getShelfItems().then(setShelfItems).catch(() => setError('Gagal memuat barang'))
  }

  return (
    <div className="katalog-screen">
      <h1>Katalog</h1>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="riwayat-loading">Memuat...</p>}

      {!loading && (
        <>
          <section className="katalog-section">
            <h2 className="transaksi-section-label">Layanan</h2>
            <p className="katalog-note">
              Untuk menambah atau mengubah layanan, hubungi admin — dikelola lewat dashboard Supabase.
            </p>
            {services.length === 0 ? (
              <p className="riwayat-empty">Belum ada layanan aktif</p>
            ) : (
              <div className="riwayat-table katalog-table">
                <div className="riwayat-table-row riwayat-table-head">
                  <span>Nama Layanan</span>
                  <span>Harga</span>
                </div>
                {services.map((service) => (
                  <div key={service.id} className="riwayat-table-row">
                    <span className="riwayat-plate katalog-service-name">
                      <ServiceIcon name={service.name} />
                      {service.name}
                    </span>
                    <span className="riwayat-total">{formatRupiah(service.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <ShelfSection
            items={shelfItems}
            canManageStock={canManageStock}
            onChanged={reloadShelf}
            onError={setError}
          />
        </>
      )}
    </div>
  )
}

// Barang: goods with finite stock. Everyone sees the shelf and what's left on
// it; only supervisors can add an item or move the stock figure.
function ShelfSection({ items, canManageStock, onChanged, onError }) {
  const [showAddForm, setShowAddForm] = useState(false)

  return (
    <section className="katalog-section">
      <div className="staf-section-header">
        <h2 className="transaksi-section-label">Barang</h2>
        {canManageStock && (
          <button type="button" className="btn-primary" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? 'Tutup' : '+ Tambah Barang'}
          </button>
        )}
      </div>
      <p className="katalog-note">
        {canManageStock
          ? 'Stok berkurang otomatis setiap barang terjual di transaksi.'
          : 'Stok hanya bisa diubah oleh supervisor.'}
      </p>

      {showAddForm && (
        <AddShelfItemForm
          onCreated={() => {
            setShowAddForm(false)
            onChanged()
          }}
          onError={onError}
        />
      )}

      {items.length === 0 ? (
        <p className="riwayat-empty">Belum ada barang</p>
      ) : (
        <div className={`riwayat-table katalog-table ${canManageStock ? 'katalog-shelf-managed' : 'katalog-shelf'}`}>
          <div className="riwayat-table-row riwayat-table-head">
            <span>Nama Barang</span>
            <span>Harga</span>
            <span>Stok</span>
            {canManageStock && <span></span>}
          </div>
          {items.map((item) => (
            <div key={item.id} className="riwayat-table-row">
              <span className="riwayat-plate">{item.name}</span>
              <span className="riwayat-total">{formatRupiah(item.price)}</span>
              <span className={`status-badge ${item.stock > 0 ? 'status-closed' : 'status-voided'}`}>
                {item.stock > 0 ? `${item.stock} tersedia` : 'Habis'}
              </span>
              {canManageStock && (
                <StockAdjuster item={item} onChanged={onChanged} onError={onError} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// Adds to stock rather than setting it — the server does the arithmetic, so
// two supervisors restocking at once both count. Negative values are allowed
// as a correction (a breakage, a miscount).
function StockAdjuster({ item, onChanged, onError }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd() {
    const value = Number(amount)
    if (!Number.isInteger(value) || value === 0) {
      onError('Jumlah stok harus angka bulat dan tidak nol')
      return
    }
    setBusy(true)
    onError('')
    try {
      await addShelfStock(item.id, value)
      setAmount('')
      onChanged()
    } catch (err) {
      onError(err.message || 'Gagal mengubah stok')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="katalog-stock-actions">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="+/-"
        aria-label={`Ubah stok ${item.name}`}
        disabled={busy}
      />
      <button type="button" className="btn-secondary" onClick={handleAdd} disabled={busy}>
        Ubah Stok
      </button>
    </span>
  )
}

function AddShelfItemForm({ onCreated, onError }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')
    if (!name.trim()) {
      onError('Nama barang wajib diisi')
      return
    }
    const priceValue = Math.round(Number(price) || 0)
    const stockValue = Math.round(Number(stock) || 0)
    if (priceValue <= 0) {
      onError('Harga harus lebih dari nol')
      return
    }
    if (stockValue < 0) {
      onError('Stok tidak boleh negatif')
      return
    }

    setSubmitting(true)
    try {
      await createShelfItem({ name: name.trim(), price: priceValue, stock: stockValue })
      setName('')
      setPrice('')
      setStock('')
      onCreated()
    } catch (err) {
      onError(err.message || 'Gagal menambah barang')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="payment-form staf-form" onSubmit={handleSubmit}>
      <div className="payment-form-title">Tambah Barang</div>
      <div className="staf-form-grid">
        <label>
          Nama Barang
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Parfum Mobil" />
        </label>
        <label>
          Harga
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25000"
          />
        </label>
        <label>
          Stok Awal
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="10"
          />
        </label>
      </div>
      <button type="submit" className="btn-primary payment-form-trigger" disabled={submitting}>
        {submitting ? 'Menyimpan...' : 'Simpan Barang'}
      </button>
    </form>
  )
}
