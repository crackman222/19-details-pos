import { useWashProofUpload } from './useWashProofUpload'

export function WashProofButton({ treatmentId, hasPhoto, onUploaded, onError }) {
  const { open, uploading, error, capture } = useWashProofUpload({ treatmentId, onUploaded, onError })

  return (
    <>
      <span
        className={`wash-proof-btn ${hasPhoto ? 'has-photo' : ''} ${error ? 'has-error' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          open()
        }}
        title={error || (hasPhoto ? 'Ganti bukti foto' : 'Unggah bukti foto')}
        role="button"
        aria-label={hasPhoto ? 'Ganti bukti foto cuci' : 'Unggah bukti foto cuci'}
      >
        {uploading ? '…' : hasPhoto ? '✓ Foto' : '📷 Foto'}
      </span>
      {capture}
    </>
  )
}
