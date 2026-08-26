import { SUITABILITY_LEGEND } from '@/components/map/suitabilityLayer'

/**
 * Legenda da camada de adequação.
 *
 * Aparece SÓ com a camada ligada, e some junto. Uma legenda permanente ocuparia
 * espaço de mapa para explicar cores que na maior parte do tempo não estão lá.
 *
 * A RESSALVA no rodapé não é letra miúda de praxe — é a diferença entre esta
 * camada e a classificação de uma rota. Aqui só entra o TIPO da via, que é o
 * que o tile vetorial carrega; piso, velocidade do tráfego e restrição de
 * acesso vêm do Overpass por trecho e só existem depois de traçar a rota. Sem
 * dizer isso, uma rua verde aqui que vira âmbar na rota parece contradição do
 * app, quando na verdade são duas perguntas diferentes.
 */
export function SuitabilityLegend({ vehicleLabel }: { vehicleLabel: string }) {
  return (
    <div className="pointer-events-auto rounded-2xl border border-hairline/[.08] bg-surface-overlay px-3.5 py-3 shadow-float backdrop-blur-xl">
      <p className="text-[11.5px] font-extrabold uppercase tracking-wide text-content-tertiary">
        Vias para {vehicleLabel}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5">
        {SUITABILITY_LEGEND.map((entry) => (
          <span key={entry.tier} className="flex items-center gap-1.5">
            <span
              className="h-[3px] w-4 shrink-0 rounded-pill"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-[12.5px] font-bold text-content-secondary">{entry.label}</span>
          </span>
        ))}
      </div>

      <p className="mt-2 text-[11.5px] font-semibold leading-snug text-content-tertiary">
        Pelo tipo da via. Piso e tráfego entram só ao traçar a rota.
      </p>
    </div>
  )
}
