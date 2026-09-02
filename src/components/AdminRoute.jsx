import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { isAdmin } from '../lib/roles'

// Gates a route to role 'admin'. Client-side only — the real enforcement is
// the RLS policies on `profiles` (see migration notes in CLAUDE.md), this
// just keeps non-admins from seeing the page/nav item.
export function AdminRoute() {
  const { profile, loading } = useAuth()

  if (loading) return <div className="loading-screen">Memuat...</div>
  if (!profile) return <Navigate to="/login" replace />
  if (!isAdmin(profile)) return <Navigate to="/" replace />

  return <Outlet />
}
