import { useRef, useState } from 'react'
import { uploadWashProofPhoto } from '../api'
import { CameraCapture } from './CameraCapture'
import { isCameraSupported } from '../lib/camera'

export function WashProofButton({ treatmentId, hasPhoto, onUploaded, onError }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)

  async function upload(file) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await uploadWashProofPhoto(treatmentId, file)
      onUploaded(treatmentId)
    } catch (err) {
      console.error('Upload bukti foto cuci gagal:', err)
      const message = err.message || 'Gagal mengunggah foto'
      setError(message)
      onError?.(message)
    } finally {
      setUploading(false)
    }
  }

  function handleChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    upload(file)
  }

  // Camera first where the browser can give us one; everywhere else (no
  // getUserMedia, or a plain-http origin where it's unavailable) this falls
  // straight through to the file picker, which on a phone still opens the
  // camera app via capture="environment".
  function handleOpen() {
    if (uploading) return
    if (isCameraSupported()) {
      setError('')
      setCameraOpen(true)
      return
    }
    inputRef.current?.click()
  }

  function handleCaptured(file) {
    setCameraOpen(false)
    upload(file)
  }

  function handleFallback() {
    setCameraOpen(false)
    inputRef.current?.click()
  }

  return (
    <>
      <span
        className={`wash-proof-btn ${hasPhoto ? 'has-photo' : ''} ${error ? 'has-error' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleOpen()
        }}
        title={error || (hasPhoto ? 'Ganti bukti foto' : 'Unggah bukti foto')}
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
      {cameraOpen && (
        // Stop clicks inside the sheet from reaching the table row underneath,
        // which navigates to the treatment on click.
        <span onClick={(e) => e.stopPropagation()}>
          <CameraCapture
            onCapture={handleCaptured}
            onClose={() => setCameraOpen(false)}
            onFallback={handleFallback}
          />
        </span>
      )}
    </>
  )
}
