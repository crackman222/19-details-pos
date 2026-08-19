export function formatRupiah(amount) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
