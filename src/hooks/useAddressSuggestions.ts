import { useEffect, useRef, useState } from 'react'
import { getGeocodingProvider, type GeocodingResult } from '@/services/geocoding'
import { matchSearchHistory } from '@/services/storage/searchHistory'
import { haversineDistanceMeters } from '@/utils/geo'

/**
 * Autocomplete de endereços sobre o mesmo provedor de geocodificação já
 * usado no resto do app (services/geocoding.ts — Nominatim por padrão). Não
 * cria um serviço separado.
 *
 * Cuidados deliberados por causa da política de uso do Nominatim
 * (https://operations.osmfoundation.org/policies/nominatim/, que pede no
 * máximo ~1 requisição/segundo e desaconselha autocomplete sem debounce):
 * - só busca a partir de MIN_QUERY_LENGTH caracteres;
 * - aguarda DEBOUNCE_MS sem digitação antes de disparar a busca (nunca uma
 *   requisição por tecla);
 * - ignora respostas que chegam depois de uma busca mais recente já ter
 *   começado (evita "flicker" com resultado desatualizado).
 * Se o volume de uso crescer, o ponto de troca é getGeocodingProvider() —
 * um provedor com um plano de autocomplete adequado (ex: a Geocoding API do
 * MapTiler, mesma chave já usada para o mapa) entra ali sem tocar neste hook.
 */

const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 400

/** Distância abaixo da qual um resultado externo é considerado o mesmo lugar de uma entrada do histórico. */
const HISTORY_DEDUPE_METERS = 40

export function useAddressSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      requestIdRef.current += 1
      setSuggestions([])
      setIsLoading(false)
      setError(null)
      return
    }

    // O histórico é local e casa por prefixo de palavra, então aparece
    // IMEDIATAMENTE — sem debounce e sem esperar rede. É o que resolve o caso
    // "digitei 'Pos' e quero o Posto Líder que já pesquisei", que os
    // provedores externos só resolvem com o nome quase completo.
    const historyMatches: GeocodingResult[] = matchSearchHistory(trimmed).map((entry) => ({
      label: entry.label,
      secondaryLabel: entry.secondaryLabel,
      point: entry.point,
      fromHistory: true,
    }))
    setSuggestions(historyMatches)

    setIsLoading(true)
    setError(null)
    const requestId = ++requestIdRef.current

    const timeoutId = setTimeout(() => {
      getGeocodingProvider()
        .search(trimmed)
        .then((results) => {
          if (requestIdRef.current !== requestId) return // resposta obsoleta — uma busca mais nova já está em andamento
          // Histórico primeiro; resultados externos que apontam para o mesmo
          // lugar são descartados para não duplicar a linha na lista.
          const withoutDuplicates = results.filter(
            (result) => !historyMatches.some((entry) => haversineDistanceMeters(entry.point, result.point) < HISTORY_DEDUPE_METERS),
          )
          setSuggestions([...historyMatches, ...withoutDuplicates])
          setIsLoading(false)
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return
          // Mantém o que veio do histórico: uma falha de rede não pode apagar
          // sugestões que já estavam corretas e são locais.
          setSuggestions(historyMatches)
          if (historyMatches.length === 0) setError('Não foi possível buscar sugestões agora.')
          setIsLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeoutId)
  }, [query])

  return { suggestions, isLoading, error }
}
