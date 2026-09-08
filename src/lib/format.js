export function formatRupiah(amount) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// How a ticket is named to someone holding a phone in the shop, trying to
// match a row on screen to the thing in front of them.
//
// A vehicle wears its plate, so that's the match. A ticket with no vehicle
// (Cuci Helm — services carry requires_vehicle, see migration 006) has a null
// plate, and the treatment code is no help either: it lives in the database
// and on the receipt, never on the helmet. What identifies that job is whose
// it is. customer_name has been NOT NULL since migration 007, so the code is
// only ever reached as a guard.
export function ticketLabel(treatment) {
  return treatment.plate_number || treatment.customer_name || treatment.treatment_code
}

export function initials(fullName) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
