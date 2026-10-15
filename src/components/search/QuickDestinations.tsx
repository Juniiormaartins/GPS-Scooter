import { Icon } from '@/components/ui/Icon'
import type { SavedPlace } from '@/services/storage/savedPlaces'

interface QuickDestinationsProps {
  places: SavedPlace[]
  /** Traça a rota até o lugar salvo. */
  onGo: (place: SavedPlace) => void
  /** Abre Salvos para definir o endereço que ainda não existe. */
  onSetup: () => void
}

const KINDS = [
  { kind: 'home' as const, label: 'Casa', setup: 'Adicionar casa' },
  { kind: 'work' as const, label: 'Trabalho', setup: 'Adicionar trabalho' },
]

/**
 * Atalhos de um toque logo abaixo da busca.
 *
 * Quem usa o veículo todo dia faz, em sua maioria, dois trajetos: de casa para
 * o trabalho e de volta. Digitar o endereço toda vez — ou abrir Salvos, tocar e
 * esperar — é o atrito que mais se repete num app de GPS. Aqui ir para casa é
 * um toque, de qualquer lugar.
 *
 * O que ainda não existe aparece como chip tracejado "Adicionar…" em vez de
 * sumir: o atalho só passa a valer depois de definido, e esconder a opção
 * esconderia também o caminho para configurá-la.
 */
export function QuickDestinations({ places, onGo, onSetup }: QuickDestinationsProps) {
  return (
    <div className="pointer-events-none flex gap-2">
      {KINDS.map(({ kind, label, setup }) => {
        const place = places.find((entry) => entry.kind === kind)
        return (
          <button
            key={kind}
            type="button"
            onClick={() => (place ? onGo(place) : onSetup())}
            className={`pointer-events-auto flex min-w-0 items-center gap-2 rounded-pill px-3.5 py-2 text-[14px] font-bold shadow-float backdrop-blur-xl transition-all duration-fast ease-standard active:scale-[.97] ${
              place
                ? 'border border-hairline/[.08] bg-surface-overlay text-content-primary'
                : 'border border-dashed border-hairline/[.22] bg-surface-overlay text-content-secondary'
            }`}
          >
            <Icon name={kind} size={18} active={!!place} className={place ? 'text-brand-500' : 'text-content-tertiary'} />
            <span className="truncate">{place ? label : setup}</span>
          </button>
        )
      })}
    </div>
  )
}
