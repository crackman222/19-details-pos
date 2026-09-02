import { supabase } from '../lib/supabase'
import { extractFunctionErrorMessage } from '../lib/functionError'

// Supabase Auth wants an email, so the username is expanded into the
// internal address the account was created with. It's built from
// profiles.username — a stable handle set once — rather than from full_name,
// so correcting someone's name can't lock them out of their own account.
export function buildLoginEmail(username) {
  return `${username.trim().toLowerCase()}@nineteendetails.internal`
}

// Name-only roster of active people — backed by the active_staff_names view,
// not the profiles table directly, so phone/role/username never reach the
// wash/QC assignment dropdown. No longer anon-readable: the login screen
// takes a typed username now and doesn't list anyone.
export async function getActiveProfiles() {
  const { data, error } = await supabase.from('active_staff_names').select('*').order('full_name')
  if (error) throw error
  return data
}

export async function login(username, pin) {
  const email = buildLoginEmail(username)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin })
  if (error) throw error

  // Deactivated workers keep a valid Auth login until someone changes their
  // password, so "removed" is enforced here rather than by deleting the
  // account — check profiles.is_active and refuse to leave them signed in.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()
  if (profileError) throw profileError
  if (!profile.is_active) {
    await supabase.auth.signOut()
    throw new Error('Akun tidak aktif')
  }

  return profile
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

// Adds someone to the roster without a login — they can be assigned as wash
// or QC staff immediately, and username stays null until an account is
// created for them. This is what adding a field worker used to do, now that
// everyone lives in `profiles` (migration 009).
export async function createWorker({ fullName, phone, role }) {
  const { error } = await supabase.from('profiles').insert({
    full_name: fullName,
    phone: phone || null,
    role,
  })
  if (error) throw error
}

// Creates an actual Auth login via a server-side Edge Function — see
// supabase/functions/create-worker. Can't be done from the client: it needs
// the service role key to create another user's account without hijacking
// the calling admin's own session. Pass profileId to attach the login to
// someone already on the roster instead of adding a new person.
export async function createWorkerLogin({ profileId, fullName, username, phone, role, pin }) {
  const { data, error } = await supabase.functions.invoke('create-worker', {
    body: { profileId, fullName, username, phone, role, pin },
  })
  // The function's own message is the useful one here ("Username sudah
  // dipakai", "PIN harus 6 digit angka"), so unwrap it rather than showing
  // supabase-js's generic non-2xx text.
  if (error) throw new Error(await extractFunctionErrorMessage(error, 'Gagal membuat akun'))
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
