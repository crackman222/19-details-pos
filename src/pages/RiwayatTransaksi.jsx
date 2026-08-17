import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTodayTreatments, searchTreatmentsByPlate } from '../api'
import { formatRupiah, formatDateTime } from '../lib/format'

const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  completed: 'Selesai',
  closed: 'Ditutup',
  voided: 'Dibatalkan',
}

export default function RiwayatTransaksi() {
  const [treatments, setTreatments] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadToday()
  }, [])

  function loadToday() {
    setLoading(true)
    setError('')
    getTodayTreatments()
      .then(setTreatments)
      .catch(() => setError('Gagal memuat riwayat'))
      .finally(() => setLoading(false))
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) {
      loadToday()
      return
    }
    setLoading(true)
    setError('')
    try {
      const results = await searchTreatmentsByPlate(query)
      setTreatments(results)
    } catch {
      setError('Gagal mencari transaksi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="riwayat-screen">
      <h1>Riwayat Transaksi</h1>
      <form onSubmit={handleSearch} className="riwayat-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nomor plat..."
        />
        <button type="submit">Cari</button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Memuat...</p>}

      <ul className="riwayat-list">
        {treatments.map((t) => (
          <li key={t.id}>
            <Link to={`/treatment/${t.id}`} className="riwayat-item">
              <div className="riwayat-item-top">
                <strong>{t.plate_number}</strong>
                <span className={`status-badge status-${t.status}`}>
                  {STATUS_LABELS[t.status] || t.status}
                </span>
              </div>
              <div>{formatDateTime(t.created_at)}</div>
              <div>{formatRupiah(t.total)}</div>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && treatments.length === 0 && <p>Tidak ada transaksi</p>}
    </div>
  )
}
