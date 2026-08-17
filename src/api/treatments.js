import { supabase } from '../lib/supabase'

function generateTreatmentCode() {
  const now = new Date()
  const y = String(now.getFullYear()).slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `ND${y}${m}${d}-${rand}`
}

async function logStatusChange(treatmentId, status) {
  const { error } = await supabase
    .from('treatment_logs')
    .insert({ treatment_id: treatmentId, action: `status changed to ${status}` })
  if (error) throw error
}

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

export async function completeTreatment(id) {
  const { error } = await supabase
    .from('treatments')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logStatusChange(id, 'completed')
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
    .select('*')
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function searchTreatmentsByPlate(query) {
  const { data, error } = await supabase
    .from('treatments')
    .select('*')
    .ilike('plate_number', `%${query.toUpperCase().trim()}%`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
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
