import { useEffect, useState } from 'react'
import type { AlertLevel, BannerAlert } from '@/services/navigation/segmentAlerts'

/**
 * Faixa de aviso de trecho, durante a navegação.
 *
 * ONDE ELA FICA importa tanto quanto o que ela diz: logo ABAIXO do card de
 * manobra, nunca por cima. A manobra é o que impede o usuário de errar o
 * caminho agora; o trecho é o que ele vai encontrar daqui a meio quilômetro.
 * Cobrir a primeira com a segunda troca uma urgência por uma antecipação.
 *
 * ESPELHA O CARD DE MANOBRA, de propósito: mesma superfície `nav-surface`,
 * mesmo raio, mesmo tile de ícone `rounded-lg`, mesma sombra, mesma hierarquia
 * (eyebrow curto em caixa alta, depois a frase). Não é economia de esforço — é
 * o que faz o aviso parecer parte da navegação em vez de um pop-up que caiu na
 * tela. O que muda entre os dois é só a COR do acento, que aqui carrega a
 * gravidade.
 *
 * BUG DE CONTRASTE QUE ISTO CONSERTA. A versão anterior usava
 * `text-nav-content/70` e `/60`. Essas classes NÃO EXISTEM no CSS gerado: o
 * Tailwind não aplica modificador de opacidade sobre `var(--nav-content)`,
 * porque o token é um hex dentro de uma variável e não canais com
 * `<alpha-value>`. Sem declaração de cor, o texto herdava a cor escura do app —
 * preto sobre fundo escuro. Aqui só entram tokens que existem de fato.
 */

const LEVEL: Record<
  AlertLevel | 'tip',
  { titulo: string; acento: string; tile: string; borda: string }
> = {
  attention: {
    titulo: 'Atenção à frente',
    acento: 'text-warning-500',
    tile: 'bg-warning-500 text-content-on-accent',
    borda: 'border-warning-500/40',
  },
  critical: {
    titulo: 'Trecho não recomendado',
    acento: 'text-danger-400',
    tile: 'bg-danger-500 text-content-on-accent',
    borda: 'border-danger-500/50',
  },
  // Dica não é aviso de perigo: acento da marca (azul), não de gravidade. O que
  // a separa dos outros três é justamente não gritar.
  tip: {
    titulo: 'Dica',
    acento: 'text-brand-400',
    tile: 'bg-brand-500 text-content-on-accent',
    borda: 'border-brand-500/40',
  },
  incompatible: {
    titulo: 'Incompatível com seu veículo',
    acento: 'text-danger-400',
    tile: 'bg-danger-500 text-content-on-accent',
    borda: 'border-danger-500/70',
  },
}

export function SegmentAlertBanner({ alert, onDismiss }: { alert: BannerAlert; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const nivel = LEVEL[alert.level]

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [alert.key])

  // Dica nova começa recolhida: a anterior pode ter sido aberta para leitura.
  useEffect(() => setExpanded(false), [alert.key])

  if (alert.level === 'tip') {
    /*
      DICA = PÍLULA DE UMA LINHA. O resto do alerta (tile de 44px, eyebrow,
      texto em quatro linhas) existe para o que é urgente; a dica é conselho que
      a voz já deu. Medido: a versão grande ocupava 144px de 602 no topo da
      tela, ao lado do cartão de manobra — quase metade do mapa. Esta ocupa uma
      linha, e quem quiser ler tudo toca para expandir.
    */
    return (
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto rounded-2xl border bg-nav-surface shadow-nav-banner transition-all duration-slow ease-ease-out-soft ${nivel.borda} ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2.5 py-1.5 pl-3 pr-1.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-500 text-content-on-accent">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
              <path d="M9 18h6" />
              <path d="M10 22h4" />
            </svg>
          </span>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="min-w-0 flex-1 py-1.5 text-left"
          >
            <span className="sr-only">Dica: </span>
            <span className="block truncate text-[14px] font-bold text-nav-content">{alert.headline ?? alert.text}</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dispensar dica"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-nav-content-secondary transition-all duration-fast active:scale-[.97]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.8}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {expanded && (
          <p className="px-3.5 pb-3 pt-0.5 text-[13.5px] font-semibold leading-snug text-nav-content-secondary">{alert.text}</p>
        )}
      </div>
    )
  }

  return (
    <div
      role="status"
      /*
        `aria-live="assertive"` só no incompatível. Nos outros níveis o leitor
        de tela interromperia a leitura da manobra para anunciar algo que ainda
        está a 200 m — a mesma regra da voz, aplicada ao leitor.
      */
      aria-live={alert.level === 'incompatible' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-center gap-3.5 rounded-2xl border bg-nav-surface px-4 py-3.5 shadow-nav-banner transition-all duration-slow ease-ease-out-soft ${nivel.borda} ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      {/* Tile de 44px — menor que os 54px da manobra, porque isto é apoio. */}
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${nivel.tile}`}>
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
          <path d="M12 8.5v5" />
          <path d="M12 17v.01" />
          <path d="M10.3 3.9 2.5 18a1.8 1.8 0 0 0 1.6 2.7h15.8a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" strokeLinejoin="round" />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-extrabold uppercase tracking-[0.6px] ${nivel.acento}`}>
          {nivel.titulo}
        </span>
        <span className="mt-0.5 block text-[14.5px] font-bold leading-snug text-nav-content">{alert.text}</span>
      </span>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dispensar aviso"
        className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center p-2 text-nav-content-secondary transition-all duration-fast active:scale-[.97]"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.8}>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
