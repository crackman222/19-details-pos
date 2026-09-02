import { useEffect, useState } from 'react'
import { getAllWorkers, createWorker, createWorkerLogin, updateWorker, setWorkerActive } from '../api'
import { suggestUsername, isValidUsername } from '../lib/username'
import { useAuth } from '../context/useAuth'
import { ROLES, ROLE_LABELS, isAdmin } from '../lib/roles'

// One roster since migration 009: field workers and office staff are all
// rows in `profiles` now. What separates them is `role` (what they can open)
// and `username` (whether they have a login at all) — not which table they
// live in.
export default function KelolaStaf() {
  const { profile: currentProfile } = useAuth()
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAllWorkers()
      .then(setWorkers)
      .catch(() => setError('Gagal memuat daftar staf'))
      .finally(() => setLoading(false))
  }, [])

  function reload() {
    setError('')
    getAllWorkers().then(setWorkers)
  }

  if (loading) return <div className="loading-screen">Memuat...</div>

  // Admin accounts (including whoever's currently logged in) are never
  // editable from this page — no self-lockout, no one admin quietly
  // deactivating or demoting another. Admin changes go through the
  // Supabase dashboard directly.
  const manageableWorkers = workers.filter((w) => !isAdmin(w) && w.id !== currentProfile?.id)

  return (
    <div className="staf-screen">
      <h1>Kelola Staf</h1>
      {error && <p className="form-error">{error}</p>}

      <StaffSection workers={manageableWorkers} onChanged={reload} onError={setError} />
    </div>
  )
}

function StaffSection({ workers, onChanged, onError }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  // The person being given a login, if any — the PIN form opens over the row.
  const [accountFor, setAccountFor] = useState(null)

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
        <h2 className="transaksi-section-label">Staf</h2>
        <button type="button" className="btn-primary" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'Tutup' : '+ Tambah Staf'}
        </button>
      </div>

      {showAddForm && (
        <AddStaffForm
          onCreated={() => {
            setShowAddForm(false)
            onChanged()
          }}
          onError={onError}
        />
      )}

      {accountFor && (
        <CreateLoginForm
          worker={accountFor}
          onCreated={() => {
            setAccountFor(null)
            onChanged()
          }}
          onCancel={() => setAccountFor(null)}
          onError={onError}
        />
      )}

      {workers.length === 0 ? (
        <p className="riwayat-empty">Belum ada staf</p>
      ) : (
        <div className="riwayat-table staf-table">
          <div className="riwayat-table-row riwayat-table-head">
            <span>Nama</span>
            <span>Telepon</span>
            <span>Peran</span>
            <span>Akun</span>
            <span>Status</span>
            <span></span>
          </div>
          {workers.map((w) =>
            editingId === w.id ? (
              <EditStaffRow
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
                <span>{ROLE_LABELS[w.role] || w.role}</span>
                <span className="staf-username">{w.username || 'Tanpa akun'}</span>
                <span className={`status-badge ${w.is_active ? 'status-closed' : 'status-voided'}`}>
                  {w.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
                <span className="staf-row-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditingId(w.id)}>
                    Edit
                  </button>
                  {!w.username && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setAccountFor(w)}
                    >
                      Buat Akun
                    </button>
                  )}
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

// Adds someone to the roster. Ticking "buat akun login" also creates their
// Auth account in the same submit, via the create-worker Edge Function —
// that's the only way to set a PIN, since the browser can't create another
// user's login without hijacking the current session. Leave it unticked for
// someone who only needs to be assignable as wash/QC staff.
function AddStaffForm({ onCreated, onError }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState(ROLES.STAFF)
  const [withLogin, setWithLogin] = useState(false)
  const [username, setUsername] = useState('')
  // Until the admin types a username themselves, it tracks the name — the
  // handle is fixed once the account exists, so getting it right up front
  // matters more than it looks.
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const effectiveUsername = usernameTouched ? username : suggestUsername(fullName)

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')
    if (!fullName.trim()) {
      onError('Nama wajib diisi')
      return
    }
    if (withLogin && !isValidUsername(effectiveUsername)) {
      onError('Username minimal 3 karakter, hanya huruf kecil, angka, dan titik')
      return
    }
    if (withLogin && !/^\d{6}$/.test(pin)) {
      onError('PIN harus 6 digit angka')
      return
    }

    setSubmitting(true)
    try {
      const fields = { fullName: fullName.trim(), phone: phone.trim() || null, role }
      if (withLogin) {
        await createWorkerLogin({ ...fields, username: effectiveUsername, pin })
      } else {
        await createWorker(fields)
      }
      setFullName('')
      setPhone('')
      setRole(ROLES.STAFF)
      setWithLogin(false)
      setUsername('')
      setUsernameTouched(false)
      setPin('')
      onCreated()
    } catch (err) {
      onError(err.message || 'Gagal menambah staf')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="payment-form staf-form" onSubmit={handleSubmit}>
      <div className="payment-form-title">Tambah Staf</div>
      <div className="staf-form-grid">
        <label>
          Nama Lengkap
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama staf" />
        </label>
        <label>
          Telepon (opsional)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
        </label>
        <label>
          Peran
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value={ROLES.STAFF}>{ROLE_LABELS[ROLES.STAFF]}</option>
            <option value={ROLES.SUPERVISOR}>{ROLE_LABELS[ROLES.SUPERVISOR]}</option>
          </select>
        </label>
      </div>

      <label className="staf-login-toggle">
        <input
          type="checkbox"
          checked={withLogin}
          onChange={(e) => setWithLogin(e.target.checked)}
        />
        <span>Buat akun login (bisa masuk ke dashboard)</span>
      </label>

      {withLogin && (
        <LoginFields
          username={effectiveUsername}
          onUsernameChange={(value) => {
            setUsernameTouched(true)
            setUsername(value)
          }}
          pin={pin}
          onPinChange={setPin}
        />
      )}

      <button type="submit" className="btn-primary payment-form-trigger" disabled={submitting}>
        {submitting ? 'Menyimpan...' : 'Simpan Staf'}
      </button>
    </form>
  )
}

// Gives someone already on the roster a login, keeping their row (and so
// their wash/QC history). Name, phone and role come from the row as it
// stands; only the credentials are new.
function CreateLoginForm({ worker, onCreated, onCancel, onError }) {
  const [username, setUsername] = useState(suggestUsername(worker.full_name))
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')
    if (!isValidUsername(username)) {
      onError('Username minimal 3 karakter, hanya huruf kecil, angka, dan titik')
      return
    }
    if (!/^\d{6}$/.test(pin)) {
      onError('PIN harus 6 digit angka')
      return
    }

    setSubmitting(true)
    try {
      await createWorkerLogin({
        profileId: worker.id,
        fullName: worker.full_name,
        phone: worker.phone,
        role: worker.role,
        username,
        pin,
      })
      onCreated()
    } catch (err) {
      onError(err.message || 'Gagal membuat akun')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="payment-form staf-form" onSubmit={handleSubmit}>
      <div className="payment-form-title">Buat Akun — {worker.full_name}</div>
      <LoginFields
        username={username}
        onUsernameChange={setUsername}
        pin={pin}
        onPinChange={setPin}
      />
      <div className="staf-row-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Membuat...' : 'Buat Akun'}
        </button>
      </div>
    </form>
  )
}

// Shared by both forms so the two never drift apart on validation or wording.
function LoginFields({ username, onUsernameChange, pin, onPinChange }) {
  return (
    <>
      <div className="staf-form-grid">
        <label>
          Username
          <input
            value={username}
            onChange={(e) => onUsernameChange(e.target.value.toLowerCase())}
            placeholder="nama.staf"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
        <label>
          PIN (6 digit)
          <input
            type="password"
            value={pin}
            onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            inputMode="numeric"
            autoComplete="new-password"
          />
        </label>
      </div>
      <p className="staf-section-note">
        Username tidak bisa diubah setelah akun dibuat. Serahkan PIN langsung ke orangnya, dan
        jangan pakai PIN yang sama untuk dua orang.
      </p>
    </>
  )
}

// Role is editable here, but only between staf and supervisor — every row
// reaching this component is one of those two (KelolaStaf filters admins out
// before it renders), and granting admin stays a Supabase-dashboard action so
// one admin can't quietly mint another. Username isn't editable: it's tied to
// the Auth account's email address, which only the server can change.
function EditStaffRow({ worker, onSaved, onCancel, onError }) {
  const [fullName, setFullName] = useState(worker.full_name)
  const [phone, setPhone] = useState(worker.phone || '')
  const [role, setRole] = useState(worker.role)
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    onError('')
    if (!fullName.trim()) {
      onError('Nama wajib diisi')
      return
    }
    setSubmitting(true)
    try {
      await updateWorker(worker.id, { fullName: fullName.trim(), phone: phone.trim() || null, role })
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
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={submitting}
        aria-label="Peran"
      >
        <option value={ROLES.STAFF}>{ROLE_LABELS[ROLES.STAFF]}</option>
        <option value={ROLES.SUPERVISOR}>{ROLE_LABELS[ROLES.SUPERVISOR]}</option>
      </select>
      <span className="staf-username">{worker.username || 'Tanpa akun'}</span>
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
