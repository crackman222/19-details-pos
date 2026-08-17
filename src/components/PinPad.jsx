import { useState } from 'react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function PinPad({ staffName, error, onSubmit, onCancel }) {
  const [pin, setPin] = useState('')

  function press(digit) {
    if (pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    if (next.length === 4) {
      onSubmit(next)
      setPin('')
    }
  }

  function backspace() {
    setPin((current) => current.slice(0, -1))
  }

  return (
    <div className="pin-pad">
      <p className="pin-pad-staff">{staffName}</p>
      <div className="pin-pad-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>
      {error && <p className="pin-pad-error">{error}</p>}
      <div className="pin-pad-grid">
        {KEYS.map((digit) => (
          <button key={digit} type="button" onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <button type="button" className="pin-pad-cancel" onClick={onCancel}>
          Batal
        </button>
        <button type="button" onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="pin-pad-backspace" onClick={backspace}>
          ⌫
        </button>
      </div>
    </div>
  )
}
