import { formatRupiah } from '../lib/format'

export function ServicePicker({ services, selectedItems, onToggle, onQuantityChange }) {
  return (
    <div className="service-picker">
      {services.map((service) => {
        const selected = selectedItems.find((item) => item.serviceId === service.id)
        return (
          <div key={service.id} className={`service-picker-row ${selected ? 'selected' : ''}`}>
            <button type="button" className="service-picker-toggle" onClick={() => onToggle(service)}>
              <span>{service.name}</span>
              <span>{formatRupiah(service.price)}</span>
            </button>
            {selected && (
              <div className="service-picker-qty">
                <button type="button" onClick={() => onQuantityChange(service.id, selected.quantity - 1)}>
                  -
                </button>
                <span>{selected.quantity}</span>
                <button type="button" onClick={() => onQuantityChange(service.id, selected.quantity + 1)}>
                  +
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
