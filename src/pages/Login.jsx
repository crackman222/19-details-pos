import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveProfiles, login } from '../api'
import { NamePicker } from '../components/NamePicker'
import { PinPad } from '../components/PinPad'
import { useAuth } from '../context/useAuth'

export default function Login() {
  const [profiles, setProfiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const navigate = useNavigate()
  const { setProfile } = useAuth()

  useEffect(() => {
    getActiveProfiles()
      .then(setProfiles)
      .catch(() => setError('Gagal memuat daftar staf'))
      .finally(() => setLoadingProfiles(false))
  }, [])

  async function handlePinSubmit(pin) {
    if (!selected) return
    setError('')
    try {
      const profile = await login(selected.full_name, pin)
      setProfile(profile)
      navigate('/')
    } catch {
      setError('PIN salah, coba lagi')
    }
  }

  if (loadingProfiles) {
    return <div className="loading-screen">Memuat...</div>
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand-mark">ND</div>
        <h1>Nineteen Details</h1>
        <p className="login-subtitle">Point of Sale</p>
        {!selected ? (
          <>
            <p className="login-instruction">Pilih nama Anda</p>
            {error && <p className="form-error">{error}</p>}
            <NamePicker profiles={profiles} onSelect={setSelected} />
          </>
        ) : (
          <PinPad
            staffName={selected.full_name}
            error={error}
            onSubmit={handlePinSubmit}
            onCancel={() => {
              setSelected(null)
              setError('')
            }}
          />
        )}
      </div>
    </div>
  )
}
