import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

export type SheetSnapPoint = 'collapsed' | 'half' | 'expanded'

/**
 * Alturas dos pontos de parada, em % da tela.
 *
 * O ponto RECOLHIDO não está aqui de propósito: ele não tem altura fixa, tem a
 * altura do SEU CONTEÚDO. Eram 22% da tela, mas o conteúdo (tempo e distância)
 * ocupava ~70px — o resto era um vazio branco de quase 100px abaixo das
 * informações, justamente no estado em que a pessoa recolheu a folha para VER
 * O MAPA. Ver `COLLAPSED_HEIGHT`.
 */
const SNAP_HEIGHT_VH: Record<Exclude<SheetSnapPoint, 'collapsed'>, number> = {
  half: 54,
  expanded: 86,
}

/** Alça (28px) + linha de resumo (~64px) + respiro; a base respeita a área segura. */
const COLLAPSED_HEIGHT = 'calc(5.75rem + max(0.5rem, var(--safe-bottom)))'

const MIN_HEIGHT_VH = 8
const MAX_HEIGHT_VH = 92

interface BottomSheetProps {
  snap: SheetSnapPoint
  onSnapChange: (snap: SheetSnapPoint) => void
  /** Conteúdo mínimo mostrado só no estado 'collapsed' — o resto fica oculto para não competir com o mapa. */
  collapsedContent: ReactNode
  children: ReactNode
}

/**
 * Bottom sheet real com arraste por gesto (pointer events, funciona em touch
 * e mouse) e três snap points. Durante o arraste a altura acompanha o dedo
 * ao vivo (sem transição, para não parecer "elástico"); ao soltar, anima até
 * o snap point mais próximo. O mapa por trás permanece totalmente
 * interativo — este componente só ocupa a faixa inferior da tela.
 */
export function BottomSheet({ snap, onSnapChange, collapsedContent, children }: BottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [liveHeightVh, setLiveHeightVh] = useState(54)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartYRef = useRef<number | null>(null)
  const startHeightVhRef = useRef(54)
  // Altura REAL do estado recolhido, medida no início do arraste: como depende
  // do conteúdo e da área segura, não existe como constante.
  const collapsedVhRef = useRef(12)

  function currentHeightVh(): number {
    const altura = sheetRef.current?.offsetHeight ?? 0
    return (altura / window.innerHeight) * 100
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (snap === 'collapsed') collapsedVhRef.current = currentHeightVh()
    setIsDragging(true)
    dragStartYRef.current = e.clientY
    // Parte da altura que a folha TEM agora, não de uma tabela: é o que faz o
    // arraste começar exatamente sob o dedo, em qualquer ponto de parada.
    startHeightVhRef.current = currentHeightVh()
    setLiveHeightVh(startHeightVhRef.current)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging || dragStartYRef.current === null) return
    const deltaVh = ((dragStartYRef.current - e.clientY) / window.innerHeight) * 100
    const next = Math.min(MAX_HEIGHT_VH, Math.max(MIN_HEIGHT_VH, startHeightVhRef.current + deltaVh))
    setLiveHeightVh(next)
  }

  function handlePointerUp() {
    if (!isDragging) return
    setIsDragging(false)
    dragStartYRef.current = null

    const pontos: [SheetSnapPoint, number][] = [
      ['collapsed', collapsedVhRef.current],
      ['half', SNAP_HEIGHT_VH.half],
      ['expanded', SNAP_HEIGHT_VH.expanded],
    ]
    let closest: SheetSnapPoint = 'collapsed'
    let closestDiff = Number.POSITIVE_INFINITY
    for (const [point, vh] of pontos) {
      const diff = Math.abs(vh - liveHeightVh)
      if (diff < closestDiff) {
        closestDiff = diff
        closest = point
      }
    }
    onSnapChange(closest)
  }

  const height = isDragging ? `${liveHeightVh}vh` : snap === 'collapsed' ? COLLAPSED_HEIGHT : `${SNAP_HEIGHT_VH[snap]}vh`

  return (
    <div
      ref={sheetRef}
      className={`pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-hairline/15 bg-surface-card shadow-sheet ${
        isDragging ? '' : 'transition-[height] duration-slow ease-ease-out-soft'
      }`}
      style={{ height }}
    >
      <div
        className="flex shrink-0 touch-none flex-col items-center pb-2 pt-3 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Handle 56×5, como especifica o handoff. */}
        <div className="h-[5px] w-14 rounded-pill bg-hairline/20" />
      </div>

      {snap === 'collapsed' ? (
        <div className="px-gutter pb-[max(0.5rem,var(--safe-bottom))]">{collapsedContent}</div>
      ) : (
        // `min-h-0` é necessário para que o filho com `flex-1 overflow-y-auto`
        // (a lista de rotas) role de verdade em vez de esticar o container.
        <div className="flex min-h-0 flex-1 flex-col px-gutter pb-[max(1.5rem,var(--safe-bottom))]">{children}</div>
      )}
    </div>
  )
}
