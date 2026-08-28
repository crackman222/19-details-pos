// Creates a new staff login: a Supabase Auth user (fake email + PIN as
// password, same convention as every other account in this app) plus its
// `profiles` row, in one call.
//
// This MUST run server-side with the service role key. The browser only
// ever holds the anon key, and a client-side supabase.auth.signUp() call
// would replace the calling admin's own session with the new user's — there
// is no safe client-only way to create another user's login.
//
// Only a caller whose own profile has role = 'admin' may use this; every
// other caller gets 401/403 before any Auth/DB write happens.
//
// Deploy: paste this file into Supabase dashboard -> Edge Functions ->
// New Function (name: create-worker), or `supabase functions deploy
// create-worker` from the CLI. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are provided automatically by the platform — no extra secret needed.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Must match buildLoginEmail() in src/api/auth.js — the login screen expands
// the typed username the same way, so the account is only reachable if the
// two agree.
function buildLoginEmail(username) {
  return `${username.trim().toLowerCase()}@nineteendetails.internal`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const callerToken = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: callerUser, error: callerError } = await admin.auth.getUser(callerToken)
  if (callerError || !callerUser?.user) {
    return json({ error: 'Tidak terautentikasi.' }, 401)
  }

  const { data: callerProfile, error: callerProfileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerUser.user.id)
    .single()
  if (callerProfileError || callerProfile?.role !== 'admin') {
    return json({ error: 'Hanya admin yang dapat menambah pekerja.' }, 403)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request tidak valid.' }, 400)
  }

  // profileId is optional: pass it to give an existing login-less profile
  // (anyone migrated in from field_workers) an account, keeping their id and
  // therefore their history. Omit it to create a brand-new person.
  const { fullName, username, phone, role, pin, profileId } = body ?? {}
  if (!fullName || !fullName.trim()) return json({ error: 'Nama wajib diisi.' }, 400)
  if (!/^[a-z0-9.]{3,}$/.test((username ?? '').trim().toLowerCase())) {
    return json({ error: 'Username minimal 3 karakter, hanya huruf kecil, angka, dan titik.' }, 400)
  }
  if (!/^\d{6}$/.test(pin ?? '')) return json({ error: 'PIN harus 6 digit angka.' }, 400)
  // Keep in step with the profiles_role_check constraint (migration 008).
  if (!['staff', 'supervisor', 'admin'].includes(role)) {
    return json({ error: 'Role tidak valid.' }, 400)
  }

  const handle = username.trim().toLowerCase()
  const email = buildLoginEmail(handle)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
  })
  if (createError) {
    // The email is derived from the username, so "already registered" only
    // ever means the handle is taken — say that instead of leaking the
    // internal address back to the UI.
    const taken = /already (been )?registered|already exists/i.test(createError.message)
    return json({ error: taken ? 'Username sudah dipakai.' : createError.message }, 400)
  }

  const fields = {
    full_name: fullName.trim(),
    username: handle,
    phone: phone?.trim() || null,
    role,
    is_active: true,
  }
  // Attaching a login to an existing row has to move that row's id onto the
  // new auth uid: getCurrentProfile()/login() resolve the profile by
  // session.user.id, so a mismatch would sign the person in and then fail to
  // find them. Nothing foreign-keys profiles.id (wash_staff/qc_staff/pic are
  // text snapshots), so the id is safe to rewrite.
  const { error: writeError } = profileId
    ? await admin.from('profiles').update({ id: created.user.id, ...fields }).eq('id', profileId)
    : await admin.from('profiles').insert({ id: created.user.id, ...fields })
  if (writeError) {
    // Don't leave an orphaned login with no profile behind on failure.
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: writeError.message }, 400)
  }

  return json({ id: created.user.id, full_name: fullName.trim() })
})
