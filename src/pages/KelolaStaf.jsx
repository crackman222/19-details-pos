import { useEffect, useState } from 'react'
import {
  getAllWorkers,
  updateWorker,
  setWorkerActive,
  getAllFieldWorkers,
  createFieldWorker,
  updateFieldWorker,
  setFieldWorkerActive,
} from '../api'
import { useAuth } from '../context/useAuth'

export default function KelolaStaf() {
  const { profile: currentProfile } = useAuth()
  const [workers, setWorkers] = useState([])
  const [fieldWorkers, setFieldWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getAllWorkers(), getAllFieldWorkers()])
      .then(([w, f]) => {
        setWorkers(w)
        setFieldWorkers(f)
      })
      .catch(() => setError('Gagal memuat daftar staf'))
      .finally(() => setLoading(false))
  }, [])

  function reload() {
    setError('')
    Promise.all([getAllWorkers(), getAllFieldWorkers()]).then(([w, f]) => {
      setWorkers(w)
      setFieldWorkers(f)
    })
  }

  if (loading) return <div className="loading-screen">Memuat...</div>

  // Admin accounts (including whoever's currently logged in) are never
  // editable from this page — no self-lockout, no one admin quietly
  // deactivating or demoting another. Admin changes go through the
  // Supabase dashboard directly.
  const manageableWorkers = workers.filter((w) => w.role !== 'admin' && w.id !== currentProfile?.id)

  return (
    <div className="staf-screen">
      <h1>Kelola Staf</h1>
      {error && <p className="form-error">{error}</p>}

      <OfficeStaffSection workers={manageableWorkers} onChanged={reload} onError={setError} />
      <FieldWorkerSection fieldWorkers={fieldWorkers} onChanged={reload} onError={setError} />
    </div>
  )
}

// --- Staf Kantor (office staff — dashboard access, profiles + Auth login) ---
// Editable here, but not creatable: a new dashboard login needs a PIN and a
// real credential handoff, so adding one stays a manual, owner-mediated
// process (see CLAUDE.md) rather than a self-serve button. Admins (and the
// viewer themselves) are filtered out before this ever sees them — see
// KelolaStaf's manageableWorkers.

function OfficeStaffSection({ workers, onChanged, onError }) {
  const [editingId, setEditingId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function handleToggleActive(worker) {
    setBusyId(worker.id)
    try {
      await setWorkerActive(worker.id, !worker.is_active)
      onChanged()
    } catch {
      onError('Gagal mengubah status staf')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="staf-section">
      <div className="staf-section-header">
        <h2 className="transaksi-section-label">Staf Kantor</h2>
        {/* <p className="staf-section-note">
          Punya akses dashboard. Menambah staf kantor baru perlu PIN &amp; verifikasi langsung — hubungi admin utama.
          Akun admin (termasuk akun Anda sendiri) tidak ditampilkan di sini — kelola lewat dashboard Supabase.
        </p> */}
      </div>

      {workers.length === 0 ? (
        <p className="riwayat-empty">Belum ada staf kantor</p>
      ) : (
        <div className="riwayat-table staf-table">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Nama</span>
            <span>Telepon</span>
            <span>Status</span>
            <span></span>
          </div>
          {workers.map((w) =>
            editingId === w.id ? (
              <EditOfficeStaffRow
                key={w.id}
                worker={w}
                onSaved={() => {
                  setEditingId(null)
                  onChanged()
                }}
                onCancel={() => setEditingId(null)}
                onError={onError}
              />
            ) : (
              <div key={w.id} className="riwayat-table-row">
                <span className="riwayat-plate">{w.full_name}</span>
                <span>{w.phone || '-'}</span>
                <span className={`status-badge ${w.is_active ? 'status-closed' : 'status-voided'}`}>
                  {w.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
                <span className="staf-row-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditingId(w.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={w.is_active ? 'btn-danger' : 'btn-primary'}
                    onClick={() => handleToggleActive(w)}
                    disabled={busyId === w.id}
                  >
                    {w.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </span>
              </div>
            )
          )}
        </div>
      )}
    </section>
  )
}

// No role column/field here at all — every row reaching this component is
// already guaranteed role='staff' (KelolaStaf filters admins out before
// this renders), so it's not just non-editable, it's not worth displaying.
// Granting admin stays a Supabase-dashboard action.
function EditOfficeStaffRow({ worker, onSaved, onCancel, onError }) {
  const [fullName, setFullName] = useState(worker.full_name)
  const [phone, setPhone] = useState(worker.phone || '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    onError('')
    if (!fullName.trim()) {
      onError('Nama wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      await updateWorker(worker.id, { fullName: fullName.trim(), phone: phone.trim() || null, role: worker.role })
      onSaved()
    } catch {
      onError('Gagal menyimpan perubahan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="riwayat-table-row staf-edit-row">
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={submitting} />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="08xxxxxxxxxx"
        disabled={submitting}
      />
      <span />
      <span className="staf-row-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={submitting}>
          Simpan
        </button>
      </span>
    </div>
  )
}

// --- Pekerja Lapangan (field workers — no dashboard access, no login at
// all) — assignable as wash/QC on a treatment. Fully self-serve for admins:
// no credentials involved, so there's nothing that needs the owner.

function FieldWorkerSection({ fieldWorkers, onChanged, onError }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function handleToggleActive(worker) {
    setBusyId(worker.id)
    try {
      await setFieldWorkerActive(worker.id, !worker.is_active)
      onChanged()
    } catch {
      onError('Gagal mengubah status pekerja')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="staf-section">
      <div className="staf-section-header">
        <h2 className="transaksi-section-label">Pekerja Lapangan</h2>
        <button type="button" className="btn-primary" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'Tutup' : '+ Tambah Pekerja'}
        </button>
      </div>
      {/* <p className="staf-section-note">
        Tidak punya akses dashboard — hanya bisa ditugaskan sebagai petugas cuci atau QC.
      </p> */}

      {showAddForm && (
        <AddFieldWorkerForm
          onCreated={() => {
            setShowAddForm(false)
            onChanged()
          }}
          onError={onError}
        />
      )}

      {fieldWorkers.length === 0 ? (
        <p className="riwayat-empty">Belum ada pekerja lapangan</p>
      ) : (
        <div className="riwayat-table staf-table staf-table-field">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Nama</span>
            <span>Telepon</span>
            <span>Status</span>
            <span></span>
          </div>
          {fieldWorkers.map((w) =>
            editingId === w.id ? (
              <EditFieldWorkerRow
                key={w.id}
                worker={w}
                onSaved={() => {
                  setEditingId(null)
                  onChanged()
                }}
                onCancel={() => setEditingId(null)}
                onError={onError}
              />
            ) : (
              <div key={w.id} className="riwayat-table-row">
                <span className="riwayat-plate">{w.full_name}</span>
                <span>{w.phone || '-'}</span>
                <span className={`status-badge ${w.is_active ? 'status-closed' : 'status-voided'}`}>
                  {w.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
                <span className="staf-row-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditingId(w.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={w.is_active ? 'btn-danger' : 'btn-primary'}
                    onClick={() => handleToggleActive(w)}
                    disabled={busyId === w.id}
                  >
                    {w.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </span>
              </div>
            )
          )}
        </div>
      )}
    </section>
  )
}

function AddFieldWorkerForm({ onCreated, onError }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')
    if (!fullName.trim()) {
      onError('Nama wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      await createFieldWorker({ fullName: fullName.trim(), phone: phone.trim() || null })
      setFullName('')
      setPhone('')
      onCreated()
    } catch {
      onError('Gagal menambah pekerja')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="payment-form staf-form" onSubmit={handleSubmit}>
      <div className="payment-form-title">Tambah Pekerja Lapangan</div>
      <div className="staf-form-grid">
        <label>
          Nama Lengkap
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama pekerja" />
        </label>
        <label>
          Telepon (opsional)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
        </label>
      </div>
      <button type="submit" className="btn-primary payment-form-trigger" disabled={submitting}>
        {submitting ? 'Menyimpan...' : 'Simpan Pekerja'}
      </button>
    </form>
  )
}

function EditFieldWorkerRow({ worker, onSaved, onCancel, onError }) {
  const [fullName, setFullName] = useState(worker.full_name)
  const [phone, setPhone] = useState(worker.phone || '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    onError('')
    if (!fullName.trim()) {
      onError('Nama wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      await updateFieldWorker(worker.id, { fullName: fullName.trim(), phone: phone.trim() || null })
      onSaved()
    } catch {
      onError('Gagal menyimpan perubahan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="riwayat-table-row staf-edit-row staf-edit-row-field">
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={submitting} />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="08xxxxxxxxxx"
        disabled={submitting}
      />
      <span />
      <span className="staf-row-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={submitting}>
          Simpan
        </button>
      </span>
    </div>
  )
}
