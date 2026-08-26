import { useEffect, useRef, useState } from 'react'
import { badgeUrl } from '@/components/map/poiLibrary'
import { ListRow, SectionLabel } from '@/components/ui/primitives'
import type { LngLat } from '@/config/region'
import { useAddressSuggestions } from '@/hooks/useAddressSuggestions'
import type { GeocodingResult } from '@/services/geocoding'
import { clearSearchHistory, listSearchHistory, removeSearchHistoryEntry } from '@/services/storage/searchHistory'
import { formatDistance, haversineDistanceMeters } from '@/utils/geo'

interface SearchScreenProps {
  onBack: () => void
  onPick: (result: GeocodingResult) => void
  /** Posição atual — usada só para a distância à direita de cada resultado (dado real; sem ela, o campo some). */
  userPoint: LngLat | null
  initialQuery?: string
}

/** Categorias rápidas do handoff. O texto vira termo de busca real — não é filtro decorativo. */
const CATEGORIES = ['Restaurantes', 'Postos', 'Estacionar'] as const

export function SearchScreen({ onBack, onPick, userPoint, initialQuery = '' }: SearchScreenProps) {
  const [query, setQuery] = useState(initialQuery)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [history, setHistory] = useState(() => listSearchHistory())
  const inputRef = useRef<HTMLInputElement>(null)

  const { suggestions, isLoading, error } = useAddressSuggestions(query)

  // Abre já com o teclado pronto — a tela existe para digitar um destino.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function selectCategory(category: string) {
    const next = activeCategory === category ? null : category
    setActiveCategory(next)
    setQuery(next ?? '')
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col bg-surface">
      {/* Cabeçalho recuado (surface-sunken), com o campo focado e a fila de categorias. */}
      {/*
        Cabeçalho da tela de busca (handoff tela 02): o campo mantém o MESMO
        aspecto visual da tela 01 — branco, hairline, sombra —, com a seta de
        voltar à esquerda e um botão circular de limpar. Trocar a aparência do
        campo entre as duas telas quebraria a continuidade do gesto de tocar
        nele e "entrar" na busca.
      */}
      <div className="flex shrink-0 flex-col gap-3 px-4 pb-3.5 pt-[max(0.75rem,var(--safe-top))]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-surface-card text-content-primary shadow-float transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
          >
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex h-[58px] flex-1 items-center gap-3 rounded-field border border-hairline/[.06] bg-surface-card pl-[18px] pr-2 shadow-field">
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveCategory(null)
              }}
              placeholder="Para onde você quer ir?"
              className="min-w-0 flex-1 bg-transparent text-field-text text-content-primary placeholder:text-content-tertiary focus:outline-none"
            />
            {/* Spinner NO CAMPO enquanto busca: é onde o olho já está, então o
                usuário percebe na hora que o app está procurando. Some assim
                que os resultados chegam, dando lugar ao botão de limpar. */}
            {isLoading ? (
              <span
                aria-label="Buscando"
                className="mr-3 h-[18px] w-[18px] shrink-0 animate-spin rounded-pill border-2 border-brand-500 border-t-transparent"
              />
            ) : (
              query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setActiveCategory(null)
                    inputRef.current?.focus()
                  }}
                  aria-label="Limpar"
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-pill bg-surface-tile-accent text-brand-500 transition-all duration-fast active:scale-[.97]"
                >
                  <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              )
            )}
          </div>
        </div>

        {/* Chip ativo em #0F1729 com texto branco; inativos brancos com hairline. */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {CATEGORIES.map((category) => {
            const selected = activeCategory === category
            return (
              <button
                key={category}
                type="button"
                onClick={() => selectCategory(category)}
                className={`shrink-0 rounded-pill px-4 py-2 text-[14px] font-bold transition-all duration-base ease-standard active:scale-[.97] ${
                  selected
                    ? 'bg-nav-surface text-white'
                    : 'border border-hairline/[.08] bg-surface-card text-content-secondary'
                }`}
              >
                {category}
              </button>
            )
          })}
        </div>
      </div>

      {/* Corpo: eyebrow "RESULTADOS" e as linhas em variante divider. */}
      <div className="flex-1 overflow-y-auto px-gutter pb-[max(1.5rem,var(--safe-bottom))] pt-gutter">
        {query.trim().length < 3 ? (
          // Sem busca ativa: mostra o histórico, para voltar a um destino recorrente sem digitar.
          history.length > 0 ? (
            <>
              <div className="mb-1 flex items-center justify-between">
                <SectionLabel>Pesquisas recentes</SectionLabel>
                <button
                  type="button"
                  onClick={() => {
                    clearSearchHistory()
                    setHistory([])
                  }}
                  className="text-caption font-bold text-brand-500 transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
                >
                  Limpar
                </button>
              </div>
              {history.map((entry) => (
                <div key={entry.id} className="relative">
                  <ListRow
                    divider
                    iconShape="circle"
                    tone="neutral"
                    icon={<ClockIcon />}
                    title={entry.label}
                    subtitle={entry.secondaryLabel}
                    onClick={() =>
                      onPick({ label: entry.label, secondaryLabel: entry.secondaryLabel, point: entry.point })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      removeSearchHistoryEntry(entry.id)
                      setHistory(listSearchHistory())
                    }}
                    aria-label={`Remover ${entry.label} do histórico`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-content-tertiary transition-all duration-fast active:scale-[.97] active:text-danger-500"
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          ) : (
            <p className="text-body text-content-secondary">
              Digite o nome de um lugar, endereço ou escolha uma categoria acima.
            </p>
          )
        ) : (
          <>
            {/* O eyebrow também comunica o estado: "BUSCANDO LUGARES…" enquanto
                a consulta corre, "RESULTADOS" quando ela termina. */}
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <SectionLabel>
                {isLoading ? <span className="text-brand-500">Buscando lugares…</span> : 'Resultados próximos'}
              </SectionLabel>
              {/* A distância de cada linha é EM LINHA RETA (Haversine), não pela
                  rota — medido: um destino a 14,5 km em linha reta dá ~16,9 km
                  de rota real (fator ~1,17). Dizer isso uma vez, no cabeçalho,
                  evita a sensação de que o número "mudou" depois do cálculo. */}
              {userPoint && suggestions.length > 0 && (
                <span className="shrink-0 text-caption text-content-tertiary">em linha reta</span>
              )}
            </div>

            {error && <p className="py-3 text-body text-warning-500">{error}</p>}

            {!isLoading && !error && suggestions.length === 0 && (
              <p className="py-3 text-body text-content-secondary">Nenhum resultado encontrado.</p>
            )}

            {suggestions.map((result) => (
              <ListRow
                key={`${result.point.lat},${result.point.lng}`}
                divider
                iconShape="circle"
                // Relógio + tom neutro distingue "já pesquisei isso antes" de
                // um resultado novo da busca. Quando o resultado tem categoria
                // conhecida, o ícone passa a ser o BADGE dela — o mesmo que o
                // lugar tem no mapa, então a lista e o mapa falam a mesma
                // língua e dá para distinguir farmácia de posto de relance.
                /**
                 * A CATEGORIA manda, inclusive no histórico.
                 *
                 * Antes a linha do histórico usava sempre o relógio, então o
                 * mesmo lugar aparecia com badge de farmácia quando era
                 * resultado novo e com relógio quando já tinha sido
                 * pesquisado — dois ícones para o mesmo estabelecimento.
                 *
                 * A informação "já pesquisei isso" continua na tela: estas
                 * linhas vêm agrupadas sob "Pesquisas recentes", no topo. O
                 * relógio fica para quem não tem categoria, que é onde ele
                 * ainda acrescenta algo.
                 */
                bareIcon={result.poiCategory != null}
                tone={result.fromHistory ? 'neutral' : 'accent'}
                icon={
                  result.poiCategory ? (
                    <img src={badgeUrl(result.poiCategory)} alt="" aria-hidden="true" className="h-11 w-11" />
                  ) : result.fromHistory ? (
                    <ClockIcon />
                  ) : (
                    <PinIcon />
                  )
                }
                title={result.label}
                subtitle={result.secondaryLabel}
                trailing={userPoint ? `≈${formatDistance(haversineDistanceMeters(userPoint, result.point))}` : undefined}
                onClick={() => onPick(result)}
              />
            ))}

            {/* Skeleton estático no fim da lista enquanto carrega — sem shimmer, como manda o handoff. */}
            {/* Dois skeletons quando a lista ainda está vazia (dá corpo à espera),
                um só quando já há resultados do histórico e faltam os externos. */}
            {isLoading && (
              <>
                <SkeletonRow />
                {suggestions.length === 0 && <SkeletonRow />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-card py-3">
      <div className="h-[52px] w-[52px] shrink-0 rounded-pill bg-surface-raised" />
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="h-3.5 w-[70%] rounded-pill bg-surface-raised" />
        <div className="h-3 w-[45%] rounded-pill bg-surface-raised" />
      </div>
    </div>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
