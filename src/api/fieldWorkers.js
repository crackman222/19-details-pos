import { supabase } from '../lib/supabase'

// Field workers (pekerja lapangan) never get a dashboard login — no Auth
// account, no PIN, no email — they're just a name/phone roster for
// assigning who washed/QC'd a vehicle. Kept in their own table rather than
// `profiles` specifically because profiles.id is FK'd to auth.users; a
// field worker has no such account to link to.

// Name-only roster of active field workers — backed by the
// active_field_workers view, readable by any signed-in staff (they need to
// pick who did the work). Phone numbers and inactive workers stay
// admin-only, via getAllFieldWorkers below.
export async function getActiveFieldWorkers() {
  const { data, error } = await supabase.from('active_field_workers').select('*').order('full_name')
  if (error) throw error
  return data
}

// --- Admin-only management — RLS restricts these to role = 'admin' ---

export async function getAllFieldWorkers() {
  const { data, error } = await supabase.from('field_workers').select('*').order('full_name')
  if (error) throw error
  return data
}

export async function createFieldWorker({ fullName, phone }) {
  const { error } = await supabase.from('field_workers').insert({
    full_name: fullName,
    phone: phone || null,
  })
  if (error) throw error
}

export async function updateFieldWorker(id, { fullName, phone }) {
  const { error } = await supabase
    .from('field_workers')
    .update({ full_name: fullName, phone })
    .eq('id', id)
  if (error) throw error
}

export async function setFieldWorkerActive(id, isActive) {
  const { error } = await supabase.from('field_workers').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
