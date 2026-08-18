import { supabase } from '../lib/supabase'

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
      plate_number: plateNumber.toUpperCase().trim(),
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

export async function getTodayTreatments() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('treatments')
    .select('*, payments(payment_method)')
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((t) => ({ ...t, isPaid: t.payments.length > 0 }))
}

// end is exclusive — pass the start of the day/period after the one you want.
export async function getTreatmentsInRange(start, end) {
  const { data, error } = await supabase
    .from('treatments')
    .select('*, payments(payment_method)')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((t) => ({ ...t, isPaid: t.payments.length > 0 }))
}

export async function getActiveQueue() {
  const treatments = await getTodayTreatments()
  return treatments.filter((t) => t.status !== 'closed' && t.status !== 'voided')
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
    .select('*, payments(payment_method)')
    .ilike('plate_number', `%${query.toUpperCase().trim()}%`)
    .order('created_at', { ascending: false })

  if (todayOnly) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    request = request.gte('created_at', startOfDay.toISOString())
  }

  const { data, error } = await request
  if (error) throw error
  return data.map((t) => ({ ...t, isPaid: t.payments.length > 0 }))
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
