import { useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { AddressAutocompleteInput } from '@/components/search/AddressAutocompleteInput'
import { Icon } from '@/components/ui/Icon'
import { ListRow, SectionLabel } from '@/components/ui/primitives'
import type { GeocodingResult } from '@/services/geocoding'
import {
  listSavedPlaces,
  removeSavedPlace,
  saveSinglePlace,
  type SavedPlace,
} from '@/services/storage/savedPlaces'

interface SavedPanelProps {
  onClose: () => void
  onTraceRoute: (place: SavedPlace) => void
}

type SlotKind = 'home' | 'work'

const SLOT_LABEL: Record<SlotKind, string> = { home: 'Casa', work: 'Trabalho' }

/**
 * Tela "Salvos": dois atalhos lado a lado (Casa / Trabalho) e, abaixo, a lista
 * de favoritos.
 *
 * O BOTÃO QUE NÃO FUNCIONAVA. Os cartões Casa e Trabalho mostravam "Definir
 * endereço" em azul, com cara de link — e estavam `disabled` quando não havia
 * endereço. Ou seja: o único jeito de preencher o cartão era um botão que não
 * respondia. `saveSinglePlace` existia desde o início e nunca era chamada, então
 * Casa e Trabalho NÃO PODIAM SER DEFINIDOS por caminho nenhum do app.
 *
 * Agora tocar no cartão vazio abre o seletor de endereço, e um cartão preenchido
 * ganha "Alterar". É o atalho que mais pesa para quem faz o mesmo trajeto todo
 * dia: ir para casa passa a ser um toque.
 */
export function SavedPanel({ onClose, onTraceRoute }: SavedPanelProps) {
  const [places, setPlaces] = useState(listSavedPlaces())
  const [editing, setEditing] = useState<SlotKind | null>(null)
  const [query, setQuery] = useState('')

  function handleRemove(id: string) {
    removeSavedPlace(id)
    setPlaces(listSavedPlaces())
  }

  function startEditing(kind: SlotKind) {
    setQuery('')
    setEditing(kind)
  }

  function handlePick(result: GeocodingResult) {
    if (!editing) return
    saveSinglePlace(editing, result.label, result.secondaryLabel, result.point)
    setPlaces(listSavedPlaces())
    setEditing(null)
    setQuery('')
  }

  const home = places.find((place) => place.kind === 'home')
  const work = places.find((place) => place.kind === 'work')
  const favorites = places.filter((place) => place.kind === 'favorite')

  return (
    <Panel title="Salvos" onClose={onClose}>
      {editing && (
        <div className="mb-group rounded-xl border-2 border-brand-500 bg-surface-card p-4 shadow-tile">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-row-title text-content-primary">Endereço de {SLOT_LABEL[editing]}</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              aria-label="Cancelar"
              className="-m-2 flex h-9 w-9 items-center justify-center text-content-tertiary active:scale-[.97]"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <AddressAutocompleteInput
            value={query}
            placeholder={editing === 'home' ? 'Rua, número, bairro…' : 'Onde você trabalha?'}
            onChangeText={setQuery}
            onSelect={handlePick}
            autoFocus
            leftIcon={<Icon name="search" size={18} className="text-brand-500" />}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-stack">
        <QuickSlot kind="home" place={home} onTraceRoute={onTraceRoute} onEdit={() => startEditing('home')} />
        <QuickSlot kind="work" place={work} onTraceRoute={onTraceRoute} onEdit={() => startEditing('work')} />
      </div>

      <SectionLabel className="mb-stack mt-group">Locais favoritos</SectionLabel>

      {favorites.length === 0 ? (
        <EmptyHint
          icon="star"
          title="Nenhum favorito ainda"
          text='Pesquise um destino, abra a ficha do local e toque em "Salvar" para guardá-lo aqui.'
        />
      ) : (
        <div className="flex flex-col gap-stack">
          {favorites.map((place) => (
            <div key={place.id} className="relative">
              <ListRow
                icon={<Icon name="star" size={22} active />}
                tone="warn"
                title={place.label}
                subtitle={place.secondaryLabel}
                chevron
                onClick={() => onTraceRoute(place)}
              />
              <button
                type="button"
                onClick={() => handleRemove(place.id)}
                aria-label={`Remover ${place.label}`}
                className="absolute right-11 top-1/2 -translate-y-1/2 p-2 text-content-tertiary transition-all duration-fast active:scale-[.97] active:text-danger-500"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

/** Atalho Casa/Trabalho. Vazio: toca para definir. Preenchido: toca para ir, "Alterar" para trocar. */
function QuickSlot({
  kind,
  place,
  onTraceRoute,
  onEdit,
}: {
  kind: SlotKind
  place: SavedPlace | undefined
  onTraceRoute: (place: SavedPlace) => void
  onEdit: () => void
}) {
  const label = SLOT_LABEL[kind]

  return (
    <div className="flex flex-col rounded-xl border border-hairline/10 bg-surface-card shadow-tile">
      <button
        type="button"
        onClick={() => (place ? onTraceRoute(place) : onEdit())}
        className="flex flex-1 flex-col items-start gap-3 p-4 text-left transition-all duration-fast ease-standard active:opacity-[.88]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-500/[.14] text-brand-500">
          <Icon name={kind} size={24} active />
        </span>
        <span className="w-full">
          <span className="block text-row-title text-content-primary">{label}</span>
          <span className={`mt-0.5 block truncate text-[14px] ${place ? 'text-content-secondary' : 'font-bold text-brand-500'}`}>
            {place ? place.label : 'Definir endereço'}
          </span>
        </span>
      </button>

      {place && (
        <button
          type="button"
          onClick={onEdit}
          className="border-t border-hairline/[.07] px-4 py-2.5 text-left text-[13px] font-bold text-brand-500 transition-all duration-fast active:opacity-[.88]"
        >
          Alterar
        </button>
      )}
    </div>
  )
}

/** Estado vazio: ícone, título e uma frase que diz o que fazer — não um parágrafo solto. */
function EmptyHint({ icon, title, text }: { icon: 'star' | 'route'; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-hairline/[.18] px-6 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-warning-500/[.16] text-warning-text">
        <Icon name={icon} size={24} active />
      </span>
      <p className="mt-3 text-row-title text-content-primary">{title}</p>
      <p className="mt-1 max-w-[260px] text-[14px] font-semibold leading-snug text-content-secondary">{text}</p>
    </div>
  )
}
