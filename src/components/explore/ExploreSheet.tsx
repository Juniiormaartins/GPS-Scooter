import { BatteryDial, useDeferredPercent } from '@/components/vehicle/BatteryDial'
import { Chip, SectionLabel } from '@/components/ui/primitives'
import { confidenceCaveat, exploreRadiusKm, rangeSourceLabel, type AutonomyState } from '@/services/vehicle/autonomy'
import { haversineDistanceMeters } from '@/utils/geo'
import type { LngLat } from '@/config/region'
import type { SavedPlace } from '@/services/storage/savedPlaces'
import type { FrequentPlace } from '@/services/storage/travelPatterns'

/**
 * MODO EXPLORAR MOBILIDADE ELÉTRICA.
 *
 * A pergunta que ele responde não é "como chego lá" — é "até onde eu consigo
 * ir?". São perguntas diferentes e a segunda não tinha lugar nenhum no app:
 * toda a interface partia de um destino já escolhido.
 *
 * O EIXO É A AUTONOMIA, e é o que justifica o modo existir separado da busca.
 * Um raio de alcance desenhado no mapa transforma um número abstrato ("30 km")
 * em uma resposta geográfica ("até ali"). E o que aparece na lista é filtrado
 * por esse raio, então nada aqui é sugestão que a bateria não alcança.
 *
 * ESCOPO DESTA VERSÃO, dito com todas as letras: lugares SALVOS e lugares que o
 * histórico mostra serem frequentes, mais os atalhos de categoria que já
 * existem na busca. Pontos de recarga ficam de fora porque não há fonte de
 * dados para eles neste projeto — inventar uma lista de recarga seria a pior
 * coisa que este modo poderia fazer, já que é exatamente o dado em que alguém
 * confiaria para decidir se sai de casa.
 */

/** Categorias de busca reaproveitadas dos atalhos da tela de pesquisa. */
const CATEGORIES = [
  { query: 'restaurante', label: 'Restaurantes' },
  { query: 'posto de gasolina', label: 'Postos' },
  { query: 'parque', label: 'Parques' },
  { query: 'mercado', label: 'Mercados' },
  { query: 'farmácia', label: 'Farmácias' },
  { query: 'cafeteria', label: 'Cafés' },
] as const

interface ExploreSheetProps {
  autonomy: AutonomyState
  userPoint: LngLat | null
  savedPlaces: SavedPlace[]
  frequentPlaces: FrequentPlace[]
  onPickPlace: (label: string, point: LngLat) => void
  onSearchCategory: (query: string) => void
  onUpdateBattery: (percent: number) => void
  onClose: () => void
}

export function ExploreSheet({
  autonomy,
  userPoint,
  savedPlaces,
  frequentPlaces,
  onPickPlace,
  onSearchCategory,
  onUpdateBattery,
  onClose,
}: ExploreSheetProps) {
  const radiusKm = exploreRadiusKm(autonomy)
  const [battery, setBattery] = useDeferredPercent(autonomy.estimatedPercent ?? 80, onUpdateBattery)
  const caveat = confidenceCaveat(autonomy.confidence)
  const origem = rangeSourceLabel(autonomy)

  /**
   * Filtro por DISTÂNCIA EM LINHA RETA, e a interface diz isso.
   *
   * Calcular a rota real de cada lugar salvo para saber se cabe no alcance
   * seriam N requisições de roteamento só para montar uma lista. A linha reta
   * é sempre menor ou igual ao caminho real, então ela nunca esconde um lugar
   * alcançável — no máximo inclui um que, pelas ruas, fica um pouco além. O
   * erro cai para o lado de mostrar mais, não de esconder.
   */
  const dentroDoAlcance = <T extends { point: LngLat }>(items: T[]): T[] => {
    if (userPoint == null || radiusKm == null) return items
    return items.filter((item) => haversineDistanceMeters(userPoint, item.point) / 1000 <= radiusKm)
  }

  const salvosPerto = dentroDoAlcance(savedPlaces)
  const frequentesPerto = dentroDoAlcance(frequentPlaces).filter(
    (lugar) => !salvosPerto.some((salvo) => salvo.label === lugar.label),
  )

  return (
    <>
      {/*
        Scrim MAIS FRACO que o das outras folhas (0,28 → 0,12) e folha mais
        baixa (82% → 62%): aqui o mapa atrás NÃO é conteúdo dispensável, ele é
        metade da resposta. O anel de alcance precisa ser visto junto com o
        número, senão o modo vira uma lista com um texto em cima.
      */}
      <div className="pointer-events-auto absolute inset-0 z-30 bg-[rgba(15,23,41,.12)]" onClick={onClose} />

      <div className="pointer-events-auto absolute inset-x-3 bottom-0 z-40 max-h-[62%] overflow-y-auto rounded-t-2xl bg-surface-card px-card pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[18px] shadow-sheet">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sheet-title text-content-primary">Até onde dá para ir</h2>
            {radiusKm != null ? (
              <p className="mt-1 text-[14px] font-semibold text-content-secondary">
                {/*
                  IDA E VOLTA, dito explicitamente. `exploreRadiusKm` já divide
                  por dois, e omitir isso faria o número parecer o dobro do que
                  é — a diferença entre passear e ficar sem bateria longe de
                  casa.
                */}
                Com a bateria atual, cerca de <strong className="text-content-primary">{formatKm(radiusKm)}</strong> de
                raio, contando a volta.
              </p>
            ) : (
              <p className="mt-1 text-[14px] font-semibold text-content-secondary">
                Informe a bateria abaixo para o app calcular seu raio de alcance.
              </p>
            )}
            {/*
              A RESSALVA DE ORIGEM aparece SEMPRE, não só quando o dado está
              velho. O raio desenhado no mapa parece medição — é uma forma
              geográfica, precisa, com contorno. Sem esta linha, alguém decide
              se vai e volta de um lugar confiando num número que saiu do
              proprio dedo dele meia hora antes.
            */}
            <p className="mt-1 text-[12.5px] font-bold text-content-tertiary">
              {caveat ?? 'Estimativa a partir da bateria que você informou — o app não lê o veículo.'}
            </p>
            {/* Quando o app já aprendeu com trajetos reais, ele diz. */}
            {origem && <p className="mt-0.5 text-[12.5px] font-bold text-success-600">{origem}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center p-2.5 text-content-tertiary transition-all duration-fast active:scale-[.97]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/*
          O CONTROLE DE BATERIA MORA AQUI, e é a resposta ao "não quero
          preencher formulário toda vez": não existe momento obrigatório de
          informar bateria em lugar nenhum do app. Ela é pedida uma vez no
          onboarding e depois fica ao alcance da mão exatamente na tela em que o
          número importa — se o raio parecer errado, o ajuste está logo abaixo
          dele e o raio se move junto.
        */}
        <div className="mt-4 rounded-xl border border-hairline/[.08] bg-surface-tile px-3.5 py-3">
          <BatteryDial value={battery} rangeKm={autonomy.rangeKm} onChange={setBattery} />
        </div>

        <div className="mt-5">
          <SectionLabel className="mb-stack">Procurar por perto</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Chip key={category.query} onClick={() => onSearchCategory(category.query)}>
                {category.label}
              </Chip>
            ))}
          </div>
        </div>

        {salvosPerto.length > 0 && (
          <div className="mt-5">
            <SectionLabel className="mb-stack">Salvos dentro do alcance</SectionLabel>
            <div className="flex flex-col gap-2">
              {salvosPerto.map((place) => (
                <PlaceRow
                  key={place.id}
                  label={place.label}
                  detail={distanceLabel(userPoint, place.point)}
                  onClick={() => onPickPlace(place.label, place.point)}
                />
              ))}
            </div>
          </div>
        )}

        {frequentesPerto.length > 0 && (
          <div className="mt-5">
            <SectionLabel className="mb-stack">Onde você costuma ir</SectionLabel>
            <div className="flex flex-col gap-2">
              {frequentesPerto.map((place) => (
                <PlaceRow
                  key={place.label}
                  label={place.label}
                  detail={`${place.visits} trajetos · ${distanceLabel(userPoint, place.point)}`}
                  onClick={() => onPickPlace(place.label, place.point)}
                />
              ))}
            </div>
          </div>
        )}

        {salvosPerto.length === 0 && frequentesPerto.length === 0 && (
          <p className="mt-5 text-[13.5px] font-semibold text-content-tertiary">
            Salve lugares ou faça alguns trajetos e eles aparecem aqui, já filtrados pelo que a bateria alcança.
          </p>
        )}
      </div>
    </>
  )
}

function PlaceRow({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-hairline/[.08] bg-surface-tile px-3.5 py-2.5 text-left transition-all duration-base active:scale-[.98]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-extrabold text-content-primary">{label}</span>
        <span className="mt-0.5 block text-[12.5px] font-semibold text-content-tertiary">{detail}</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2.6}>
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function distanceLabel(from: LngLat | null, to: LngLat): string {
  if (!from) return 'em linha reta'
  return `≈ ${formatKm(haversineDistanceMeters(from, to) / 1000)} em linha reta`
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 100) * 10} m`
  return `${km.toFixed(km < 10 ? 1 : 0)} km`
}
