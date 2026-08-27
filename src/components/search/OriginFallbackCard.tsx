import { AddressAutocompleteInput } from '@/components/search/AddressAutocompleteInput'
import type { GeocodingResult } from '@/services/geocoding'

interface OriginFallbackCardProps {
  originText: string
  onOriginChange: (value: string) => void
  onSelectOrigin: (result: GeocodingResult) => void
  onRetryLocation: () => void
  message: string | null
}

/**
 * Estado SEM GPS da tela de exploração.
 *
 * O handoff desenha a tela 01 assumindo que a posição existe — não há campo de
 * origem em lugar nenhum. Mas negar a permissão é um estado real e frequente,
 * e sem um jeito de dizer de onde se está saindo o app fica inutilizável.
 *
 * Este card é a resposta a isso: aparece SÓ quando não há posição, some assim
 * que ela chega, e usa a linguagem visual nova (card branco, raio 20px,
 * hairline, tipografia do redesenho) em vez do painel antigo de origem →
 * destino, que duplicava o campo de busca e destoava do resto da tela.
 */
export function OriginFallbackCard({
  originText,
  onOriginChange,
  onSelectOrigin,
  onRetryLocation,
  message,
}: OriginFallbackCardProps) {
  return (
    <div className="pointer-events-auto rounded-xl border border-hairline/[.06] bg-surface-card p-card shadow-float">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-warning-text">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.9 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-content-secondary">
          {message ?? 'Sem acesso à sua localização. Informe de onde você está saindo.'}
        </p>
      </div>

      <div className="mt-3 rounded-field border border-hairline/[.08] bg-surface-sunken px-4 py-3">
        <AddressAutocompleteInput
          value={originText}
          placeholder="De onde você está saindo?"
          onChangeText={onOriginChange}
          onSelect={onSelectOrigin}
          variant="secondary"
          leftIcon={<span className="h-[9px] w-[9px] shrink-0 rounded-pill bg-brand-500" />}
        />
      </div>

      <button
        type="button"
        onClick={onRetryLocation}
        /*
          `-mx-2 py-3 px-2` leva o alvo de toque de 20px de altura para 44px sem
          mover o texto: a margem negativa devolve ao layout o que o padding
          horizontal tomou. Medido na auditoria — é o caminho de recuperação de
          quem está sem localização, o pior lugar para um alvo difícil de
          acertar.
        */
        className="-mx-2 mt-1 flex items-center gap-2 px-2 py-3 text-[13.5px] font-extrabold text-brand-500 transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
      >
        Tentar usar minha localização
      </button>
    </div>
  )
}
