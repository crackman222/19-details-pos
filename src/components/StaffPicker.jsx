import { useEffect, useState } from 'react'
import { getActiveFieldWorkers } from '../api'

// Plain <select> of active field workers — used to assign who's
// washing/QC'ing a job. Office staff (dashboard users) deliberately aren't
// in this list; they don't do the physical work. value/onChange work in
// terms of full_name (text snapshot, not worker id) — consistent with how
// treatments.pic already stores staff identity.
export function StaffPicker({ value, onChange, disabled }) {
  const [workers, setWorkers] = useState([])

  useEffect(() => {
    getActiveFieldWorkers().then(setWorkers).catch(() => {})
  }, [])

  return (
    <select
      className="staff-picker-select"
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Belum ditentukan</option>
      {workers.map((w) => (
        <option key={w.id} value={w.full_name}>
          {w.full_name}
        </option>
      ))}
    </select>
  )
}
