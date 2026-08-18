import { supabase } from '../lib/supabase'

export async function getActiveServices() {
  const { data, error } = await supabase.from('services').select('*').order('name')
  if (error) throw error
  return data
}
