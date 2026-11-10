import { useNavigate } from 'react-router-dom'

export default function ArmLabLogo() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      aria-label="Arm Lab"
      onClick={() => navigate('/')}
      className="inline-flex h-12 w-12 items-center justify-center rounded-md transition hover:bg-surface-subtle focus-visible:outline-offset-4"
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="24" cy="24" r="24" fill="#0091BD" />
        <text
          x="24"
          y="20"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFFFFF"
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          fontSize="11.5"
          fontWeight="700"
          letterSpacing="-0.4"
        >
          Arm
        </text>
        <text
          x="24"
          y="31"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFFFFF"
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          fontSize="11.5"
          fontWeight="700"
          letterSpacing="-0.4"
        >
          Lab
        </text>
      </svg>
    </button>
  )
}
