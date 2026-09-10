import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'
import { useAuth } from '../context/useAuth'
import { useTurnstile } from '../lib/turnstile'

// Username + PIN, both typed. The old name-picker listed every active person
// before anyone had signed in, which both advertised the roster publicly and
// invited tapping the wrong name; you now have to know your own handle.
export default function Login() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { setProfile } = useAuth()
  const captchaRef = useRef(null)
  const getCaptchaToken = useTurnstile(captchaRef)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('Username wajib diisi')
      return
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN harus 6 digit angka')
      return
    }

    setSubmitting(true)
    try {
      const captchaToken = await getCaptchaToken()
      const profile = await login(username, pin, captchaToken)
      setProfile(profile)
      navigate('/')
    } catch (err) {
      // Deliberately one message for both a wrong username and a wrong PIN —
      // a distinct "user not found" would let anyone probe for valid handles.
      // The deactivated-account case is worth naming, though: that person
      // needs to talk to an admin, not keep retrying. A Turnstile failure is
      // its own thing too — that's not a bad credential, it's the security
      // check itself failing, and lumping it in as "PIN salah" would send a
      // worker into retyping their PIN for no reason.
      setError(
        err.message === 'Akun tidak aktif'
          ? 'Akun tidak aktif — hubungi admin'
          : err.message?.startsWith('Verifikasi keamanan')
            ? err.message
            : 'Username atau PIN salah'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand-mark">ND</div>
        <h1>Nineteen Details</h1>
        <p className="login-subtitle">Point of Sale</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nama.anda"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              disabled={submitting}
            />
          </label>
          <label>
            PIN
            <input
              type="password"
              value={pin}
              // Digits only, max 6 — the PIN doubles as the account password
              // and Supabase Auth's minimum length is 6 characters.
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              inputMode="numeric"
              autoComplete="current-password"
              disabled={submitting}
            />
          </label>

          {/* Invisible unless Cloudflare's risk engine decides this login
              needs an interactive challenge — see src/lib/turnstile.js. */}
          <div ref={captchaRef} className="login-captcha" />

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary login-submit" disabled={submitting}>
            {submitting ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
