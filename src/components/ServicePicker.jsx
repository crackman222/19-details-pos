import { formatRupiah } from '../lib/format'

export function ServicePicker({ services, selectedItems, onAdd }) {
  if (services.length === 0) {
    return <p className="service-picker-empty">Belum ada layanan aktif</p>
  }

  return (
    <div className="service-picker-grid">
      {services.map((service) => {
        const selected = selectedItems.find((item) => item.serviceId === service.id)
        return (
          <button
            key={service.id}
            type="button"
            className={`service-card ${selected ? 'selected' : ''}`}
            onClick={() => onAdd(service)}
          >
            {selected && <span className="service-card-qty">{selected.quantity}</span>}
            <span className="service-card-name">{service.name}</span>
            <span className="service-card-price">{formatRupiah(service.price)}</span>
          </button>
        )
      })}
    </div>
  )
}
