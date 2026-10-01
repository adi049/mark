import { Check } from 'lucide-react'

/**
 * Compact admin checkbox row: a square check box with a clear label and
 * optional note. Used for permission flags and publish states.
 */
export function CheckRow({ label, note, checked, onChange, disabled = false }) {
  return (
    <label className={`mp-check${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="mp-check__box" aria-hidden="true">
        {checked ? <Check size={12} /> : null}
      </span>
      <span className="mp-check__text">
        <span className="mp-check__label">{label}</span>
        {note ? <span className="mp-check__note">{note}</span> : null}
      </span>
    </label>
  )
}
