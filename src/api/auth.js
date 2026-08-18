import { supabase } from '../lib/supabase'

export function buildFakeEmail(fullName) {
  return `${fullName.trim().toLowerCase().replace(/\s+/g, '.')}@nineteendetails.internal`
}

export async function getActiveProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name')
  if (error) throw error
  return data
}

export async function login(fullName, pin) {
  const email = buildFakeEmail(fullName)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin })
  if (error) throw error
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
