import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentProfile } from '../api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      try {
        const current = await getCurrentProfile()
        if (mounted) setProfile(current)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadProfile()

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ profile, loading, setProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
