import { useEffect, useRef, useState } from 'react'
import { adoptLatePoiCategories, getGeocodingProvider, type GeocodingResult } from '@/services/geocoding'
import { matchSearchHistory } from '@/services/storage/searchHistory'
import type { LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'
import { parseCoordinateQuery } from '@/native/incomingDestination'

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

/**
 * Junta o histórico (primeiro) com os resultados externos, sem repetir o mesmo
 * lugar. O histórico SOMBREIA o resultado externo do mesmo lugar — e o externo
 * pode ser o único dos dois que sabe a categoria (entradas antigas do histórico
 * foram gravadas antes de existir `poiCategory`): antes de descartar, o
 * histórico adota o que falta, senão o mesmo lugar aparece com badge quando é
 * novo e com alfinete quando já foi pesquisado.
 */
function mergeWithHistory(historyMatches: GeocodingResult[], results: GeocodingResult[]): GeocodingResult[] {
  const withoutDuplicates = results.filter((result) => {
    const sombreado = historyMatches.find(
      (entry) => haversineDistanceMeters(entry.point, result.point) < HISTORY_DEDUPE_METERS,
    )
    if (!sombreado) return true
    if (sombreado.poiCategory == null && result.poiCategory != null) {
      sombreado.poiCategory = result.poiCategory
    }
    return false
  })
  return [...historyMatches, ...withoutDuplicates]
}

export function useAddressSuggestions(query: string, near: LngLat | null = null) {
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  // A posição vai por REF, não por dependência do efeito: o GPS atualiza a
  // cada segundo, e refazer a busca a cada atualização seria bombardear os
  // provedores (o Nominatim público pede no máximo ~1 requisição/s).
  const nearRef = useRef(near)
  nearRef.current = near

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      requestIdRef.current += 1
      setSuggestions([])
      setIsLoading(false)
      setError(null)
      return
    }

    // Endereço colado já com a coordenada ("...@-16.74,-49.25", como o iFood manda):
    // o ponto é exato, não há o que buscar na rede.
    const direct = parseCoordinateQuery(trimmed)
    if (direct) {
      requestIdRef.current += 1
      setSuggestions([{ label: direct.label, secondaryLabel: 'Coordenada exata', point: direct.point }])
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
      poiCategory: entry.poiCategory,
      fromHistory: true,
    }))
    setSuggestions(historyMatches)

    setIsLoading(true)
    setError(null)
    const requestId = ++requestIdRef.current

    const timeoutId = setTimeout(() => {
      getGeocodingProvider()
        .search(trimmed, {
          near: nearRef.current,
          /*
            LISTA PROGRESSIVA. As fontes respondem em tempos muito diferentes: o
            Nominatim em ~1 s, a busca por categoria no Overpass em 10–30 s.
            Antes a lista só aparecia quando a mais lenta terminava (ou
            estourava o teto e era descartada); agora aparece com o que já
            chegou e vai se REORDENANDO — a farmácia da esquina entra na
            posição certa quando o Overpass responde, sem a tela esperar.
          */
          onPartial: (parcial) => {
            if (requestIdRef.current !== requestId) return
            setSuggestions(mergeWithHistory(historyMatches, parcial))
          },
        })
        .then((results) => {
          if (requestIdRef.current !== requestId) return // resposta obsoleta — uma busca mais nova já está em andamento
          const lista = mergeWithHistory(historyMatches, results)
          setSuggestions(lista)
          setIsLoading(false)

          /**
           * SEGUNDA PASSADA das categorias.
           *
           * A lista já está na tela; isto só troca alfinete por badge nas
           * linhas cuja categoria chegou atrasada (ver
           * `adoptLatePoiCategories`). Sem `setIsLoading` de novo: para o
           * usuário a busca terminou, e reacender o esqueleto por causa de um
           * ícone seria mentir sobre o estado.
           *
           * `requestIdRef` é conferido OUTRA VEZ aqui porque esta parte
           * demora segundos — nesse tempo o usuário pode ter digitado mais, e
           * pintar badge numa lista que não existe mais é pior que não pintar.
           */
          adoptLatePoiCategories(lista, trimmed)
            .then((mudou) => {
              if (!mudou || requestIdRef.current !== requestId) return
              setSuggestions([...lista])
            })
            .catch(() => {
              // Categoria é enfeite informativo; falhar aqui não muda a lista.
            })
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
