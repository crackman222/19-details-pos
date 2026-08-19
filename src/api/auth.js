import { supabase } from '../lib/supabase'

export function buildFakeEmail(fullName) {
  return `${fullName.trim().toLowerCase().replace(/\s+/g, '.')}@nineteendetails.internal`
}

// Name-only roster of active staff — backed by the active_staff_names view,
// not the profiles table directly, so phone/role never reach the login
// picker (anon, pre-auth) or the wash/QC assignment dropdown (any staff).
export async function getActiveProfiles() {
  const { data, error } = await supabase.from('active_staff_names').select('*').order('full_name')
  if (error) throw error
  return data
}

export async function login(fullName, pin) {
  const email = buildFakeEmail(fullName)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin })
  if (error) throw error

  // Deactivated workers keep a valid Auth login until someone changes their
  // password, so "removed" is enforced here rather than by deleting the
  // account — check profiles.is_active and refuse to leave them signed in.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', data.user.id)
    .single()
  if (profileError) throw profileError
  if (!profile.is_active) {
    await supabase.auth.signOut()
    throw new Error('Akun tidak aktif')
  }

  return data
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (error) throw error
  return data
}

// --- Worker management — RLS restricts all of these to role = 'admin' ---

export async function getAllWorkers() {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name')
  if (error) throw error
  return data
}

// Creates both the Auth login and the profiles row via a server-side Edge
// Function — see supabase/functions/create-worker. Can't be done directly
// from the client: it needs the service role key to create another user's
// account without hijacking the calling admin's own session.
export async function createWorker({ fullName, phone, role, pin }) {
  const { data, error } = await supabase.functions.invoke('create-worker', {
    body: { fullName, phone, role, pin },
  })
  if (error) throw error
  return data
}

export async function updateWorker(id, { fullName, phone, role }) {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone, role })
    .eq('id', id)
  if (error) throw error
}

// "Remove" a worker without deleting their account or history — see login()
// for how this actually blocks them from signing in.
export async function setWorkerActive(id, isActive) {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
