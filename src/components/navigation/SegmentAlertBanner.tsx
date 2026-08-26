import { useEffect, useState } from 'react'
import type { AlertLevel, SegmentAlert } from '@/services/navigation/segmentAlerts'

/**
 * Faixa de aviso de trecho, durante a navegação.
 *
 * ONDE ELA FICA importa tanto quanto o que ela diz: logo ABAIXO do card de
 * manobra, nunca por cima. A manobra é o que impede o usuário de errar o
 * caminho agora; o trecho é o que ele vai encontrar daqui a meio quilômetro.
 * Cobrir a primeira com a segunda troca uma urgência por uma antecipação.
 *
 * Por isso também não há scrim nem bloqueio de toque: o aviso informa e some
 * sozinho. Nada aqui exige resposta.
 */

const LEVEL_STYLE: Record<AlertLevel, { chip: string; ring: string; title: string }> = {
  attention: {
    chip: 'bg-warning-500 text-content-on-accent',
    ring: 'border-warning-500/40',
    title: 'Atenção à frente',
  },
  critical: {
    chip: 'bg-danger-500 text-content-on-accent',
    ring: 'border-danger-500/45',
    title: 'Trecho não recomendado',
  },
  incompatible: {
    chip: 'bg-danger-500 text-content-on-accent',
    ring: 'border-danger-500/60',
    title: 'Incompatível com seu veículo',
  },
}

export function SegmentAlertBanner({ alert, onDismiss }: { alert: SegmentAlert; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const style = LEVEL_STYLE[alert.level]

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [alert.key])

  return (
    <div
      role="status"
      /*
        `aria-live="assertive"` só no incompatível. Nos outros níveis o leitor
        de tela interromperia a leitura da manobra para anunciar algo que ainda
        está a 200 m — a mesma regra da voz, aplicada ao leitor.
      */
      aria-live={alert.level === 'incompatible' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-nav-surface px-3.5 py-3 shadow-nav-panel transition-all duration-slow ease-ease-out-soft ${style.ring} ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill ${style.chip}`}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
          <path d="M12 8v5" />
          <path d="M12 16.5v.01" />
          <path d="M10.3 3.9L2.5 18a1.8 1.8 0 001.6 2.7h15.8a1.8 1.8 0 001.6-2.7L13.7 3.9a1.9 1.9 0 00-3.4 0z" strokeLinejoin="round" />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold uppercase tracking-wide text-nav-content/70">{style.title}</span>
        <span className="mt-0.5 block text-[14.5px] font-bold leading-snug text-nav-content">{alert.text}</span>
      </span>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dispensar aviso"
        className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center p-2 text-nav-content/60 transition-all duration-fast active:scale-[.97]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.8}>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
