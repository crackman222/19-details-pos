import { useEffect, useState } from 'react'
import { getActiveProfiles } from '../api'

// Same roster and same full_name snapshot convention as StaffPicker, but for
// duties several people share (washing). The dropdown only lists whoever
// isn't picked yet, so nobody gets added twice; those already picked are
// listed underneath it. onChange receives the full array of names.
export function MultiStaffPicker({ value, onChange, disabled }) {
  const [workers, setWorkers] = useState([])

  useEffect(() => {
    getActiveProfiles().then(setWorkers).catch(() => {})
  }, [])

  const selected = value ?? []
  const available = workers.filter((w) => !selected.includes(w.full_name))

  return (
    <div className="multi-staff-picker">
      <select
        className="staff-picker-select"
        value=""
        disabled={disabled || available.length === 0}
        onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
      >
        <option value="">{selected.length === 0 ? 'Belum ditentukan' : '+ Tambah petugas'}</option>
        {available.map((w) => (
          <option key={w.id} value={w.full_name}>
            {w.full_name}
          </option>
        ))}
      </select>
      {selected.length > 0 && (
        <ul className="multi-staff-list">
          {selected.map((name) => (
            <li key={name} className="multi-staff-list-item">
              <span>{name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((n) => n !== name))}
                  aria-label={`Hapus ${name}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
