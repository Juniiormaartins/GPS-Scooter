import { useState, type ReactNode } from 'react'
import { useAddressSuggestions } from '@/hooks/useAddressSuggestions'
import type { GeocodingResult } from '@/services/geocoding'

interface AddressAutocompleteInputProps {
  value: string
  placeholder: string
  onChangeText: (text: string) => void
  onSelect: (result: GeocodingResult) => void
  leftIcon?: ReactNode
  rightAdornment?: ReactNode
  /**
   * 'primary'   — linha de destaque ("Para onde?"): texto maior, em negrito, sem caixa.
   * 'secondary' — linha auxiliar ("Sua localização"): texto menor e discreto, sem caixa.
   * 'boxed'     — campo com fundo/pílula próprio (usado fora do card principal de busca).
   */
  variant?: 'primary' | 'secondary' | 'boxed'
}

const VARIANT_ROW: Record<NonNullable<AddressAutocompleteInputProps['variant']>, string> = {
  primary: 'flex items-center gap-2.5 py-0.5',
  secondary: 'flex items-center gap-2.5 py-0.5',
  boxed: 'flex items-center gap-2 rounded-full border border-white/5 bg-surface-raised px-4 py-3 transition-colors has-[input:focus]:border-brand-400/60',
}

const VARIANT_INPUT: Record<NonNullable<AddressAutocompleteInputProps['variant']>, string> = {
  primary: 'w-full bg-transparent text-lg font-bold text-slate-100 placeholder:text-slate-100 focus:outline-none',
  secondary: 'w-full bg-transparent text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none',
  boxed: 'w-full bg-transparent text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none',
}

/**
 * Campo de origem/destino com sugestões em tempo real (useAddressSuggestions).
 * O dropdown some ao perder foco, com um pequeno atraso (onBlur dispara antes
 * do onClick da sugestão — o timeout garante que o clique seja processado
 * primeiro; é o padrão mínimo necessário para um combobox simples em React,
 * não uma biblioteca completa).
 */
export function AddressAutocompleteInput({
  value,
  placeholder,
  onChangeText,
  onSelect,
  leftIcon,
  rightAdornment,
  variant = 'boxed',
}: AddressAutocompleteInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [suppressDropdown, setSuppressDropdown] = useState(false)
  const { suggestions, isLoading, error } = useAddressSuggestions(isFocused && !suppressDropdown ? value : '')
  const showDropdown = isFocused && !suppressDropdown && value.trim().length >= 3

  return (
    <div className="relative">
      <div className={VARIANT_ROW[variant]}>
        {leftIcon}
        <input
          value={value}
          onChange={(e) => {
            setSuppressDropdown(false)
            onChangeText(e.target.value)
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder={placeholder}
          className={VARIANT_INPUT[variant]}
        />
        {rightAdornment}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-white/5 bg-surface-card py-1 shadow-floating">
          {isLoading && <p className="px-4 py-3 text-sm text-slate-400">Buscando…</p>}
          {!isLoading && error && <p className="px-4 py-3 text-sm text-warning-400">{error}</p>}
          {!isLoading && !error && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-400">Nenhum resultado encontrado.</p>
          )}
          {!isLoading &&
            suggestions.map((result) => (
              <button
                key={`${result.point.lat},${result.point.lng}`}
                type="button"
                onClick={() => {
                  setSuppressDropdown(true)
                  onSelect(result)
                }}
                className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left active:bg-white/5"
              >
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-100">{result.label}</span>
                  {result.secondaryLabel && <span className="block truncate text-xs text-slate-500">{result.secondaryLabel}</span>}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
