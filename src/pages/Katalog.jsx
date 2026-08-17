import { useEffect, useState } from 'react'
import { getActiveServices } from '../api'
import { formatRupiah } from '../lib/format'

export default function Katalog() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getActiveServices()
      .then(setServices)
      .catch(() => setError('Gagal memuat katalog layanan'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="katalog-screen">
      <h1>Katalog Layanan</h1>
      <p className="katalog-note">
        Untuk menambah atau mengubah layanan, hubungi admin — dikelola lewat dashboard Supabase.
      </p>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="riwayat-loading">Memuat...</p>}

      {!loading && services.length > 0 && (
        <div className="riwayat-table katalog-table">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Nama Layanan</span>
            <span>Harga</span>
          </div>
          {services.map((service) => (
            <div key={service.id} className="riwayat-table-row">
              <span className="riwayat-plate">{service.name}</span>
              <span className="riwayat-total">{formatRupiah(service.price)}</span>
            </div>
          ))}
        </div>
      )}
      {!loading && services.length === 0 && !error && (
        <p className="riwayat-empty">Belum ada layanan aktif</p>
      )}
    </div>
  )
}
