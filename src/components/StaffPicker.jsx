import { useEffect, useState } from 'react'
import { getActiveProfiles } from '../api'

// Plain <select> of everyone active — used to assign who's washing/QC'ing a
// job. One roster since migration 009 folded field_workers into profiles, so
// supervisors and admins appear here too; they can pitch in on a wash.
// value/onChange work in terms of full_name (text snapshot, not id) —
// consistent with how treatments.pic already stores staff identity.
export function StaffPicker({ value, onChange, disabled }) {
  const [workers, setWorkers] = useState([])

  useEffect(() => {
    getActiveProfiles().then(setWorkers).catch(() => {})
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
