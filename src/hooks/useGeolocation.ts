import { useCallback, useEffect, useRef, useState } from 'react'
import type { LngLat } from '@/config/region'
import { nativeBridge, subscribeNativeLocation, type NativeLocationSample } from '@/native/nativeBridge'

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface GeolocationSample {
  position: LngLat
  /** Raio de incerteza reportado pelo dispositivo, em metros. */
  accuracyMeters: number
  /** Velocidade instantânea reportada pelo GPS, em m/s — null quando o dispositivo não fornece (comum em desktop/baixa precisão). */
  speedMps: number | null
  headingDeg: number | null
  timestamp: number
}

interface GeolocationState {
  sample: GeolocationSample | null
  isLocating: boolean
  error: string | null
  permission: LocationPermissionState
}

/** Acima disso, a posição é pouco confiável para navegação turn-by-turn — tratar como "carregando/impreciso", nunca como certeza. */
export const LOW_ACCURACY_THRESHOLD_METERS = 50

/**
 * Localização do usuário — suporta tanto uma leitura pontual (`locate`,
 * usado para preencher "minha localização atual" na busca) quanto
 * rastreamento contínuo (`startWatching`/`stopWatching`, usado durante a
 * navegação ativa). Expõe também o estado de permissão do navegador, quando
 * a Permissions API está disponível (nem todo Safari/iOS suporta consultá-la
 * — nesse caso `permission` fica 'unknown' até a primeira tentativa real).
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    sample: null,
    isLocating: false,
    error: null,
    permission: 'unknown',
  })
  const watchIdRef = useRef<number | null>(null)
  /** Encerra o serviço de localização do app Android (só existe lá). */
  const nativeStopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!('permissions' in navigator) || !navigator.permissions?.query) return

    let permissionStatus: PermissionStatus | null = null
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        permissionStatus = status
        setState((prev) => ({ ...prev, permission: status.state as LocationPermissionState }))
        status.onchange = () => setState((prev) => ({ ...prev, permission: status.state as LocationPermissionState }))
      })
      .catch(() => {
        // Permissions API indisponível para 'geolocation' neste navegador — segue sem essa informação prévia.
      })

    return () => {
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  const handleSuccess = useCallback((result: GeolocationPosition) => {
    setState((prev) => ({
      ...prev,
      isLocating: false,
      error: null,
      permission: 'granted',
      sample: {
        position: { lng: result.coords.longitude, lat: result.coords.latitude },
        accuracyMeters: result.coords.accuracy,
        speedMps: result.coords.speed,
        headingDeg: result.coords.heading,
        timestamp: result.timestamp,
      },
    }))
  }, [])

  const handleError = useCallback((geoError: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      isLocating: false,
      permission: geoError.code === geoError.PERMISSION_DENIED ? 'denied' : prev.permission,
      error: describeGeolocationError(geoError),
    }))
  }, [])

  /**
   * Posição vinda do serviço em segundo plano do app Android.
   *
   * Só vale com o app ESCONDIDO. Com ele na tela, quem lê a posição é o próprio
   * navegador (melhor combinação de GPS e rede, já testada); ouvir os dois ao
   * mesmo tempo misturaria duas fontes de precisão diferente e a posição
   * tremeria. O navegador deixa de entregar leituras quando o app vai para
   * segundo plano — é aí que esta entra.
   */
  const handleNativeSample = useCallback((native: NativeLocationSample) => {
    if (document.visibilityState !== 'hidden') return
    setState((prev) => ({
      ...prev,
      isLocating: false,
      error: null,
      permission: 'granted',
      sample: {
        position: { lng: native.lng, lat: native.lat },
        accuracyMeters: native.accuracyMeters ?? 15,
        speedMps: native.speedMps,
        headingDeg: native.headingDeg,
        timestamp: native.timestamp,
      },
    }))
  }, [])

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, permission: 'unsupported', error: 'Geolocalização não é suportada neste navegador.' }))
      return
    }
    setState((prev) => ({ ...prev, isLocating: true, error: null }))
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, { enableHighAccuracy: true, timeout: 10000 })
  }, [handleSuccess, handleError])

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, permission: 'unsupported', error: 'Geolocalização não é suportada neste navegador.' }))
      return
    }
    if (watchIdRef.current !== null) return

    setState((prev) => ({ ...prev, isLocating: true, error: null }))
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      // `maximumAge: 2000` autorizava o navegador a devolver uma posição de
      // até 2 segundos atrás — e ele devolve, para poupar bateria. Numa
      // desaceleração isso é meia frenagem de atraso na velocidade exibida.
      // 0 obriga leitura nova a cada amostra.
      maximumAge: 0,
      timeout: 15000,
    })

    // App Android: liga também o serviço em segundo plano (com aviso fixo na
    // barra), para a navegação continuar com a tela apagada ou com outro app na frente.
    if (nativeBridge && nativeStopRef.current === null) {
      let started = false
      try {
        started = nativeBridge.startTracking()
      } catch {
        // a ponte falhou: segue só com a leitura do navegador
      }
      if (started) {
        const unsubscribe = subscribeNativeLocation(handleNativeSample)
        nativeStopRef.current = () => {
          unsubscribe()
          try {
            nativeBridge?.stopTracking()
          } catch {
            // nada a fazer: o serviço para junto com o app
          }
        }
      }
    }
  }, [handleSuccess, handleError, handleNativeSample])

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (nativeStopRef.current) {
      nativeStopRef.current()
      nativeStopRef.current = null
    }
  }, [])

  useEffect(() => stopWatching, [stopWatching])

  return { ...state, locate, startWatching, stopWatching }
}

function describeGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Precisamos da sua localização para calcular sua rota. Permita o acesso à localização nas configurações do navegador.'
    case error.POSITION_UNAVAILABLE:
      return 'Não foi possível obter sua localização agora. Verifique se o GPS/localização do dispositivo está ativado.'
    case error.TIMEOUT:
      return 'A localização demorou demais para responder. Tente sair para uma área aberta e tentar novamente.'
    default:
      return 'Não foi possível obter sua localização atual.'
  }
}
