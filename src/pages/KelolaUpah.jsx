import { useCallback, useEffect, useState } from 'react'
import {
  getActiveServices,
  getServiceWageRates,
  setServiceWageRate,
  getDailyWageSummary,
  addWageAdjustment,
  deleteWageAdjustment,
} from '../api'
import { formatRupiah } from '../lib/format'
import { todayDateInput } from '../lib/dateRange'

// Supervisor/admin only (see SupervisorRoute in App.jsx). Two things:
//   - Upah per Layanan: a fixed rupiah amount each service pays out (e.g.
//     Cuci Motor -> Rp7.000), never a percentage and never per staff member
//   - Upah Harian: what that turns into today (or any past day) once
//     multiplied out against tickets, plus one-off bonuses/deductions a
//     supervisor logs by hand — also flat rupiah, never a percentage
// The commission itself is never stored — see getDailyWageSummary in
// src/api/wages.js for how it's computed from today's tickets.
export default function KelolaUpah() {
  const [services, setServices] = useState([])
  const [rates, setRates] = useState([])
  const [ratesLoading, setRatesLoading] = useState(true)
  const [error, setError] = useState('')
  // Bumped whenever a service's wage changes, so the daily earnings table
  // (computed from these rates but not the thing that changed) refetches
  // even without its own date changing.
  const [ratesVersion, setRatesVersion] = useState(0)

  useEffect(() => {
    Promise.all([getActiveServices(), getServiceWageRates()])
      .then(([s, r]) => {
        setServices(s)
        setRates(r)
      })
      .catch(() => setError('Gagal memuat layanan'))
      .finally(() => setRatesLoading(false))
  }, [])

  function reloadRates() {
    setError('')
    Promise.all([getActiveServices(), getServiceWageRates()])
      .then(([s, r]) => {
        setServices(s)
        setRates(r)
      })
      .catch(() => setError('Gagal memuat layanan'))
      .finally(() => setRatesLoading(false))
  }

  function handleRateChanged() {
    reloadRates()
    setRatesVersion((v) => v + 1)
  }

  return (
    <div className="upah-screen">
      <h1>Kelola Upah</h1>
      {error && <p className="form-error">{error}</p>}

      <ServiceWageSection
        services={services}
        rates={rates}
        loading={ratesLoading}
        onChanged={handleRateChanged}
        onError={setError}
      />
      <DailyWageSection ratesVersion={ratesVersion} onError={setError} />
    </div>
  )
}

// Fixed wage per service: what a staff member earns for performing it once,
// regardless of the service's list price. Applies to whoever's listed as
// wash staff on the ticket, same as elsewhere in the app.
function ServiceWageSection({ services, rates, loading, onChanged, onError }) {
  const wageByService = new Map(rates.map((r) => [r.service_id, Number(r.wage_amount)]))

  return (
    <section className="staf-section">
      <div className="staf-section-header">
        <h2 className="transaksi-section-label">Upah per Layanan</h2>
      </div>
      {/* <p className="staf-section-note">
        Nominal tetap yang didapat staf setiap kali mereka mengerjakan layanan ini pada satu kendaraan —
        bukan persentase, dan tidak tergantung harga jual layanan.
      </p> */}

      {loading && <p className="riwayat-loading">Memuat...</p>}
      {!loading && services.length === 0 && <p className="riwayat-empty">Belum ada layanan</p>}
      {!loading && services.length > 0 && (
        <div className="riwayat-table upah-rate-table">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Layanan</span>
            <span>Upah</span>
            <span></span>
          </div>
          {services.map((service) => {
            const currentWage = wageByService.get(service.id) ?? 0
            return (
              // Keyed on the wage too, not just the service — remounts the
              // row (resetting its local input) whenever the saved value
              // changes, instead of syncing it back with an effect.
              <ServiceWageRow
                key={`${service.id}:${currentWage}`}
                service={service}
                currentWage={currentWage}
                onChanged={onChanged}
                onError={onError}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function ServiceWageRow({ service, currentWage, onChanged, onError }) {
  const [value, setValue] = useState(String(currentWage))
  const [busy, setBusy] = useState(false)
  const dirty = value !== '' && Math.round(Number(value)) !== currentWage

  async function handleSave() {
    const wage = Math.round(Number(value))
    if (!Number.isFinite(wage) || wage < 0) {
      onError('Upah harus berupa angka Rupiah, minimal 0')
      return
    }
    setBusy(true)
    onError('')
    try {
      await setServiceWageRate(service.id, wage)
      onChanged()
    } catch {
      onError('Gagal menyimpan upah layanan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="riwayat-table-row upah-rate-row">
      <span className="riwayat-plate">{service.name}</span>
      <span className="upah-rate-input">
        <span>Rp</span>
        <input
          type="number"
          min="0"
          step="500"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          aria-label={`Upah ${service.name}`}
        />
      </span>
      <span className="staf-row-actions">
        <button type="button" className="btn-secondary" onClick={handleSave} disabled={busy || !dirty}>
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
      </span>
    </div>
  )
}

// What each staff member earned on one day: fixed-wage services they
// washed, plus bonuses, minus deductions.
function DailyWageSection({ ratesVersion, onError }) {
  const [date, setDate] = useState(todayDateInput())
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  // ratesVersion isn't read in the body — it's here purely so a rate change
  // elsewhere on the page (which doesn't touch `date`) still gets a new
  // `reload` identity and re-triggers the effect below.
  const reload = useCallback(() => {
    getDailyWageSummary(date)
      .then(setSummary)
      .catch(() => onError('Gagal memuat upah harian'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, onError, ratesVersion])

  // Only the very first load shows "Memuat..." — a date or rate change just
  // swaps the table in place once the new summary arrives, same convention
  // as Laporan's worker-period switch.
  useEffect(() => {
    reload()
  }, [reload])

  const totalNet = summary.reduce((sum, row) => sum + row.netWage, 0)

  return (
    <section className="staf-section">
      <div className="staf-section-header">
        <h2 className="transaksi-section-label">Upah Harian</h2>
        <input
          type="date"
          value={date}
          max={todayDateInput()}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Tanggal"
        />
      </div>
      {/* <p className="staf-section-note">
        Dihitung otomatis dari transaksi pada tanggal ini, ditambah bonus dan dikurangi potongan yang dicatat
        manual.
      </p> */}

      {loading && <p className="riwayat-loading">Memuat...</p>}

      {!loading && (
        <>
          <div className="stat-cards upah-stat-cards">
            <div className="stat-card">
              <span className="stat-card-label">Total Upah</span>
              <span className="stat-card-value stat-card-value-accent">{formatRupiah(totalNet)}</span>
            </div>
          </div>

          {summary.length === 0 ? (
            <p className="riwayat-empty">Belum ada staf aktif</p>
          ) : (
            <div className="riwayat-table upah-daily-table">
              <div className="riwayat-table-row riwayat-table-head">
                <span>Nama</span>
                <span>Upah Jasa</span>
                <span>Penyesuaian</span>
                <span>Total Upah</span>
                <span></span>
              </div>
              {summary.map((row) => (
                <DailyWageRow
                  key={row.profileId}
                  row={row}
                  date={date}
                  expanded={expandedId === row.profileId}
                  onToggle={() => setExpandedId((id) => (id === row.profileId ? null : row.profileId))}
                  onChanged={reload}
                  onError={onError}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function DailyWageRow({ row, date, expanded, onToggle, onChanged, onError }) {
  return (
    <>
      <div className="riwayat-table-row upah-daily-row">
        <span className="riwayat-plate">{row.fullName}</span>
        <span>{formatRupiah(row.serviceEarnings)}</span>
        <span>
          {row.bonusTotal === 0 && row.deductionTotal === 0 && '-'}
          {row.bonusTotal > 0 && <span className="status-badge status-closed">+{formatRupiah(row.bonusTotal)}</span>}
          {row.deductionTotal > 0 && (
            <span className="status-badge status-voided">-{formatRupiah(row.deductionTotal)}</span>
          )}
        </span>
        <span className={`riwayat-total ${row.netWage < 0 ? 'upah-net-negative' : ''}`}>
          {formatRupiah(row.netWage)}
        </span>
        <span className="staf-row-actions">
          <button type="button" className="btn-secondary" onClick={onToggle}>
            {expanded ? 'Tutup' : 'Detail'}
          </button>
        </span>
      </div>
      {expanded && (
        <div className="upah-adjustments-panel">
          <AddAdjustmentForm profileId={row.profileId} date={date} onAdded={onChanged} onError={onError} />
          {row.adjustments.length > 0 && (
            <ul className="upah-adjustments-list">
              {row.adjustments.map((adj) => (
                <AdjustmentListItem key={adj.id} adjustment={adj} onDeleted={onChanged} onError={onError} />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

// Bonus/deduction amounts are always a flat rupiah nominal, typed in by the
// supervisor — never a percentage of anything.
function AddAdjustmentForm({ profileId, date, onAdded, onError }) {
  const [type, setType] = useState('bonus')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')
    const value = Math.round(Number(amount))
    if (!Number.isFinite(value) || value <= 0) {
      onError('Jumlah harus lebih dari nol')
      return
    }
    setSubmitting(true)
    try {
      await addWageAdjustment({ profileId, date, type, amount: value, reason })
      setAmount('')
      setReason('')
      onAdded()
    } catch {
      onError(type === 'bonus' ? 'Gagal menambah bonus' : 'Gagal menambah potongan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="upah-adjustment-form" onSubmit={handleSubmit}>
      <select value={type} onChange={(e) => setType(e.target.value)} disabled={submitting} aria-label="Jenis">
        <option value="bonus">Bonus (+)</option>
        <option value="deduction">Potongan (-)</option>
      </select>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        placeholder="Jumlah (Rp)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={submitting}
      />
      <input
        type="text"
        placeholder="Alasan (opsional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={submitting}
      />
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? 'Menyimpan...' : 'Tambah'}
      </button>
    </form>
  )
}

function AdjustmentListItem({ adjustment, onDeleted, onError }) {
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    setBusy(true)
    onError('')
    try {
      await deleteWageAdjustment(adjustment.id)
      onDeleted()
    } catch {
      onError('Gagal menghapus catatan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="upah-adjustment-item">
      <span className={`status-badge ${adjustment.type === 'bonus' ? 'status-closed' : 'status-voided'}`}>
        {adjustment.type === 'bonus' ? 'Bonus' : 'Potongan'}
      </span>
      <span className="upah-adjustment-amount">{formatRupiah(adjustment.amount)}</span>
      <span className="upah-adjustment-reason">{adjustment.reason || '-'}</span>
      <button type="button" className="btn-secondary" onClick={handleDelete} disabled={busy}>
        {busy ? '...' : 'Hapus'}
      </button>
    </li>
  )
}
