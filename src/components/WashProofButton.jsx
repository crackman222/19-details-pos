import { useRef, useState } from 'react'
import { uploadWashProofPhoto } from '../api'

export function WashProofButton({ treatmentId, hasPhoto, onUploaded }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(false)

  async function handleChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setError(false)
    try {
      await uploadWashProofPhoto(treatmentId, file)
      onUploaded(treatmentId)
    } catch {
      setError(true)
    } finally {
      setUploading(false)
    }
  }

  return (
    <span
      className={`wash-proof-btn ${hasPhoto ? 'has-photo' : ''} ${error ? 'has-error' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!uploading) inputRef.current?.click()
      }}
      title={hasPhoto ? 'Ganti bukti foto' : 'Unggah bukti foto'}
      role="button"
      aria-label={hasPhoto ? 'Ganti bukti foto cuci' : 'Unggah bukti foto cuci'}
    >
      {uploading ? '…' : hasPhoto ? '✓ Foto' : '📷 Foto'}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
      />
    </span>
  )
}
