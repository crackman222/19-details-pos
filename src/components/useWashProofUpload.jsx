import { useRef, useState } from 'react'
import { uploadWashProofPhoto } from '../api'
import { CameraCapture } from './CameraCapture'
import { isCameraSupported } from '../lib/camera'

// The capture-and-upload half of the wash proof, with no opinion about what
// the control looks like. Two very different controls need it: the small
// `WashProofButton` chip (desk table, Detail Treatment) and the worker queue
// card's one chunky button, which is the photo step and the status step at
// once. Only the trigger differs, so only the trigger is duplicated.
//
// Returns the handler plus `capture`, the elements the caller has to render
// somewhere in its own tree: the hidden file input and the camera sheet.
export function useWashProofUpload({ treatmentId, onUploaded, onError }) {
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
      onUploaded?.(treatmentId)
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
  function open() {
    if (uploading) return
    if (isCameraSupported()) {
      setError('')
      setCameraOpen(true)
      return
    }
    inputRef.current?.click()
  }

  const capture = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="wash-proof-input"
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
      />
      {cameraOpen && (
        // Stop clicks inside the sheet from reaching whatever sits underneath
        // — both the desk table row and the queue card navigate on click.
        <span onClick={(e) => e.stopPropagation()}>
          <CameraCapture
            onCapture={(file) => {
              setCameraOpen(false)
              upload(file)
            }}
            onClose={() => setCameraOpen(false)}
            onFallback={() => {
              setCameraOpen(false)
              inputRef.current?.click()
            }}
          />
        </span>
      )}
    </>
  )

  return { open, uploading, error, capture }
}
