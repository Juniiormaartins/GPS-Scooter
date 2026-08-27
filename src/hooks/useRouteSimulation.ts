import { useEffect, useRef, useState } from 'react'
import { haversineDistanceMeters } from '@/utils/geo'
import type { GeolocationSample } from '@/hooks/useGeolocation'
import type { CandidateRoute } from '@/types/routing'
import type { LngLat } from '@/config/region'

/**
 * SIMULAÇÃO DE PERCURSO — posição que anda sozinha sobre a rota.
 *
 * POR QUE EXISTE. Trocar o ponto de partida à mão serve para testar um trajeto
 * a partir de outro lugar. Mas iniciar a navegação nesse estado, com a posição
 * vindo do GPS real, produz um absurdo: o app compara onde o usuário de fato
 * está com uma rota que começa a quilômetros dali, conclui "saiu da rota" no
 * primeiro segundo e recalcula tudo — jogando fora justamente o trajeto que se
 * queria examinar.
 *
 * Com partida manual, portanto, a posição também é simulada. É a única leitura
 * coerente: se a origem é hipotética, o percurso a partir dela também é.
 *
 * O QUE ISTO NÃO É: um "modo demo" com dados inventados. A rota é real
 * (calculada pelo mesmo pipeline), as vias são reais, as manobras e os alertas
 * de trecho são os mesmos da navegação de verdade. O único dado sintético é a
 * posição — e a interface diz isso com todas as letras enquanto durar.
 */

/** Passo do relógio da simulação. 1 Hz imita a cadência típica de um GPS. */
const TICK_MS = 1000

interface Options {
  route: CandidateRoute | null
  active: boolean
  /** Velocidade de cruzeiro da simulação, em km/h — a de referência do veículo. */
  speedKmh: number
}

export function useRouteSimulation({ route, active, speedKmh }: Options): GeolocationSample | null {
  const [sample, setSample] = useState<GeolocationSample | null>(null)
  const distanciaRef = useRef(0)
  const rotaIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!active || !route || route.geometry.length < 2) {
      setSample(null)
      return
    }

    // Rota nova: recomeça do zero. Sem isto, escolher outra alternativa
    // continuaria de onde a anterior parou, num ponto que pode nem existir na
    // geometria nova.
    if (rotaIdRef.current !== route.id) {
      rotaIdRef.current = route.id
      distanciaRef.current = 0
    }

    const pontos = route.geometry
    const acumulado = [0]
    for (let i = 1; i < pontos.length; i += 1) {
      acumulado.push(acumulado[i - 1] + haversineDistanceMeters(pontos[i - 1], pontos[i]))
    }
    const total = acumulado[acumulado.length - 1]

    /** Ponto a `metros` do início, interpolado dentro do segmento correspondente. */
    const em = (metros: number): { ponto: LngLat; rumo: number } => {
      const limitado = Math.max(0, Math.min(total, metros))
      let i = 1
      while (i < pontos.length - 1 && acumulado[i] < limitado) i += 1
      const anterior = pontos[i - 1]
      const proximo = pontos[i]
      const trecho = acumulado[i] - acumulado[i - 1]
      const fracao = trecho > 0 ? (limitado - acumulado[i - 1]) / trecho : 0
      return {
        ponto: {
          lng: anterior.lng + (proximo.lng - anterior.lng) * fracao,
          lat: anterior.lat + (proximo.lat - anterior.lat) * fracao,
        },
        rumo: rumoEntre(anterior, proximo),
      }
    }

    const metrosPorTick = (Math.max(1, speedKmh) / 3.6) * (TICK_MS / 1000)

    const emitir = () => {
      const { ponto, rumo } = em(distanciaRef.current)
      setSample({
        position: ponto,
        /*
          Precisão de 5 m: a simulação é exata, mas devolver 0 faria a interface
          exibir uma confiança que nenhum GPS entrega. 5 m é a leitura de um
          aparelho em boas condições — coerente com o que o resto do app espera.
        */
        accuracyMeters: 5,
        speedMps: metrosPorTick / (TICK_MS / 1000),
        headingDeg: rumo,
        timestamp: Date.now(),
      })
    }

    emitir()
    const timer = setInterval(() => {
      // Para no destino em vez de passar dele — quem chega, chegou.
      distanciaRef.current = Math.min(total, distanciaRef.current + metrosPorTick)
      emitir()
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [active, route, speedKmh])

  return sample
}

function rumoEntre(de: LngLat, para: LngLat): number {
  const rad = Math.PI / 180
  const y = Math.sin((para.lng - de.lng) * rad) * Math.cos(para.lat * rad)
  const x =
    Math.cos(de.lat * rad) * Math.sin(para.lat * rad) -
    Math.sin(de.lat * rad) * Math.cos(para.lat * rad) * Math.cos((para.lng - de.lng) * rad)
  return (Math.atan2(y, x) / rad + 360) % 360
}
