import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

export type SheetSnapPoint = 'collapsed' | 'half' | 'expanded'

const SNAP_HEIGHT_VH: Record<SheetSnapPoint, number> = {
  collapsed: 22,
  half: 48,
  expanded: 86,
}

const MIN_HEIGHT_VH = 14
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
  const [liveHeightVh, setLiveHeightVh] = useState(SNAP_HEIGHT_VH[snap])
  const dragStartYRef = useRef<number | null>(null)
  const startHeightVhRef = useRef(SNAP_HEIGHT_VH[snap])

  useEffect(() => {
    if (!isDragging) setLiveHeightVh(SNAP_HEIGHT_VH[snap])
  }, [snap, isDragging])

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    setIsDragging(true)
    dragStartYRef.current = e.clientY
    startHeightVhRef.current = SNAP_HEIGHT_VH[snap]
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

    let closest: SheetSnapPoint = 'collapsed'
    let closestDiff = Number.POSITIVE_INFINITY
    for (const [point, vh] of Object.entries(SNAP_HEIGHT_VH) as [SheetSnapPoint, number][]) {
      const diff = Math.abs(vh - liveHeightVh)
      if (diff < closestDiff) {
        closestDiff = diff
        closest = point
      }
    }
    onSnapChange(closest)
  }

  return (
    <div
      className={`pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-hairline/15 bg-surface-card shadow-sheet ${
        isDragging ? '' : 'transition-[height] duration-slow ease-ease-out-soft'
      }`}
      style={{ height: `${liveHeightVh}vh` }}
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
        <div className="px-gutter pb-[max(1.5rem,var(--safe-bottom))]">{collapsedContent}</div>
      ) : (
        // `min-h-0` é necessário para que o filho com `flex-1 overflow-y-auto`
        // (a lista de rotas) role de verdade em vez de esticar o container.
        <div className="flex min-h-0 flex-1 flex-col px-gutter pb-[max(1.5rem,var(--safe-bottom))]">{children}</div>
      )}
    </div>
  )
}
