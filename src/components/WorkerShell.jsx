import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../api'
import { initials } from '../lib/format'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'

// The phone shell for role='staff' — the people on the floor, who work off a
// handset rather than the counter machine. Same routes and same pages as the
// desk shell (AppShell); what changes is the chrome: no sidebar, no
// hamburger, and a thumb-reachable bottom tab bar instead.
//
// Styling follows `design/Worker View Standalone.html` — see the Worker UI
// section of App.css for what was and wasn't taken from it.
//
// Only the two destinations a worker starts from get a tab. Detail Treatment
// and Struk are reached by tapping a ticket, exactly as on the desk shell, so
// they stay out of the nav — see the comment on the routes in App.jsx.
const WORKER_NAV = [
  {
    to: '/',
    label: 'Antrian',
    title: 'Antrian Kerja',
    end: true,
    icon: <path d="M4 6h16M4 12h16M4 18h10" strokeWidth="2" strokeLinecap="round" />,
  },
  {
    to: '/transaksi-baru',
    label: 'Transaksi',
    title: 'Transaksi Baru',
    end: false,
    icon: <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />,
  },
]

// The mockup names the screen in its header. Detail and Struk have no tab, so
// they fall through to a label of their own rather than inheriting 'Antrian'.
function screenTitle(pathname) {
  if (pathname.startsWith('/treatment/')) return 'Detail Transaksi'
  if (pathname.startsWith('/struk/')) return 'Struk'
  const tab = WORKER_NAV.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  return tab ? tab.title : 'Nineteen Details'
}

export function WorkerShell() {
  const { profile, setProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleLogout() {
    await logout()
    setProfile(null)
    navigate('/login', { replace: true })
  }

  return (
    // `worker-ui` is the style namespace for the whole phone treatment: the
    // shared pages underneath are restyled through it rather than forked, so
    // Antrian/Detail/Struk stay single components. See App.css.
    <div className="worker-ui worker-shell">
      <header className="worker-topbar">
        <div className="worker-topbar-left">
          <span className="app-sidebar-brand-mark">ND</span>
          <span className="worker-topbar-title">{screenTitle(pathname)}</span>
        </div>
        <div className="worker-topbar-right">
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
            // The mockup's 44px avatar circle, doing double duty as the logout
            // control — there is no room on a phone header for both, and 44px
            // is already the minimum touch target.
            <button
              type="button"
              className="worker-avatar"
              onClick={handleLogout}
              title={`${profile.full_name} — ketuk untuk keluar`}
              aria-label={`Keluar dari akun ${profile.full_name}`}
            >
              {initials(profile.full_name)}
            </button>
          )}
        </div>
      </header>

      <main className="worker-content">
        <Outlet />
      </main>

      <nav className="worker-tabbar">
        {WORKER_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `worker-tab ${isActive ? 'active' : ''}`}
          >
            <svg
              className="worker-tab-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              {item.icon}
            </svg>
            <span className="worker-tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
