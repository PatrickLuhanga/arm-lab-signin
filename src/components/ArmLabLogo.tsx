import { useNavigate } from 'react-router-dom'

export default function ArmLabLogo() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      aria-label="Arm Lab home"
      onClick={() => navigate('/')}
      className="inline-flex min-h-12 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition hover:opacity-80 focus-visible:outline-offset-4"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="armlab-mark" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0091BD" />
            <stop offset="0.45" stopColor="#7AB4B6" />
            <stop offset="0.75" stopColor="#812575" />
            <stop offset="1" stopColor="#D11F2D" />
          </linearGradient>
        </defs>
        <g stroke="url(#armlab-mark)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M11 4V1M21 4V1M11 31V28M21 31V28M4 11H1M4 21H1M31 11H28M31 21H28" />
        </g>
        <rect x="4" y="4" width="24" height="24" rx="5" stroke="url(#armlab-mark)" strokeWidth="2" />
        <rect
          x="10"
          y="10"
          width="12"
          height="12"
          rx="2"
          fill="url(#armlab-mark)"
          fillOpacity="0.18"
          stroke="url(#armlab-mark)"
          strokeWidth="1.5"
        />
        <rect x="13.5" y="13.5" width="5" height="5" rx="1" fill="url(#armlab-mark)" />
      </svg>
      <span className="flex items-baseline gap-1.5 text-lg font-extrabold tracking-tight">
        <span className="text-ink">ARM</span>
        <span className="bg-gradient-to-r from-[#0091BD] via-[#812575] to-[#D11F2D] bg-clip-text text-transparent">
          LAB
        </span>
      </span>
    </button>
  )
}
