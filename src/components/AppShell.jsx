import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '../api'
import { initials } from '../lib/format'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'
import { isAdmin, isStaff, isSupervisor, ROLE_LABELS } from '../lib/roles'
import { WorkerShell } from './WorkerShell'

// `access` mirrors the route guards in App.jsx — keep the two in step, since
// this only decides what's shown and the guards decide what's reachable.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, access: 'all' },
  { to: '/transaksi-baru', label: 'Transaksi Baru', end: false, access: 'all' },
  { to: '/katalog', label: 'Katalog Layanan', end: false, access: 'supervisor' },
  { to: '/riwayat', label: 'Riwayat Transaksi', end: false, access: 'supervisor' },
  { to: '/laporan', label: 'Laporan', end: false, access: 'supervisor' },
  { to: '/upah', label: 'Kelola Upah', end: false, access: 'supervisor' },
  { to: '/staf', label: 'Kelola Staf', end: false, access: 'admin' },
]

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
  const [navOpen, setNavOpen] = useState(false)

  // Workers are on a phone, so they get a different shell entirely — bottom
  // tabs instead of a sidebar. Same routes underneath: this swaps the chrome
  // around <Outlet/>, it is not a second route table. Placed after the hooks
  // above so the hook order stays identical either way.
  if (isStaff(profile)) return <WorkerShell />

  function canSee(item) {
    if (item.access === 'admin') return isAdmin(profile)
    if (item.access === 'supervisor') return isSupervisor(profile)
    return true
  }

  async function handleLogout() {
    await logout()
    setProfile(null)
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      {navOpen && (
        <div className="app-sidebar-backdrop" onClick={() => setNavOpen(false)} />
      )}
      <aside className={`app-sidebar ${navOpen ? 'open' : ''}`}>
        <div className="app-sidebar-brand">
          <span className="app-sidebar-brand-mark">ND</span>
          <span className="app-sidebar-brand-name">Nineteen Details</span>
        </div>
        <nav className="app-sidebar-nav">
          {NAV_ITEMS.filter(canSee).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
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
          <div className="app-header-left">
            <button
              type="button"
              className="app-hamburger"
              onClick={() => setNavOpen((open) => !open)}
              aria-label={navOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={navOpen}
            >
              <span />
            </button>
            <span className="app-header-date">{todayLabel()}</span>
          </div>
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
                <span className="app-header-role">{ROLE_LABELS[profile.role] || profile.role}</span>
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
