import { VEHICLE_PROFILE } from '@/config/vehicle'

/**
 * Chip de status do topo. "Ref. X km/h" é a velocidade de referência
 * configurada do veículo (VEHICLE_PROFILE.maxOperationalSpeedKmh) — usada de
 * fato no cálculo de ETA (services/routing/eta.ts e
 * services/navigation/progress.ts), não é decorativo. O prefixo "Ref." evita
 * a leitura ambígua de "isto é minha velocidade atual".
 *
 * O indicador de bateria foi removido daqui: antes de haver qualquer
 * deslocamento, o percentual estimado é só o valor inicial mockado sem
 * nenhum cálculo aplicado — mostrá-lo como se fosse um dado com significado
 * neste momento seria enganoso. A estimativa de bateria REAL (com fórmula
 * aplicada sobre distância percorrida) aparece em NavigationPanel, durante a
 * navegação, onde ela de fato representa algo.
 */
export function StatusChips() {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full border border-white/5 bg-surface-card/95 px-3 py-1.5 text-xs font-semibold text-brand-400 shadow-floating backdrop-blur">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" strokeLinecap="round" />
        </svg>
        Ref. {VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h
      </span>
    </div>
  )
}
