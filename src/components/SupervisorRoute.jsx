import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { isSupervisor } from '../lib/roles'

// Gates a route to supervisor or admin — the operations-oversight pages
// (Riwayat, Laporan) that plain staff don't get. Same caveat as AdminRoute:
// this is navigation, not enforcement. Nothing here hides data that RLS
// doesn't already allow a signed-in staff member to read, so a staff member
// who types the URL sees the redirect, not an error.
export function SupervisorRoute() {
  const { profile, loading } = useAuth()

  if (loading) return <div className="loading-screen">Memuat...</div>
  if (!profile) return <Navigate to="/login" replace />
  if (!isSupervisor(profile)) return <Navigate to="/" replace />

  return <Outlet />
}
