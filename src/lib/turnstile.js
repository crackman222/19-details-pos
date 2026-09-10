import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

// Everything here is a no-op until VITE_TURNSTILE_SITE_KEY is set (and CAPTCHA
// protection is enabled in the Supabase dashboard with the matching secret
// key) — so any environment without Turnstile configured, like local dev,
// keeps logging in exactly as before.
export const captchaEnabled = Boolean(SITE_KEY)

let scriptPromise = null

function loadScript() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => reject(new Error('Gagal memuat verifikasi keamanan'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

// Mounts an invisible Turnstile widget into `containerRef` and returns a
// getToken() function that runs one challenge and resolves with its one-time
// token. Widget mode 'Managed' (set on the Cloudflare side) plus
// appearance: 'interaction-only' here means Cloudflare's own risk engine
// decides whether that's instant and invisible — the normal case for one
// worker logging in once — or an interactive puzzle, which it only shows for
// traffic that looks repeated/automated. Nothing renders in the container
// unless a challenge is actually needed.
export function useTurnstile(containerRef) {
  const widgetId = useRef(null)
  const pending = useRef(null)

  useEffect(() => {
    if (!captchaEnabled || !containerRef.current) return
    let cancelled = false

    loadScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetId.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          execution: 'execute',
          callback: (token) => pending.current?.resolve(token),
          'error-callback': () => pending.current?.reject(new Error('Verifikasi keamanan gagal, coba lagi')),
        })
      })
      .catch((err) => {
        if (!cancelled) pending.current?.reject(err)
      })

    return () => {
      cancelled = true
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current)
      widgetId.current = null
    }
  }, [containerRef])

  // Resolves to undefined immediately when CAPTCHA isn't configured, so
  // callers can always `await getToken()` and pass the result straight
  // through without branching on captchaEnabled themselves.
  return function getToken({ timeoutMs = 15000 } = {}) {
    if (!captchaEnabled) return Promise.resolve(undefined)
    if (widgetId.current == null) return Promise.reject(new Error('Verifikasi keamanan belum siap, coba lagi'))

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Verifikasi keamanan waktu habis, coba lagi'))
      }, timeoutMs)
      pending.current = {
        resolve: (token) => {
          clearTimeout(timer)
          resolve(token)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        },
      }
      // Each token is single-use — reset before every run so a retry after a
      // failed login gets a fresh challenge instead of reusing a spent one.
      window.turnstile.reset(widgetId.current)
      window.turnstile.execute(widgetId.current)
    })
  }
}
