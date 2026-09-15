import { useNavigate } from 'react-router-dom'
import { useWashProofUpload } from './useWashProofUpload'
import { hasRequiredStaff } from '../api'
import { formatDateTime, ticketLabel } from '../lib/format'
import { daysOpen, isOverdue } from '../lib/taskReminder'

// Which chunky button a ticket shows is entirely a function of its status,
// and it mirrors the ladder in DetailTreatment exactly — same three API calls,
// same order, same photo gate on 'diproses'. A worker on the floor shouldn't
// have to open a ticket to advance it; the mockup's whole layout is built
// around that one big button being right there on the card.
const ACTIONS = {
  created: { label: 'Mulai Proses', tone: 'blue', action: 'start' },
  paid: { label: 'Mulai Proses', tone: 'blue', action: 'start' },
  diproses: { label: 'Kirim ke QC', tone: 'green', action: 'qc' },
  qc: { label: 'Tandai Selesai', tone: 'green', action: 'done' },
}

// The left stripe reads the ticket's state before the text does.
const ACCENTS = {
  diproses: 'queue-card-diproses',
  qc: 'queue-card-qc',
}

export function QueueCard({ treatment, statusLabel, hasPhoto, busy, onUploaded, onAdvance }) {
  const navigate = useNavigate()
  const overdue = isOverdue(treatment.created_at)
  const open = () => navigate(`/treatment/${treatment.id}`)

  const step = ACTIONS[treatment.status]
  // sendToQC is refused without a wash photo (DetailTreatment applies the same
  // gate). Rather than a dead button plus a camera somewhere else on the card,
  // the main button *is* the photo step until there is one: it opens the
  // camera, and once the upload lands it turns into Kirim ke QC. Sending stays
  // a separate press, so a blurry shot can be caught before the ticket moves.
  const needsPhoto = step?.action === 'qc' && !hasPhoto
  const proof = useWashProofUpload({ treatmentId: treatment.id, onUploaded })
  // Same idea for finishing: markSelesai refuses a ticket with no wash or QC
  // worker. The pickers live on Detail Transaksi, not the card, so the button
  // takes them there instead of sitting disabled.
  const needsStaff = step?.action === 'done' && !hasRequiredStaff(treatment)

  return (
    <article className={`queue-card ${ACCENTS[treatment.status] || ''} ${overdue ? 'overdue' : ''}`}>
      <div
        className="queue-card-main"
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => e.key === 'Enter' && open()}
      >
        <div className="queue-card-head">
          {/* A plate is a registration mark and reads as one — wide tracking.
              A customer name standing in for it is just a name, so it doesn't
              get the same treatment or it looks like a plate at a glance. */}
          <span className={`queue-card-plate ${treatment.plate_number ? '' : 'queue-card-plate-name'}`}>
            {ticketLabel(treatment)}
          </span>
          <span className={`status-badge status-${treatment.status}`}>{statusLabel}</span>
        </div>

        {/* The code never leads, but it never disappears either: it's what the
            receipt prints and what a supervisor searches on. Shown in full —
            the last four digits alone are only unique within a day, and the
            queue deliberately spans days. */}
        <div className="queue-card-ref">
          <span>{treatment.treatment_code}</span>
          {/* Only when the name isn't already the heading above. */}
          {treatment.plate_number && treatment.customer_name && (
            <span>{treatment.customer_name}</span>
          )}
        </div>

        <p className="queue-card-service">{treatment.serviceSummary || '-'}</p>

        <div className="queue-card-meta">
          {treatment.treatment_type && <span>{treatment.treatment_type}</span>}
          {treatment.pic && <span>{treatment.pic}</span>}
          <span>{formatDateTime(treatment.created_at)}</span>
        </div>

        <div className="queue-card-tags">
          <span className={`status-badge ${treatment.isPaid ? 'status-closed' : 'status-created'}`}>
            {treatment.isPaid ? 'Lunas' : 'Belum Dibayar'}
          </span>
          {overdue && (
            <span className="overdue-badge">⚠️ {daysOpen(treatment.created_at)} hari</span>
          )}
        </div>
      </div>

      <div className="queue-card-actions">
        {needsPhoto ? (
          <button
            type="button"
            className="worker-btn worker-btn-blue"
            onClick={proof.open}
            disabled={busy || proof.uploading}
          >
            {proof.uploading ? 'Mengunggah…' : '📷 Foto Bukti Cuci'}
          </button>
        ) : needsStaff ? (
          <button type="button" className="worker-btn worker-btn-blue" onClick={open} disabled={busy}>
            Pilih Petugas Cuci & QC
          </button>
        ) : step ? (
          <button
            type="button"
            className={`worker-btn worker-btn-${step.tone}`}
            onClick={() => onAdvance(treatment.id, step.action)}
            disabled={busy}
          >
            {step.label}
          </button>
        ) : (
          <span className="worker-btn-static">Siap Diambil</span>
        )}
        <button type="button" className="worker-btn worker-btn-ghost" onClick={open} aria-label="Lihat detail transaksi">
          i
        </button>
        {/* Outside .queue-card-main on purpose: that area navigates on click,
            and a stray navigation mid-capture would drop the photo. */}
        {proof.capture}
      </div>
      {proof.error && <p className="form-error queue-card-proof-error">{proof.error}</p>}
    </article>
  )
}
