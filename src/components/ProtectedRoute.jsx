import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export function ProtectedRoute() {
  const { profile, loading } = useAuth()

  if (loading) return <div className="loading-screen">Memuat...</div>
  if (!profile) return <Navigate to="/login" replace />

  return <Outlet />
}
