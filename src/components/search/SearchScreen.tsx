import { useEffect, useRef, useState } from 'react'
import { Chip, ListRow, SectionLabel } from '@/components/ui/primitives'
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
      <div className="flex shrink-0 flex-col gap-card bg-surface-sunken px-gutter pb-card pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="flex shrink-0 items-center p-2 text-content-primary transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex h-[52px] flex-1 items-center gap-2.5 rounded-md border-2 border-brand-500 bg-surface-card px-3.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-pill bg-brand-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveCategory(null)
              }}
              placeholder="Para onde?"
              className="min-w-0 flex-1 bg-transparent text-[17px] font-bold text-content-primary placeholder:text-content-tertiary focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveCategory(null)
                  inputRef.current?.focus()
                }}
                aria-label="Limpar"
                className="shrink-0 text-content-tertiary transition-colors active:text-content-primary"
              >
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-stack overflow-x-auto">
          {CATEGORIES.map((category) => (
            <Chip key={category} selected={activeCategory === category} onClick={() => selectCategory(category)}>
              {category}
            </Chip>
          ))}
        </div>
      </div>

      {/* Corpo: eyebrow "RESULTADOS" e as linhas em variante divider. */}
      <div className="flex-1 overflow-y-auto px-gutter pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-gutter">
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
            <SectionLabel className="mb-1">Resultados</SectionLabel>

            {error && <p className="py-3 text-body text-warning-500">{error}</p>}

            {!isLoading && !error && suggestions.length === 0 && (
              <p className="py-3 text-body text-content-secondary">Nenhum resultado encontrado.</p>
            )}

            {suggestions.map((result) => (
              <ListRow
                key={`${result.point.lat},${result.point.lng}`}
                divider
                iconShape="circle"
                // Relógio + tom neutro distingue "já pesquisei isso antes" de um resultado novo da busca.
                tone={result.fromHistory ? 'neutral' : 'accent'}
                icon={result.fromHistory ? <ClockIcon /> : <PinIcon />}
                title={result.label}
                subtitle={result.secondaryLabel}
                trailing={userPoint ? formatDistance(haversineDistanceMeters(userPoint, result.point)) : undefined}
                onClick={() => onPick(result)}
              />
            ))}

            {/* Skeleton estático no fim da lista enquanto carrega — sem shimmer, como manda o handoff. */}
            {isLoading && <SkeletonRow />}
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
