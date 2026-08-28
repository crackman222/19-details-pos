// The three office roles, in increasing order of reach. Keep this list in
// sync with the profiles_role_check constraint (migration 008).
//
//   staff      — the people doing the work: Dashboard, Transaksi Baru, Katalog.
//   supervisor — oversees operations: everything staff sees, plus Riwayat and
//                Laporan. This is what 'staff' used to mean before the split.
//   admin      — everything, including Kelola Staf.
export const ROLES = {
  STAFF: 'staff',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  staff: 'Staf',
  supervisor: 'Supervisor',
  admin: 'Admin',
}

// Admin counts as a supervisor everywhere — an admin outranks one, so no
// check ever has to spell out "supervisor or admin" by hand. Mirrors the
// is_supervisor() helper used by RLS.
export function isSupervisor(profile) {
  return profile?.role === ROLES.SUPERVISOR || profile?.role === ROLES.ADMIN
}

export function isAdmin(profile) {
  return profile?.role === ROLES.ADMIN
}
