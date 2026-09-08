import { useNavigate } from 'react-router-dom'
import { WashProofButton } from './WashProofButton'
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
  // gate). Blocking the button and saying why beats letting them press it and
  // reading a failure.
  const photoBlocked = step?.action === 'qc' && !hasPhoto

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
        {step ? (
          /* A blocked step gets the neutral treatment, not the green one — a
             disabled green button still reads as "the action is here", when
             the thing to do next is the camera in the strip below. */
          <button
            type="button"
            className={`worker-btn ${photoBlocked ? 'worker-btn-blocked' : `worker-btn-${step.tone}`}`}
            onClick={() => onAdvance(treatment.id, step.action)}
            disabled={busy || photoBlocked}
            title={photoBlocked ? 'Unggah bukti foto cuci terlebih dahulu' : undefined}
          >
            {photoBlocked ? 'Perlu Bukti Foto' : step.label}
          </button>
        ) : (
          <span className="worker-btn-static">Siap Diambil</span>
        )}
        <button type="button" className="worker-btn worker-btn-ghost" onClick={open} aria-label="Lihat detail transaksi">
          i
        </button>
      </div>

      {/* Its own strip, outside .queue-card-main: WashProofButton wraps a file
          input, and a stray navigation mid-capture would drop the photo. */}
      <div className="queue-card-proof">
        <span className="queue-card-proof-label">Bukti Foto Cuci</span>
        <WashProofButton
          treatmentId={treatment.id}
          hasPhoto={hasPhoto}
          onUploaded={onUploaded}
        />
      </div>
    </article>
  )
}
