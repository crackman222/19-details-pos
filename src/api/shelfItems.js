import { supabase } from '../lib/supabase'

// Shelf items are goods sold alongside services, and unlike a service they
// run out: `stock` is drawn down by a database trigger when a ticket line
// referencing the item is inserted (migration 010). Nothing here decrements
// it by hand — the client is never the source of truth for stock.

// Everything on the shelf, including out-of-stock and deactivated rows —
// the catalogue shows those, the ticket form filters them out.
export async function getShelfItems() {
  const { data, error } = await supabase.from('shelf_items').select('*').order('name')
  if (error) throw error
  return data
}

// What can actually be sold right now.
export async function getAvailableShelfItems() {
  const { data, error } = await supabase
    .from('shelf_items')
    .select('*')
    .eq('is_active', true)
    .gt('stock', 0)
    .order('name')
  if (error) throw error
  return data
}

// --- Supervisor-only (enforced by RLS + the RPC's own check) ---

export async function createShelfItem({ name, price, stock }) {
  const { error } = await supabase.from('shelf_items').insert({ name, price, stock })
  if (error) throw error
}

// Increments rather than writing a computed total, so two supervisors
// restocking at the same time can't overwrite each other. A negative amount
// is a correction; the function refuses to take stock below zero.
export async function addShelfStock(itemId, amount) {
  const { data, error } = await supabase.rpc('add_shelf_stock', {
    item_id: itemId,
    amount,
  })
  if (error) throw new Error(error.message || 'Gagal mengubah stok')
  return data
}

export async function setShelfItemActive(id, isActive) {
  const { error } = await supabase.from('shelf_items').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
