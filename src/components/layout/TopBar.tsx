interface TopBarProps {
  onMenuClick: () => void
  onProfileClick: () => void
}

export function TopBar({ onMenuClick, onProfileClick }: TopBarProps) {
  return (
    <div className="pointer-events-auto flex items-center justify-between rounded-full bg-white/95 px-2 py-2 shadow-floating backdrop-blur">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-navy-900 active:bg-slate-100"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <div className="flex items-center gap-1.5">
        <span className="h-8 w-8 overflow-hidden rounded-lg">
          <img
            src="/icons/icon-192.png"
            alt="GPS Scooter"
            className="h-full w-full object-cover"
            style={{ objectPosition: '50% 32%' }}
          />
        </span>
        <span className="text-[13px] font-bold tracking-wide text-navy-900">GPS SCOOTER</span>
      </div>

      <button
        type="button"
        onClick={onProfileClick}
        aria-label="Perfil"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 active:bg-brand-100"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
