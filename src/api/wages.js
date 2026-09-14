import { supabase } from '../lib/supabase'
import { parseStaffNames } from '../lib/staffNames'
import { getDayRange } from '../lib/dateRange'

// Wage management (supervisor/admin only — see SupervisorRoute and
// src/pages/KelolaUpah.jsx). Two things are stored by hand:
//   - service_wage_rates: a fixed rupiah amount per service (e.g. Cuci Motor
//     -> 7000), never a percentage and never per staff member
//   - wage_adjustments: one-off bonuses/deductions logged against a day,
//     also a flat rupiah amount
// Everything else — how much a worker actually earned on a given day — is
// computed here from treatments + treatment_items, never stored, so it can
// never drift out of sync with the tickets it's based on.

// Roster for the wage page: active staff only, same view StaffPicker uses.
// Not `profiles` directly — a supervisor (unlike an admin) has no RLS
// access to that table, only to this name-only view.
export async function getWageStaffRoster() {
  const { data, error } = await supabase.from('active_staff_names').select('id, full_name').order('full_name')
  if (error) throw error
  return data
}

export async function getServiceWageRates() {
  const { data, error } = await supabase.from('service_wage_rates').select('service_id, wage_amount')
  if (error) throw error
  return data
}

// Upsert: a service with no row yet reads as Rp0 until a supervisor sets one.
export async function setServiceWageRate(serviceId, wageAmount) {
  const { error } = await supabase.from('service_wage_rates').upsert({
    service_id: serviceId,
    wage_amount: wageAmount,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function addWageAdjustment({ profileId, date, type, amount, reason }) {
  const { error } = await supabase.from('wage_adjustments').insert({
    profile_id: profileId,
    adjustment_date: date,
    type,
    amount,
    reason: reason?.trim() || null,
  })
  if (error) throw error
}

// Correcting a mistaken entry means deleting it and adding a new one — see
// the migration note on wage_adjustments (no update policy).
export async function deleteWageAdjustment(id) {
  const { error } = await supabase.from('wage_adjustments').delete().eq('id', id)
  if (error) throw error
}

// service_wage_rates is keyed by service_id (a live FK, so renaming a
// service in the Supabase dashboard doesn't orphan its wage), but
// treatment_items only ever carries a service_name snapshot — same
// convention as staff names below. So the two are joined here, once, into a
// name -> fixed wage map for the day's attribution pass.
async function getServiceWageByName() {
  const [servicesResult, ratesResult] = await Promise.all([
    supabase.from('services').select('id, name'),
    getServiceWageRates(),
  ])
  if (servicesResult.error) throw servicesResult.error

  const wageByServiceId = new Map(ratesResult.map((r) => [r.service_id, Number(r.wage_amount)]))
  return new Map(servicesResult.data.map((s) => [s.name, wageByServiceId.get(s.id) ?? 0]))
}

// What each vehicle's wash staff earned that day: every service line on the
// ticket (never shelf items) pays its own fixed wage times quantity. Keyed
// by staff *name*, the same way getWorkerOrderCounts() tallies wash counts:
// wash_staff is a comma-separated text snapshot, not a live FK, and a
// shared wash credits every name listed in full rather than splitting the
// wage between them.
async function getServiceEarningsByName(date) {
  const { start, end } = getDayRange(date)
  const [wageByName, treatmentsResult] = await Promise.all([
    getServiceWageByName(),
    supabase
      .from('treatments')
      .select('wash_staff, treatment_items(service_name, quantity, shelf_item_id)')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .neq('status', 'voided'),
  ])
  if (treatmentsResult.error) throw treatmentsResult.error

  const earningsByName = new Map()
  for (const t of treatmentsResult.data) {
    const names = parseStaffNames(t.wash_staff)
    if (names.length === 0) continue
    const ticketWage = (t.treatment_items ?? [])
      .filter((item) => item.shelf_item_id == null)
      .reduce((sum, item) => sum + (wageByName.get(item.service_name) ?? 0) * item.quantity, 0)
    if (ticketWage <= 0) continue
    for (const name of names) {
      earningsByName.set(name, (earningsByName.get(name) || 0) + ticketWage)
    }
  }
  return earningsByName
}

// One row per active staff member for the given day: what the fixed-wage
// services they washed add up to, every bonus/deduction logged against
// that day, and the net wage. date is a "YYYY-MM-DD" string.
export async function getDailyWageSummary(date) {
  const [roster, earningsByName, adjustmentsResult] = await Promise.all([
    getWageStaffRoster(),
    getServiceEarningsByName(date),
    supabase.from('wage_adjustments').select('*').eq('adjustment_date', date).order('created_at'),
  ])
  if (adjustmentsResult.error) throw adjustmentsResult.error

  const adjustmentsByProfile = new Map()
  for (const adj of adjustmentsResult.data) {
    if (!adjustmentsByProfile.has(adj.profile_id)) adjustmentsByProfile.set(adj.profile_id, [])
    adjustmentsByProfile.get(adj.profile_id).push(adj)
  }

  return roster.map((worker) => {
    const serviceEarnings = earningsByName.get(worker.full_name) || 0
    const adjustments = adjustmentsByProfile.get(worker.id) || []
    const bonusTotal = adjustments.filter((a) => a.type === 'bonus').reduce((sum, a) => sum + Number(a.amount), 0)
    const deductionTotal = adjustments
      .filter((a) => a.type === 'deduction')
      .reduce((sum, a) => sum + Number(a.amount), 0)

    return {
      profileId: worker.id,
      fullName: worker.full_name,
      serviceEarnings,
      adjustments,
      bonusTotal,
      deductionTotal,
      // Not clamped at zero — if deductions outweigh what was earned, the
      // deficit is real and the page should show it, not hide it.
      netWage: serviceEarnings + bonusTotal - deductionTotal,
    }
  })
}
