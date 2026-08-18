import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '../api'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'

const NAV_ITEMS = [
  { to: '/', label: 'Antrian Hari Ini', end: true },
  { to: '/transaksi-baru', label: 'Transaksi Baru', end: false },
  { to: '/katalog', label: 'Katalog Layanan', end: false },
  { to: '/riwayat', label: 'Riwayat Transaksi', end: false },
  { to: '/laporan', label: 'Laporan', end: false },
]

function initials(fullName) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function todayLabel() {
  const label = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function AppShell() {
  const { profile, setProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    setProfile(null)
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span className="app-sidebar-brand-mark">ND</span>
          <span className="app-sidebar-brand-name">Nineteen Details</span>
        </div>
        <nav className="app-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `app-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="app-sidebar-link-dot" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <span className="app-header-date">{todayLabel()}</span>
          <div className="app-header-right">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {profile && (
              <div className="app-header-user">
                <span className="app-header-avatar">{initials(profile.full_name)}</span>
                <span className="app-header-name">{profile.full_name}</span>
                <button type="button" className="app-header-logout" onClick={handleLogout}>
                  Keluar
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
