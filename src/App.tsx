import { useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from '@/components/map/MapView'
import { SearchPanel } from '@/components/search/SearchPanel'
import { PoiCard } from '@/components/search/PoiCard'
import { MapControls } from '@/components/controls/MapControls'
import { RoutePanel, RouteSummary } from '@/components/route/RoutePanel'
import { BottomSheet, type SheetSnapPoint } from '@/components/route/BottomSheet'
import { BottomNavBar } from '@/components/layout/BottomNavBar'
import { VehicleStatusBar } from '@/components/layout/VehicleStatusBar'
import { NavigationPanel } from '@/components/navigation/NavigationPanel'
import { ProfilePanel } from '@/components/panels/ProfilePanel'
import { SavedPanel } from '@/components/panels/SavedPanel'
import { ActivityPanel } from '@/components/panels/ActivityPanel'
import { useGeolocation, LOW_ACCURACY_THRESHOLD_METERS } from '@/hooks/useGeolocation'
import { useNavigationSession } from '@/hooks/useNavigationSession'
import { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'
import { isPointWithinRegion, SUPPORTED_REGION, type LngLat } from '@/config/region'
import { isGeocodingConfigured, isMapConfigured, isRoutingConfigured } from '@/config/env'
import { planRoute } from '@/services/routing'
import { getGeocodingProvider, type GeocodingResult } from '@/services/geocoding'
import { saveFavorite, listSavedPlaces, type SavedPlace } from '@/services/storage/savedPlaces'
import { recordActivity } from '@/services/storage/activityHistory'
import type { RouteResult } from '@/types/routing'

type ActivePanel = 'profile' | 'saved' | 'activity' | null

/** Texto do campo de origem quando a localização atual está em uso mas a geocodificação reversa ainda não resolveu (ou falhou). */
const CURRENT_LOCATION_LABEL = 'Minha localização atual'

export default function App() {
  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [originPoint, setOriginPoint] = useState<LngLat | null>(null)
  const [destinationPoint, setDestinationPoint] = useState<LngLat | null>(null)
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isFollowingUser, setIsFollowingUser] = useState(true)
  const [sheetSnap, setSheetSnap] = useState<SheetSnapPoint>('half')
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [selectedPoi, setSelectedPoi] = useState<GeocodingResult | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(
    isMapConfigured ? null : 'Mapa em modo demonstração — configure VITE_MAP_STYLE_URL no .env para produção.',
  )

  const { sample, isLocating, locate, error: locationError, permission } = useGeolocation()
  // Vivendo em App.tsx (não dentro do ProfilePanel) para a conexão persistir
  // entre navegação de painéis e alimentar o NavigationPanel com bateria real quando disponível.
  const vehicleBluetooth = useVehicleBluetooth()
  const userPosition = sample?.position ?? null
  const [followUserAsOrigin, setFollowUserAsOrigin] = useState(false)
  const [pendingCenter, setPendingCenter] = useState(false)
  const [centerToken, setCenterToken] = useState(0)
  const [pendingTraceDestination, setPendingTraceDestination] = useState<{ text: string; point: LngLat } | null>(null)

  // Localização automática ao abrir o app: o usuário não deveria precisar
  // tocar no botão só para o GPS Scooter descobrir onde ele está. Dispara no
  // máximo uma vez por sessão (hasAutoLocatedRef) e nunca insiste se a
  // permissão já está negada — evita prompts repetidos e chamadas
  // desnecessárias de geolocalização.
  const hasAutoLocatedRef = useRef(false)
  useEffect(() => {
    if (hasAutoLocatedRef.current || sample || isLocating) return
    if (permission === 'denied') return

    const triggerAutoLocate = () => {
      if (hasAutoLocatedRef.current) return
      hasAutoLocatedRef.current = true
      setFollowUserAsOrigin(true)
      setPendingCenter(true)
      setOriginText('Localizando…')
      locate()
    }

    if (permission === 'unknown') {
      // Permissions API pode não existir neste navegador (alguns Safari) —
      // dá uma janela curta para a consulta assíncrona resolver antes de
      // tentar mesmo assim, para não disparar antes de saber se está negada.
      const timer = setTimeout(triggerAutoLocate, 400)
      return () => clearTimeout(timer)
    }

    triggerAutoLocate()
  }, [permission, sample, isLocating, locate])

  // Quando a posição chega após um pedido pendente (botão "minha localização",
  // seja o da barra de busca ou o flutuante do mapa): preenche origem +
  // dispara a centralização de disparo único no MapView. O texto do campo
  // usa geocodificação reversa (endereço aproximado); se falhar ou demorar,
  // fica com CURRENT_LOCATION_LABEL — nunca em branco.
  useEffect(() => {
    if (!pendingCenter || !userPosition) return

    setCenterToken((token) => token + 1)
    setPendingCenter(false)

    if (followUserAsOrigin) {
      setOriginPoint(userPosition)
      setOriginText(CURRENT_LOCATION_LABEL)

      if (pendingTraceDestination) {
        // "Traçar rota" de um POI/salvo estava esperando a localização — completa sozinho, sem exigir toque manual.
        const destination = pendingTraceDestination
        setPendingTraceDestination(null)
        setStatusMessage(null)
        calculateRoute({ text: CURRENT_LOCATION_LABEL, point: userPosition }, destination)
      }

      getGeocodingProvider()
        .reverseGeocode(userPosition)
        .then((label) => {
          if (label) setOriginText(label.split(',')[0])
        })
        .catch(() => {
          // Mantém CURRENT_LOCATION_LABEL já definido — geocodificação reversa é best-effort.
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCenter, userPosition])

  const idleLocationMessage = useMemo(() => {
    if (isLocating) return 'Localizando você…'
    if (locationError) return locationError
    if (!sample && permission === 'denied') {
      return 'Localização bloqueada — permita o acesso para usar localização atual, origem automática e navegação. Você ainda pode pesquisar uma origem manualmente.'
    }
    if (sample && sample.accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS) {
      return `Localização com baixa precisão (±${Math.round(sample.accuracyMeters)} m).`
    }
    return null
  }, [isLocating, locationError, sample, permission])

  const warningMessage = useMemo(() => {
    if (idleLocationMessage) return idleLocationMessage
    if (!isGeocodingConfigured) return 'Busca de endereços indisponível: configure a geocodificação no .env.'
    return null
  }, [idleLocationMessage])

  function handleUseCurrentLocation() {
    setFollowUserAsOrigin(true)
    setPendingCenter(true)
    setOriginText('Localizando…')
    locate()
  }

  function handleOriginTextChange(text: string) {
    setOriginText(text)
    setOriginPoint(null)
    setFollowUserAsOrigin(false)
  }

  function handleDestinationTextChange(text: string) {
    setDestinationText(text)
    setDestinationPoint(null)
  }

  function handleSelectOrigin(result: GeocodingResult) {
    setFollowUserAsOrigin(false)
    setOriginText(result.label)
    setOriginPoint(result.point)
  }

  function handleSelectDestination(result: GeocodingResult) {
    setDestinationText(result.label)
    setDestinationPoint(result.point)
    setSelectedPoi(result)
  }

  async function resolveAddress(text: string, knownPoint: LngLat | null): Promise<LngLat> {
    if (knownPoint) return knownPoint

    const results = await getGeocodingProvider().search(text)
    if (results.length === 0) {
      throw new Error(`Endereço não encontrado: "${text}".`)
    }
    return results[0].point
  }

  /** Núcleo do cálculo de rota — aceita origem/destino explícitos (usado pelo fluxo "Traçar rota" de um POI, que não pode depender do estado assíncrono do formulário) ou cai para os campos da busca. */
  async function calculateRoute(explicitOrigin?: { text: string; point: LngLat }, explicitDestination?: { text: string; point: LngLat }) {
    const oText = explicitOrigin?.text ?? originText
    const oPoint = explicitOrigin?.point ?? originPoint
    const dText = explicitDestination?.text ?? destinationText
    const dPoint = explicitDestination?.point ?? destinationPoint
    if (!oText.trim() || !dText.trim()) return

    setIsCalculating(true)
    setStatusMessage(null)
    try {
      const origin = await resolveAddress(oText, oPoint)
      const destination = await resolveAddress(dText, dPoint)

      const withinRegion = isPointWithinRegion(origin) && isPointWithinRegion(destination)
      if (!withinRegion) {
        setStatusMessage(`O GPS Scooter está disponível apenas em ${SUPPORTED_REGION.label} nesta fase.`)
        return
      }

      if (!isRoutingConfigured) {
        setStatusMessage('Roteamento indisponível: configure VITE_ROUTING_BASE_URL no .env para calcular rotas reais.')
        return
      }

      const result = await planRoute({ origin, destination })
      setOriginText(oText)
      setOriginPoint(origin)
      setDestinationText(dText)
      setDestinationPoint(destination)
      setRouteResult(result)
      setActiveRouteId(result.selected.route.id)
      setSheetSnap('half')
      recordActivity({
        originLabel: oText,
        destinationLabel: dText,
        distanceMeters: result.selected.route.totalDistanceMeters,
        etaMinutes: result.selected.etaMinutes,
        suitabilityScore: result.selected.suitabilityScore,
      })
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Não foi possível calcular a rota.')
    } finally {
      setIsCalculating(false)
    }
  }

  function handleCalculateRoute() {
    calculateRoute()
  }

  /** "Traçar rota" a partir de uma ficha de POI ou de um lugar salvo: origem = localização atual (se já disponível) ou dispara localização; destino = coordenadas já conhecidas do lugar — usuário não precisa digitar nada. */
  function handleTraceRouteToPlace(label: string, point: LngLat) {
    setSelectedPoi(null)
    setActivePanel(null)
    setDestinationText(label)
    setDestinationPoint(point)

    if (originPoint) {
      calculateRoute(undefined, { text: label, point })
      return
    }
    if (userPosition) {
      const originLabel = originText.trim() || CURRENT_LOCATION_LABEL
      setOriginPoint(userPosition)
      setOriginText(originLabel)
      calculateRoute({ text: originLabel, point: userPosition }, { text: label, point })
      return
    }

    setPendingTraceDestination({ text: label, point })
    setFollowUserAsOrigin(true)
    setPendingCenter(true)
    setOriginText('Localizando…')
    locate()
    setStatusMessage('Obtendo sua localização para traçar a rota…')
  }

  function handleSavePoi(poi: GeocodingResult) {
    saveFavorite(poi.label, poi.secondaryLabel, poi.point)
    setSelectedPoi({ ...poi })
  }

  const isPoiSaved = selectedPoi
    ? listSavedPlaces().some(
        (place) => Math.abs(place.point.lat - selectedPoi.point.lat) < 1e-6 && Math.abs(place.point.lng - selectedPoi.point.lng) < 1e-6,
      )
    : false

  function handleCenterOnUser() {
    if (isNavigating) {
      setIsFollowingUser(true)
      return
    }
    setFollowUserAsOrigin(true)
    setPendingCenter(true)
    if (!originText.trim()) setOriginText('Localizando…')
    locate()
  }

  const allRoutes = routeResult ? [routeResult.selected, ...routeResult.alternatives] : []
  const activeScoredRoute = allRoutes.find((entry) => entry.route.id === activeRouteId) ?? routeResult?.selected ?? null

  const navigationSession = useNavigationSession(activeScoredRoute?.route ?? null, isNavigating)

  // Desvio de rota sustentado (não ruído pontual do GPS) → recalcula a partir
  // da posição atual, mantendo o mesmo destino e perfil de veículo. As regras
  // de adequação (ruleEngine) são reaplicadas normalmente, pois a nova rota
  // passa pelo mesmo pipeline planRoute de sempre.
  useEffect(() => {
    if (!navigationSession.routeDeviated || !navigationSession.gpsSample || !destinationPoint || isRecalculating) return

    let cancelled = false
    setIsRecalculating(true)

    planRoute({ origin: navigationSession.gpsSample.position, destination: destinationPoint })
      .then((result) => {
        if (cancelled) return
        setRouteResult(result)
        setActiveRouteId(result.selected.route.id)
        navigationSession.acknowledgeRecalculation()
      })
      .catch(() => {
        // Falha ao recalcular: mantém a rota atual e tenta novamente no próximo desvio sustentado.
      })
      .finally(() => {
        if (!cancelled) setIsRecalculating(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationSession.routeDeviated])

  if (isNavigating && activeScoredRoute) {
    const navPosition = navigationSession.progress?.snappedPosition ?? navigationSession.gpsSample?.position ?? null

    return (
      <div className="relative h-screen w-screen overflow-hidden bg-surface">
        <MapView
          originPoint={originPoint}
          destinationPoint={destinationPoint}
          userPoint={navPosition}
          routeGeometry={activeScoredRoute.route.geometry}
          followUser={isFollowingUser}
          onUserInteraction={() => setIsFollowingUser(false)}
        />
        <NavigationPanel
          scoredRoute={activeScoredRoute}
          progress={navigationSession.progress}
          gpsSample={navigationSession.gpsSample}
          locationError={navigationSession.locationError}
          routeDeviated={navigationSession.routeDeviated}
          isRecalculating={isRecalculating}
          vehicleBattery={vehicleBluetooth.status === 'connected' ? vehicleBluetooth.batteryPercent : null}
          onStop={() => {
            setIsNavigating(false)
            setIsFollowingUser(true)
          }}
        />
        <div className="pointer-events-none absolute bottom-40 right-3">
          <MapControls onCenterOnUser={handleCenterOnUser} isLocating={navigationSession.isLocating} isFollowing={isFollowingUser} />
        </div>
      </div>
    )
  }

  const routeOptions = allRoutes.map((entry) => ({
    id: entry.route.id,
    geometry: entry.route.geometry,
    eligibility: entry.eligibility,
    isActive: entry.route.id === activeScoredRoute?.route.id,
  }))

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface">
      <MapView
        originPoint={originPoint}
        destinationPoint={destinationPoint}
        userPoint={userPosition}
        routeGeometry={activeScoredRoute?.route.geometry ?? null}
        routeOptions={routeOptions.length > 1 ? routeOptions : []}
        centerRequestId={centerToken}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <SearchPanel
          originText={originText}
          destinationText={destinationText}
          onOriginChange={handleOriginTextChange}
          onDestinationChange={handleDestinationTextChange}
          onSelectOrigin={handleSelectOrigin}
          onSelectDestination={handleSelectDestination}
          onUseCurrentLocation={handleUseCurrentLocation}
          onCalculateRoute={handleCalculateRoute}
          onProfileClick={() => setActivePanel('profile')}
          isCalculating={isCalculating}
          canCalculate={Boolean(originText.trim() && destinationText.trim())}
          warningMessage={statusMessage ?? warningMessage}
        />
      </div>

      <div className="pointer-events-none absolute bottom-36 right-3">
        <MapControls onCenterOnUser={handleCenterOnUser} isLocating={isLocating} />
      </div>

      {selectedPoi && !activeScoredRoute && (
        <PoiCard
          poi={selectedPoi}
          isSaved={isPoiSaved}
          userPoint={userPosition}
          onDismiss={() => setSelectedPoi(null)}
          onSave={() => handleSavePoi(selectedPoi)}
          onTraceRoute={() => handleTraceRouteToPlace(selectedPoi.label, selectedPoi.point)}
        />
      )}

      {activeScoredRoute ? (
        <BottomSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          collapsedContent={<RouteSummary scoredRoute={activeScoredRoute} />}
        >
          <RoutePanel
            routes={allRoutes}
            activeRouteId={activeScoredRoute.route.id}
            onSelectRoute={setActiveRouteId}
            onStartNavigation={() => {
              setIsFollowingUser(true)
              setIsNavigating(true)
            }}
            onDismiss={() => {
              setRouteResult(null)
              setActiveRouteId(null)
            }}
          />
        </BottomSheet>
      ) : (
        !selectedPoi && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <VehicleStatusBar bluetooth={vehicleBluetooth} />
            <BottomNavBar
              active={activePanel === 'saved' || activePanel === 'activity' ? activePanel : 'explore'}
              onSelect={(tab) => setActivePanel(tab === 'explore' ? null : tab)}
            />
          </div>
        )
      )}

      {activePanel === 'profile' && <ProfilePanel onClose={() => setActivePanel(null)} vehicleBluetooth={vehicleBluetooth} />}
      {activePanel === 'saved' && (
        <SavedPanel
          onClose={() => setActivePanel(null)}
          onTraceRoute={(place: SavedPlace) => handleTraceRouteToPlace(place.label, place.point)}
        />
      )}
      {activePanel === 'activity' && <ActivityPanel onClose={() => setActivePanel(null)} />}
    </div>
  )
}
