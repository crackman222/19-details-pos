export function NamePicker({ profiles, onSelect }) {
  return (
    <div className="name-picker-grid">
      {profiles.map((profile) => (
        <button
          key={profile.id}
          type="button"
          className="name-picker-button"
          onClick={() => onSelect(profile)}
        >
          {profile.full_name}
        </button>
      ))}
    </div>
  )
}
