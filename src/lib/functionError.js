// supabase-js only gives a generic "non-2xx status code" message when an
// Edge Function fails — the actual reason (which validation rejected, a
// duplicate username, a missing API key) is in the JSON body of
// error.context, which has to be read separately.
export async function extractFunctionErrorMessage(error, fallback = 'Terjadi kesalahan') {
  try {
    const body = await error.context.json()
    if (body?.error) return body.error
  } catch {
    // error.context wasn't a JSON Response (e.g. network failure) — fall through
  }
  return error.message || fallback
}
