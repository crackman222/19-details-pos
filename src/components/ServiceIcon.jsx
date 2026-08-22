const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function CoatingKacaIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6l7-3Z" />
      <path
        d="M12 9.2c1.4 1.8 2.2 2.9 2.2 4a2.2 2.2 0 1 1-4.4 0c0-1.1.8-2.2 2.2-4Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

function CuciMobilIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 17.5h14M6 17.5v-3.6c0-.4.1-.7.3-1l1.5-2a2 2 0 0 1 1.6-.9h5.2a2 2 0 0 1 1.6.9l1.5 2c.2.3.3.6.3 1v3.6" />
      <circle cx="8.5" cy="17.5" r="1.6" />
      <circle cx="15.5" cy="17.5" r="1.6" />
      <path d="M6.5 6c.5-1 1.5-1 2 0M11 5.2c.5-1 1.5-1 2 0M15.5 6c.5-1 1.5-1 2 0" />
    </svg>
  )
}

function CuciMotorIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="6" cy="17" r="2.3" />
      <circle cx="17.5" cy="17" r="2.3" />
      <path d="M8.2 17h3.3l2-4.3h3.3M13.5 12.7l2.3 4.3M8.7 12.7h3" />
      <path d="M6.5 6c.5-1 1.5-1 2 0M11 5.2c.5-1 1.5-1 2 0M15.5 6c.5-1 1.5-1 2 0" />
    </svg>
  )
}

function PolesBodyIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="14" r="5" />
      <circle cx="11" cy="14" r="1.8" />
      <path d="M11 6.5V4M9 4h4" />
      <path
        d="M18 5.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

function DefaultServiceIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4l-5.6 5.6a1.5 1.5 0 0 0 2.1 2.1l5.6-5.6a4 4 0 0 1 5.4-5.4l-2.6 2.6-2.1-2.1 2.6-2.6Z" />
    </svg>
  )
}

// Matched against the real `services.name` values on file — trailing
// whitespace exists in the DB (e.g. "Cuci Motor "), hence the trim.
const ICON_BY_KEYWORD = [
  { keyword: 'coating', Icon: CoatingKacaIcon },
  { keyword: 'cuci mobil', Icon: CuciMobilIcon },
  { keyword: 'cuci motor', Icon: CuciMotorIcon },
  { keyword: 'poles', Icon: PolesBodyIcon },
]

export function ServiceIcon({ name }) {
  const normalized = (name || '').trim().toLowerCase()
  const match = ICON_BY_KEYWORD.find(({ keyword }) => normalized.includes(keyword))
  const Icon = match ? match.Icon : DefaultServiceIcon

  return (
    <span className="katalog-service-icon" aria-hidden="true">
      <Icon />
    </span>
  )
}
