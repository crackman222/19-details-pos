// Indonesian plate format: a 1-2 letter regional code, 1-4 digits, then an
// optional 1-3 letter suffix (e.g. "B 1234 XYZ" — B is Jakarta). Checking
// the region code against the real table of codes Korlantas actually issues
// is what catches a made-up plate ("ZZ 0000 XX" isn't a real region) rather
// than just a typo.
//
// This is a sanity check, not the authoritative Korlantas registry — if a
// legitimate code is missing (a new region split, a code we don't serve
// customers from yet), add it below rather than turning the check off.
const PLATE_REGIONS = new Map([
  // Sumatera
  ['BL', 'Aceh'],
  ['BB', 'Sumatera Utara (Tapanuli)'],
  ['BK', 'Sumatera Utara (Medan)'],
  ['BA', 'Sumatera Barat'],
  ['BM', 'Riau'],
  ['BP', 'Kepulauan Riau'],
  ['BG', 'Sumatera Selatan'],
  ['BN', 'Bangka Belitung'],
  ['BE', 'Lampung'],
  ['BD', 'Bengkulu'],
  ['BH', 'Jambi'],
  // Jakarta, Jawa
  ['A', 'Banten'],
  ['B', 'Jakarta'],
  ['D', 'Bandung'],
  ['E', 'Cirebon'],
  ['F', 'Bogor/Sukabumi/Cianjur'],
  ['T', 'Purwakarta/Karawang/Subang'],
  ['Z', 'Garut/Tasikmalaya/Sumedang'],
  ['G', 'Pekalongan/Tegal/Brebes'],
  ['H', 'Semarang/Salatiga/Kendal'],
  ['K', 'Pati/Kudus/Jepara'],
  ['R', 'Banyumas/Cilacap'],
  ['AA', 'Magelang/Kebumen/Wonosobo'],
  ['AD', 'Surakarta/Solo'],
  ['AB', 'Yogyakarta'],
  ['L', 'Surabaya'],
  ['M', 'Madura'],
  ['N', 'Malang/Pasuruan/Probolinggo'],
  ['P', 'Besuki (Jember/Banyuwangi)'],
  ['S', 'Bojonegoro/Tuban/Lamongan'],
  ['W', 'Sidoarjo/Gresik'],
  ['AE', 'Madiun/Ngawi/Ponorogo'],
  ['AG', 'Kediri/Blitar/Tulungagung'],
  // Bali, Nusa Tenggara
  ['DK', 'Bali'],
  ['DR', 'Nusa Tenggara Barat (Lombok)'],
  ['EA', 'Nusa Tenggara Barat (Sumbawa)'],
  ['DH', 'Nusa Tenggara Timur (Timor)'],
  ['EB', 'Nusa Tenggara Timur (Flores)'],
  ['ED', 'Nusa Tenggara Timur (Sumba)'],
  // Kalimantan
  ['DA', 'Kalimantan Selatan'],
  ['KH', 'Kalimantan Tengah'],
  ['KT', 'Kalimantan Timur'],
  ['KU', 'Kalimantan Utara'],
  ['KB', 'Kalimantan Barat'],
  // Sulawesi
  ['DD', 'Sulawesi Selatan'],
  ['DC', 'Sulawesi Barat'],
  ['DN', 'Sulawesi Tengah'],
  ['DT', 'Sulawesi Tenggara'],
  ['DB', 'Sulawesi Utara (Manado)'],
  ['DL', 'Sulawesi Utara (Sangihe Talaud)'],
  ['DM', 'Gorontalo'],
  // Maluku, Papua
  ['DE', 'Maluku'],
  ['DG', 'Maluku Utara'],
  ['PA', 'Papua'],
  ['PB', 'Papua Barat'],
])

// 1-2 letters, then digits, then an optional 1-3 letter suffix. Spacing
// between the three parts is optional so "B1234XYZ" (typed without spaces)
// still matches — only the letter/digit shape is enforced here, the region
// code is checked separately against PLATE_REGIONS.
const PLATE_SHAPE = /^([A-Z]{1,2})\s?(\d{1,4})\s?([A-Z]{0,3})$/

// Parses and checks a plate in one pass. Returns:
//   { empty: true }                                  — nothing typed
//   { valid: false, reason: 'format' }                — doesn't look like a plate at all
//   { valid: false, reason: 'region', code }          — right shape, unknown region code
//   { valid: true, code, region, number, suffix }     — passes both checks
export function describePlateNumber(value) {
  const normalized = (value ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  if (!normalized) return { empty: true, valid: false }

  const match = normalized.match(PLATE_SHAPE)
  if (!match) return { empty: false, valid: false, reason: 'format' }

  const [, code, number, suffix] = match
  const region = PLATE_REGIONS.get(code)
  if (!region) return { empty: false, valid: false, reason: 'region', code }

  return { empty: false, valid: true, code, region, number, suffix }
}

export function isValidPlateNumber(value) {
  return describePlateNumber(value).valid
}

// Indonesian message for whatever's wrong, or '' when the plate is fine —
// TransaksiBaru shows this directly as the submit-blocking form error.
export function plateNumberError(value) {
  const info = describePlateNumber(value)
  if (info.valid) return ''
  if (info.empty) return 'Nomor plat wajib diisi'
  if (info.reason === 'region') {
    return `Kode wilayah "${info.code}" tidak dikenali — periksa kembali nomor plat`
  }
  return 'Format nomor plat tidak valid — contoh: B 1234 XYZ'
}
