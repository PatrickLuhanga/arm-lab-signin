import { Delete as BackspaceIcon } from 'lucide-react'

interface NumpadProps {
  onDigit: (digit: string) => void
  onClear: () => void
  onBackspace: () => void
  disabled?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const keyClass =
  'flex h-14 min-h-12 items-center justify-center rounded-md border border-border bg-surface text-xl font-semibold text-ink transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50'

export default function Numpad({ onDigit, onClear, onBackspace, disabled = false }: NumpadProps) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Numeric keypad">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => onDigit(digit)}
          disabled={disabled}
          className={keyClass}
        >
          {digit}
        </button>
      ))}
      <button type="button" onClick={onClear} disabled={disabled} className={keyClass}>
        CLR
      </button>
      <button type="button" onClick={() => onDigit('0')} disabled={disabled} className={keyClass}>
        0
      </button>
      <button
        type="button"
        onClick={onBackspace}
        disabled={disabled}
        aria-label="DEL"
        className={`${keyClass} gap-2 text-sm`}
      >
        <BackspaceIcon size={18} aria-hidden="true" />
        <span>DEL</span>
      </button>
    </div>
  )
}
