import { formatRupiah } from '../lib/format'

// Same card grid as ServicePicker, but goods are finite: each card shows what
// is left and stops adding once the ticket holds the whole shelf. The list it
// receives is already filtered to in-stock, active items.
//
// A card stays clickable even when sold out — rather than a native `disabled`
// button, which silently swallows the tap on a phone — so onAdd always fires
// and the caller can surface an alert instead of nothing happening.
export function ShelfItemPicker({ items, selectedItems, onAdd }) {
  if (items.length === 0) {
    return <p className="service-picker-empty">Belum ada barang tersedia</p>
  }

  return (
    <div className="service-picker-grid">
      {items.map((item) => {
        const selected = selectedItems.find((line) => line.shelfItemId === item.id)
        const taken = selected?.quantity ?? 0
        const soldOut = taken >= item.stock
        return (
          <button
            key={item.id}
            type="button"
            className={`service-card ${selected ? 'selected' : ''} ${soldOut ? 'sold-out' : ''}`}
            onClick={() => onAdd(item, soldOut)}
            title={soldOut ? 'Stok habis' : undefined}
          >
            {selected && <span className="service-card-qty">{selected.quantity}</span>}
            <span className="service-card-name">{item.name}</span>
            <span className="service-card-price">{formatRupiah(item.price)}</span>
            <span className="service-card-stock">Sisa {item.stock - taken}</span>
          </button>
        )
      })}
    </div>
  )
}
