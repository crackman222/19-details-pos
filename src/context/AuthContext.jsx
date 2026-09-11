import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentProfile } from '../api'
import { AuthContext } from './auth-context'

// How long a signed-in tab can go with no interaction (or spend backgrounded)
// before the session is force-logged-out. This is a shared POS device, not a
// personal one — a tab left open at the counter, or open in the background
// for a while, shouldn't stay signed in indefinitely. Session storage key so
// Login.jsx can tell "logged out from idle" apart from a normal logout.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const IDLE_LOGOUT_FLAG = 'nd_idle_logout'

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const idleTimerRef = useRef(null)
  const hiddenAtRef = useRef(null)

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

  // Idle/away auto-logout. Only runs while someone is actually signed in —
  // there's nothing to protect on the login screen itself.
  useEffect(() => {
    if (!profile) return

    function forceLogout() {
      sessionStorage.setItem(IDLE_LOGOUT_FLAG, '1')
      supabase.auth.signOut()
    }

    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(forceLogout, IDLE_TIMEOUT_MS)
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        // Most browsers throttle/pause timers in a backgrounded tab, so the
        // in-tab timer above can't be trusted while hidden — track wall-clock
        // time instead and check it back on return.
        hiddenAtRef.current = Date.now()
        return
      }
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= IDLE_TIMEOUT_MS) {
        forceLogout()
        return
      }
      resetIdleTimer()
    }

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach((event) => window.addEventListener(event, resetIdleTimer))
    document.addEventListener('visibilitychange', handleVisibilityChange)

    resetIdleTimer()

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      activityEvents.forEach((event) => window.removeEventListener(event, resetIdleTimer))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [profile])

  return (
    <AuthContext.Provider value={{ profile, loading, setProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
