import { useEffect, useRef, useState } from 'react'
import { startCameraStream, stopCameraStream, captureFrame, describeCameraError } from '../lib/camera'

// Full-screen camera sheet: live preview -> shutter -> review the shot ->
// either keep it (onCapture receives a File) or retake. Cancelling or any
// camera failure closes back out through onClose/onFallback, so the caller can
// offer the plain file picker instead.
export function CameraCapture({ onCapture, onClose, onFallback }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  // { file, url } — the object URL is created alongside the file and revoked
  // whenever it's replaced or the sheet goes away, so retaking repeatedly
  // doesn't leak one URL per shot.
  const [shot, setShot] = useState(null)
  const shotUrlRef = useRef('')
  const [busy, setBusy] = useState(false)

  function replaceShot(file) {
    if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current)
    shotUrlRef.current = file ? URL.createObjectURL(file) : ''
    setShot(file ? { file, url: shotUrlRef.current } : null)
  }

  useEffect(() => {
    let cancelled = false

    startCameraStream()
      .then((stream) => {
        // The sheet can be closed before the permission prompt resolves —
        // without this the stream stays live and the camera light stays on.
        if (cancelled) {
          stopCameraStream(stream)
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setReady(true)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Gagal membuka kamera:', err)
        setError(describeCameraError(err))
      })

    return () => {
      cancelled = true
      stopCameraStream(streamRef.current)
      streamRef.current = null
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current)
      shotUrlRef.current = ''
    }
  }, [])

  async function handleShutter() {
    setBusy(true)
    setError('')
    try {
      replaceShot(await captureFrame(videoRef.current))
    } catch (err) {
      setError(err.message || 'Gagal mengambil foto')
    } finally {
      setBusy(false)
    }
  }

  function handleUse() {
    stopCameraStream(streamRef.current)
    streamRef.current = null
    onCapture(shot.file)
  }

  return (
    <div className="camera-sheet" role="dialog" aria-modal="true" aria-label="Ambil foto">
      <div className="camera-stage">
        {shot ? (
          <img src={shot.url} alt="Hasil foto" className="camera-preview" />
        ) : (
          <video ref={videoRef} className="camera-preview" autoPlay playsInline muted />
        )}
        {!ready && !error && !shot && <p className="camera-hint">Membuka kamera...</p>}
      </div>

      {error && <p className="camera-error">{error}</p>}

      <div className="camera-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Batal
        </button>
        {shot ? (
          <>
            <button type="button" className="btn-secondary" onClick={() => replaceShot(null)}>
              Ulangi
            </button>
            <button type="button" className="btn-primary" onClick={handleUse}>
              Pakai Foto
            </button>
          </>
        ) : (
          <>
            {onFallback && (
              <button type="button" className="btn-secondary" onClick={onFallback}>
                Pilih File
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={handleShutter}
              disabled={!ready || busy}
            >
              Ambil Foto
            </button>
          </>
        )}
      </div>
    </div>
  )
}
