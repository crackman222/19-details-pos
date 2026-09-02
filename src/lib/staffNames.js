// Wash duty is often shared between several field workers, but
// treatments.wash_staff is a single text snapshot (same convention as
// treatments.pic). Multiple names live in that one column comma-separated —
// these two helpers are the only places that layout is assumed, so both the
// UI and the leaderboard tally read it the same way.
export function parseStaffNames(value) {
  if (!value) return []
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

// Returns null rather than an empty string when nobody is assigned — the
// column is nullable and "unassigned" should read as NULL, not ''.
export function formatStaffNames(names) {
  const cleaned = (names ?? []).map((name) => name.trim()).filter(Boolean)
  return cleaned.length ? cleaned.join(', ') : null
}
