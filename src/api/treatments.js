import { supabase } from '../lib/supabase'
import { formatStaffNames, parseStaffNames } from '../lib/staffNames'

function generateTreatmentCode() {
  const now = new Date()
  const y = String(now.getFullYear()).slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `ND${y}${m}${d}-${rand}`
}

async function logAction(treatmentId, action) {
  const { error } = await supabase.from('treatment_logs').insert({ treatment_id: treatmentId, action })
  if (error) throw error
}

async function logStatusChange(treatmentId, status) {
  await logAction(treatmentId, `status changed to ${status}`)
}

// Payment is optional at creation time — a job can be queued and worked on
// before anyone pays. Pass paymentMethod only when the customer is paying
// up front; omit it to leave the treatment at status 'created' with no
// payment row, to be settled later via recordPayment().
export async function createTreatment({
  customerName,
  customerPhone,
  plateNumber,
  treatmentType,
  pic,
  notes,
  items,
  discount = 0,
  paymentMethod,
}) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const total = Math.max(subtotal - discount, 0)

  const { data: treatment, error: treatmentError } = await supabase
    .from('treatments')
    .insert({
      treatment_code: generateTreatmentCode(),
      customer_name: customerName,
      customer_phone: customerPhone,
      // Null for services with no vehicle involved (e.g. Cuci Helm) — the
      // column is nullable as of migration 006.
      plate_number: plateNumber ? plateNumber.toUpperCase().trim() : null,
      treatment_type: treatmentType,
      pic,
      status: 'created',
      notes,
      subtotal,
      discount,
      total,
    })
    .select()
    .single()
  if (treatmentError) throw treatmentError

  await logStatusChange(treatment.id, 'created')

  const { error: itemsError } = await supabase.from('treatment_items').insert(
    items.map((item) => ({
      treatment_id: treatment.id,
      service_name: item.serviceName,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.unitPrice * item.quantity,
    }))
  )
  if (itemsError) throw itemsError

  if (!paymentMethod) {
    return treatment
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    treatment_id: treatment.id,
    amount: total,
    payment_method: paymentMethod,
  })
  if (paymentError) throw paymentError

  const { data: paidTreatment, error: updateError } = await supabase
    .from('treatments')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', treatment.id)
    .select()
    .single()
  if (updateError) throw updateError

  await logStatusChange(treatment.id, 'paid')

  return paidTreatment
}

// Settle payment on a treatment that was queued without paying up front.
// If work hasn't started yet (still 'created'), this also advances status to
// 'paid'. If work is further along (e.g. 'diproses' or 'qc'), the status is
// left alone — payment and work progress are independent once the job is
// moving — and a plain log entry records that payment came in.
export async function recordPayment(treatmentId, { amount, paymentMethod }) {
  const { error: paymentError } = await supabase.from('payments').insert({
    treatment_id: treatmentId,
    amount,
    payment_method: paymentMethod,
  })
  if (paymentError) throw paymentError

  const { data: current, error: fetchError } = await supabase
    .from('treatments')
    .select('status')
    .eq('id', treatmentId)
    .single()
  if (fetchError) throw fetchError

  if (current.status === 'created') {
    const { error: updateError } = await supabase
      .from('treatments')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', treatmentId)
    if (updateError) throw updateError
    await logStatusChange(treatmentId, 'paid')
  } else {
    await logAction(treatmentId, 'payment recorded')
  }
}

// Work pipeline: created/paid -> diproses -> qc -> selesai -> closed.
// Any staff can move a treatment through these three stages; the wash-proof
// photo is required to enter 'qc' (enforced by the caller before invoking
// sendToQC), not to reach 'selesai'.
export async function startProcessing(id) {
  const { error } = await supabase
    .from('treatments')
    .update({ status: 'diproses', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logStatusChange(id, 'diproses')
}

export async function sendToQC(id) {
  const { error } = await supabase
    .from('treatments')
    .update({ status: 'qc', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logStatusChange(id, 'qc')
}

export async function markSelesai(id) {
  const { error } = await supabase
    .from('treatments')
    .update({ status: 'selesai', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logStatusChange(id, 'selesai')
}

// Worker assignment — who's actually washing/QC'ing the vehicle, separate
// from status. Names are plain-text snapshots (same convention as
// treatments.pic), not live FKs.
//
// Wash takes a list: a car is often washed by two or three people. They're
// stored comma-separated in the one wash_staff column — see lib/staffNames.
// Pass an empty array to clear the assignment.
export async function assignWashStaff(id, staffNames) {
  const value = formatStaffNames(staffNames)
  const { error } = await supabase
    .from('treatments')
    .update({ wash_staff: value, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logAction(id, value ? `wash staff assigned: ${value}` : 'wash staff unassigned')
}

export async function assignQcStaff(id, staffName) {
  const { error } = await supabase
    .from('treatments')
    .update({ qc_staff: staffName, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logAction(id, staffName ? `qc staff assigned: ${staffName}` : 'qc staff unassigned')
}

export async function closeTreatment(id) {
  const { error } = await supabase
    .from('treatments')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logStatusChange(id, 'closed')
}

export async function voidTreatment(id) {
  const { error } = await supabase
    .from('treatments')
    .update({ status: 'voided', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logStatusChange(id, 'voided')
}

// The list views (queue, history) all need the same shape: paid-or-not plus a
// readable summary of what was ordered, so they share one select and one
// mapper.
const LIST_SELECT = '*, payments(payment_method), treatment_items(service_name)'

function mapTreatmentRow(t) {
  return {
    ...t,
    isPaid: t.payments.length > 0,
    serviceSummary: (t.treatment_items ?? []).map((item) => item.service_name).join(', '),
  }
}

export async function getTodayTreatments() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('treatments')
    .select(LIST_SELECT)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(mapTreatmentRow)
}

// end is exclusive — pass the start of the day/period after the one you want.
export async function getTreatmentsInRange(start, end) {
  const { data, error } = await supabase
    .from('treatments')
    .select(LIST_SELECT)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(mapTreatmentRow)
}

// The queue is work still to be done: new tickets plus jobs in progress. Once
// a job reaches 'selesai' the work is over, so it drops off the queue the same
// way 'closed' and 'voided' do — it lives on in Riwayat/Laporan.
const QUEUE_STATUSES = ['created', 'paid', 'diproses', 'qc']

export async function getActiveQueue() {
  const treatments = await getTodayTreatments()
  return treatments.filter((t) => QUEUE_STATUSES.includes(t.status))
}

// Revenue is money actually collected, so this reads from payments
// (by paid_at) rather than treatment totals — a queued-but-unpaid treatment
// shouldn't show up as revenue.
export async function getLast7DaysRevenue() {
  const start = new Date()
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('payments')
    .select('paid_at, amount')
    .gte('paid_at', start.toISOString())
  if (error) throw error
  return data
}

export async function getTodayPaymentBreakdown() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('payments')
    .select('payment_method, amount, paid_at')
    .gte('paid_at', startOfDay.toISOString())
  if (error) throw error
  return data
}

// todayOnly restricts results to today's rows — staff can only search within
// today's queue, while admins can search the full transaction history.
export async function searchTreatmentsByPlate(query, { todayOnly = false } = {}) {
  let request = supabase
    .from('treatments')
    .select(LIST_SELECT)
    .ilike('plate_number', `%${query.toUpperCase().trim()}%`)
    .order('created_at', { ascending: false })

  if (todayOnly) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    request = request.gte('created_at', startOfDay.toISOString())
  }

  const { data, error } = await request
  if (error) throw error
  return data.map(mapTreatmentRow)
}

// Ranks field workers by orders handled in a period, split into wash vs QC
// duty. Computed from treatments.wash_staff/qc_staff rather than a stored
// counter — those columns are already the source of truth (see schema
// notes on the treatments table), so a separate tally would just be a copy
// that can drift out of sync. Voided treatments don't count as handled work.
export async function getWorkerOrderCounts(start, end) {
  const { data, error } = await supabase
    .from('treatments')
    .select('wash_staff, qc_staff, status')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .neq('status', 'voided')
  if (error) throw error

  const counts = new Map()
  // A wash shared by several workers credits each of them one order — the
  // column holds every assigned name, so parse before tallying.
  function bump(value, field) {
    for (const name of parseStaffNames(value)) {
      if (!counts.has(name)) counts.set(name, { name, washCount: 0, qcCount: 0 })
      counts.get(name)[field] += 1
    }
  }
  for (const t of data) {
    bump(t.wash_staff, 'washCount')
    bump(t.qc_staff, 'qcCount')
  }

  return Array.from(counts.values())
    .map((w) => ({ ...w, total: w.washCount + w.qcCount }))
    .sort((a, b) => b.total - a.total)
}

export async function getTreatmentDetail(id) {
  const [treatmentResult, itemsResult, paymentsResult] = await Promise.all([
    supabase.from('treatments').select('*').eq('id', id).single(),
    supabase.from('treatment_items').select('*').eq('treatment_id', id).order('id'),
    supabase.from('payments').select('*').eq('treatment_id', id).order('paid_at', { ascending: false }),
  ])

  if (treatmentResult.error) throw treatmentResult.error
  if (itemsResult.error) throw itemsResult.error
  if (paymentsResult.error) throw paymentsResult.error

  return {
    ...treatmentResult.data,
    items: itemsResult.data ?? [],
    payment: paymentsResult.data?.[0] ?? null,
  }
}
