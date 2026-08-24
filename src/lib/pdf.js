import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah, formatDateTime } from './format'

const STATUS_LABELS = {
  created: 'Dibuat',
  paid: 'Dibayar',
  diproses: 'Diproses',
  qc: 'QC',
  selesai: 'Selesai',
  closed: 'Ditutup',
  voided: 'Dibatalkan',
}

export function exportTreatmentsToPdf(treatments, periodLabel) {
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text('Nineteen Details', 14, 18)
  doc.setFontSize(11)
  doc.text('Riwayat Transaksi', 14, 26)
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(periodLabel, 14, 32)
  doc.text(`Dibuat: ${formatDateTime(new Date())}`, 14, 37)

  const paid = treatments.filter((t) => t.status !== 'voided' && t.isPaid)
  const revenue = paid.reduce((sum, t) => sum + Number(t.total || 0), 0)

  doc.setTextColor(0)
  doc.setFontSize(10)
  doc.text(`Total Transaksi: ${treatments.length}`, 14, 46)
  doc.text(`Total Pendapatan: ${formatRupiah(revenue)}`, 14, 51)

  autoTable(doc, {
    startY: 58,
    head: [['Plat', 'Kendaraan', 'Tanggal', 'Status', 'Bayar', 'Total']],
    body: treatments.map((t) => [
      t.plate_number || '-',
      t.treatment_type || '-',
      formatDateTime(t.created_at),
      STATUS_LABELS[t.status] || t.status,
      t.isPaid ? 'Lunas' : 'Belum',
      formatRupiah(t.total),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [44, 106, 158] },
  })

  const fileSafeLabel = periodLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  doc.save(`riwayat-transaksi-${fileSafeLabel}.pdf`)
}
