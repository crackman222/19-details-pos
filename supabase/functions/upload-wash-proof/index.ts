import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'foto_kendaraan'
const WASH_PROOF_TYPE = 'bukti_cuci'

// ALLOWED_ORIGIN is optional: set it (`supabase secrets set
// ALLOWED_ORIGIN=https://your-app.vercel.app`) to restrict which browser
// origins can read this function's response. Unset, it falls back to '*'
// (today's behavior) — verify_jwt plus the treatment_id/photo_type scoping
// below is the real access control either way, CORS is just defense in
// depth.
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Compresses an uploaded wash-proof photo via Tinify, then stores the
// compressed result in the foto_kendaraan bucket and upserts the matching
// photos row. Runs server-side (not in the browser) because Tinify's API
// has no CORS support — a client-side call would both fail and expose the
// API key to anyone inspecting network requests.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const tinifyApiKey = Deno.env.get('TINIFY_API_KEY')
    if (!tinifyApiKey) {
      return jsonResponse({ error: 'TINIFY_API_KEY belum diatur di secrets project.' }, 500)
    }

    const form = await req.formData()
    const file = form.get('file')
    const treatmentId = form.get('treatmentId')

    if (!(file instanceof File) || !treatmentId) {
      return jsonResponse({ error: 'file dan treatmentId wajib diisi' }, 400)
    }

    const originalBytes = new Uint8Array(await file.arrayBuffer())
    const authHeader = `Basic ${btoa(`api:${tinifyApiKey}`)}`

    const shrinkRes = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: originalBytes,
    })

    if (!shrinkRes.ok) {
      const detail = await shrinkRes.text()
      return jsonResponse({ error: `Kompresi Tinify gagal: ${shrinkRes.status} ${detail}` }, 502)
    }

    const shrinkResult = await shrinkRes.json()
    const outputUrl = shrinkResult.output.url

    const compressedRes = await fetch(outputUrl, {
      headers: { Authorization: authHeader },
    })
    if (!compressedRes.ok) {
      return jsonResponse({ error: `Unduh hasil kompresi gagal: ${compressedRes.status}` }, 502)
    }

    const compressedBytes = new Uint8Array(await compressedRes.arrayBuffer())
    const contentType = shrinkResult.output.type || file.type || 'image/jpeg'
    const path = `${treatmentId}/bukti-cuci`

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, compressedBytes, { upsert: true, contentType })
    if (uploadError) throw uploadError

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('photos')
      .select('id')
      .eq('treatment_id', treatmentId)
      .eq('photo_type', WASH_PROOF_TYPE)
      .maybeSingle()
    if (fetchError) throw fetchError

    if (existing) {
      const { error } = await supabaseAdmin
        .from('photos')
        .update({ image_url: path, uploaded_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('photos')
        .insert({ treatment_id: treatmentId, image_url: path, photo_type: WASH_PROOF_TYPE })
      if (error) throw error
    }

    return jsonResponse({
      path,
      originalSize: shrinkResult.input.size,
      compressedSize: shrinkResult.output.size,
    })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Terjadi kesalahan' }, 500)
  }
})
