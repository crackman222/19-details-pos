const METHODS = [
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer' },
]

export function PaymentMethodSelector({ value, onChange }) {
  return (
    <div className="payment-method-selector">
      {METHODS.map((method) => (
        <button
          key={method.value}
          type="button"
          className={`payment-method-button ${value === method.value ? 'selected' : ''}`}
          onClick={() => onChange(method.value)}
        >
          {method.label}
        </button>
      ))}
    </div>
  )
}
