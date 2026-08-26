import { SUITABILITY_LEGEND } from '@/components/map/suitabilityLayer'

/**
 * Legenda da camada de adequação.
 *
 * ELA OCUPA O LUGAR DA BARRA DO VEÍCULO enquanto a camada está ligada (ver
 * App.tsx), em vez de flutuar como um card a mais. Por isso o formato imita o
 * daquela barra: mesma largura, mesmo raio, mesma superfície, altura parecida.
 * Um elemento que substitui outro precisa parecer que herdou o lugar, não que
 * caiu por cima.
 *
 * O LAYOUT É EM DUAS COLUNAS de duas linhas, e não uma lista solta que quebra
 * onde der. Com quebra automática, "Não recomendada" às vezes ficava sozinha
 * numa linha e às vezes não, e a legenda mudava de altura conforme o nome do
 * veículo — a pilha inteira pulava. Grade fixa mantém a altura constante.
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
    <div className="pointer-events-auto w-full rounded-2xl border border-hairline/[.06] bg-surface-overlay px-4 py-3 shadow-field backdrop-blur-xl">
      <p className="truncate text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-content-quaternary">
        Vias para {vehicleLabel}
      </p>

      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {SUITABILITY_LEGEND.map((entry) => (
          <span key={entry.tier} className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-[3px] w-3.5 shrink-0 rounded-pill"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="truncate text-[12.5px] font-bold text-content-secondary">{entry.label}</span>
          </span>
        ))}
      </div>

      <p className="mt-1.5 truncate text-[11px] font-semibold text-content-tertiary">
        Pelo tipo da via — piso e tráfego entram ao traçar a rota.
      </p>
    </div>
  )
}
