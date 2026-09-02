// Live camera capture for photo uploads.
//
// The file inputs already carry capture="environment", which is enough on a
// phone — the OS camera app handles it. On a laptop (and on any browser that
// ignores the attribute) that falls back to a file picker, so this module
// drives the camera in-page via getUserMedia instead.
//
// navigator.mediaDevices only exists on a secure origin (https or localhost),
// so on a plain-http deployment this reports unsupported and callers fall back
// to the file picker rather than failing.
export function isCameraSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

// Prefer the rear camera — staff are photographing a vehicle, not themselves.
// facingMode is a hint, not a guarantee: a laptop with only a front camera
// still resolves, it just returns that one.
export async function startCameraStream() {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  })
}

export function stopCameraStream(stream) {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}

// Grabs the current video frame as a JPEG File, ready to hand to the same
// upload path a picked file goes through. Compression to the final size still
// happens server-side; the 0.9 quality here just keeps the upload reasonable.
export function captureFrame(video, filename = 'kamera.jpg') {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) throw new Error('Kamera belum siap')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(video, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal mengambil foto'))
          return
        }
        resolve(new File([blob], filename, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9
    )
  })
}

// getUserMedia rejects with a handful of well-known DOMException names; map the
// ones staff can actually act on to Indonesian, since the browser's own message
// is English and often cryptic.
export function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Akses kamera ditolak — izinkan kamera di pengaturan browser'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera tidak ditemukan di perangkat ini'
    case 'NotReadableError':
      return 'Kamera sedang dipakai aplikasi lain'
    default:
      return err?.message || 'Gagal membuka kamera'
  }
}
