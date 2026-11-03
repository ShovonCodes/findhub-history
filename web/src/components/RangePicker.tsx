import { RANGES, type RangeId } from '../ranges'

interface RangePickerProps {
  value: RangeId
  onChange: (range: RangeId) => void
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div className="range-picker" role="radiogroup" aria-label="History range">
      {RANGES.map((range) => (
        <button
          key={range.id}
          role="radio"
          aria-checked={range.id === value}
          onClick={() => onChange(range.id)}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
