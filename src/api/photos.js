import { supabase } from '../lib/supabase'

const BUCKET = 'foto_kendaraan'
const WASH_PROOF_TYPE = 'bukti_cuci'

// One wash-proof photo per treatment — re-uploading overwrites the same
// storage path and the same photos row, rather than accumulating rows.
// Compression happens server-side (Edge Function `upload-wash-proof`) via
// Tinify — Tinify's API has no CORS support, so it can't be called directly
// from the browser without exposing the API key.
export async function uploadWashProofPhoto(treatmentId, file) {
  const form = new FormData()
  form.append('file', file)
  form.append('treatmentId', String(treatmentId))

  const { data, error } = await supabase.functions.invoke('upload-wash-proof', { body: form })
  if (error) throw error
  return data.path
}

export async function getWashProofPhoto(treatmentId) {
  const { data, error } = await supabase
    .from('photos')
    .select('image_url')
    .eq('treatment_id', treatmentId)
    .eq('photo_type', WASH_PROOF_TYPE)
    .maybeSingle()
  if (error) throw error
  return data?.image_url ?? null
}

// Maps treatment_id -> storage path, for showing an "attached" badge across a list.
export async function getWashProofMap(treatmentIds) {
  if (treatmentIds.length === 0) return {}
  const { data, error } = await supabase
    .from('photos')
    .select('treatment_id, image_url')
    .eq('photo_type', WASH_PROOF_TYPE)
    .in('treatment_id', treatmentIds)
  if (error) throw error

  const map = {}
  for (const row of data) map[row.treatment_id] = row.image_url
  return map
}

export async function getWashProofSignedUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
