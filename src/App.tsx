import { useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from '@/components/map/MapView'
import { LocationHeader, SearchBar } from '@/components/search/LocationHeader'
import { OriginFallbackCard } from '@/components/search/OriginFallbackCard'
import { VehicleSheet } from '@/components/vehicle/VehicleSheet'
import { SearchScreen } from '@/components/search/SearchScreen'
import { PoiCard } from '@/components/search/PoiCard'
import { MapControls } from '@/components/controls/MapControls'
import { RoutePanel, RouteSummary } from '@/components/route/RoutePanel'
import { BottomSheet, type SheetSnapPoint } from '@/components/route/BottomSheet'
import { BottomNavBar } from '@/components/layout/BottomNavBar'
import { SegmentAlertBanner } from '@/components/navigation/SegmentAlertBanner'
import { SuitabilityLegend } from '@/components/map/SuitabilityLegend'
import { ExploreSheet } from '@/components/explore/ExploreSheet'
import { BatteryCheckIn } from '@/components/vehicle/BatteryCheckIn'
import { useBatteryCheckIn } from '@/hooks/useBatteryCheckIn'
import { exploreRadiusKm } from '@/services/vehicle/autonomy'
import { frequentPlaces } from '@/services/storage/travelPatterns'
import { listActivity } from '@/services/storage/activityHistory'
import { mobilityProfile } from '@/config/mobilityProfiles'
import { useSegmentAlerts } from '@/hooks/useSegmentAlerts'
import { runKey } from '@/services/navigation/segmentAlerts'
import { currentSpeedLimit } from '@/services/navigation/speedLimit'
import { VehicleOnboarding } from '@/components/onboarding/VehicleOnboarding'
import { VehicleStatusBar } from '@/components/layout/VehicleStatusBar'
import {
  appendConsumptionSample,
  assessRouteAutonomy,
  autonomyState,
  buildConsumptionSample,
} from '@/services/vehicle/autonomy'
import { NavigationPanel } from '@/components/navigation/NavigationPanel'
import { AlternativeSheet } from '@/components/navigation/AlternativeSheet'
import { ArrivalSheet } from '@/components/navigation/ArrivalSheet'
import { SegmentDetailSheet, SegmentWarningPill } from '@/components/navigation/SegmentDetail'
import { compareRoutes, pickAlternatives, type RouteComparison } from '@/services/routing/alternatives'
import { ProfilePanel } from '@/components/panels/ProfilePanel'
import { SavedPanel } from '@/components/panels/SavedPanel'
import { ActivityPanel } from '@/components/panels/ActivityPanel'
import { useGeolocation, LOW_ACCURACY_THRESHOLD_METERS } from '@/hooks/useGeolocation'
import { useNavigationSession } from '@/hooks/useNavigationSession'
import { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { isSamePoint } from '@/utils/geo'
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance'
import { isSpeechSupported, primeFromUserGesture } from '@/services/navigation/voiceGuidance'
import { isPointWithinRegion, SUPPORTED_REGION, type LngLat } from '@/config/region'
import { isGeocodingConfigured, isMapConfigured, isRoutingConfigured } from '@/config/env'
import { enrichRouteResult, planRoute } from '@/services/routing'
import { getGeocodingProvider, type GeocodingResult } from '@/services/geocoding'
import { saveFavorite, listSavedPlaces, type SavedPlace } from '@/services/storage/savedPlaces'
import { recordActivity, type ActivityEntry } from '@/services/storage/activityHistory'
import { recordSearch } from '@/services/storage/searchHistory'
import type { RouteResult, ScoredRoute } from '@/types/routing'
import type { SeverityRun } from '@/services/routing/segmentSeverity'
import { TopScrim } from '@/components/ui/TopScrim'

type ActivePanel = 'profile' | 'saved' | 'activity' | null

/** Texto do campo de origem quando a localização atual está em uso mas a geocodificação reversa ainda não resolveu (ou falhou). */
const CURRENT_LOCATION_LABEL = 'Minha localização atual'

/**
 * Até onde o aviso antecipado enxerga. 2 km a 25–32 km/h dá alguns minutos de
 * antecedência — o suficiente para decidir por uma alternativa antes de estar
 * comprometido com a via. Avisar de algo a 8 km seria ruído.
 */
const SEGMENT_WARNING_LOOKAHEAD_METERS = 2000

/**
 * Intervalo mínimo entre dois recálculos por desvio. Ver o efeito que o usa.
 */
const RECALCULATION_COOLDOWN_MS = 12000

/**
 * Distância que caracteriza CHEGADA.
 *
 * 30 m é a ordem de grandeza do erro do próprio GPS em cidade: exigir menos
 * faria a chegada nunca disparar em rua com prédio alto, e exigir mais
 * encerraria o percurso um quarteirão antes. É também a distância em que o
 * provedor já falou "Chegou ao seu destino".
 */
/** Aviso de falha de localização — constante para poder ser retirado por identidade quando a posição volta. */
const LOCATION_UNAVAILABLE_MESSAGE =
  'Não foi possível obter sua localização. Defina a origem manualmente para traçar a rota.'

const ARRIVAL_RADIUS_METERS = 30

export default function App() {
  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [originPoint, setOriginPoint] = useState<LngLat | null>(null)
  const [destinationPoint, setDestinationPoint] = useState<LngLat | null>(null)
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  /**
   * Rota de PREVIEW: calculada automaticamente assim que um destino é
   * escolhido, antes de o usuário pedir "Traçar rota".
   *
   * É o resultado completo do mesmo `planRoute` usado depois — o que muda é
   * só quanto dele a interface mostra. Aqui aparece apenas a recomendada,
   * como uma linha única pelas vias; quando o usuário confirma, este mesmo
   * objeto é promovido a `routeResult` e as alternativas aparecem. Guardar o
   * resultado inteiro evita recalcular tudo de novo no clique — o "Traçar
   * rota" fica instantâneo quando o preview já terminou.
   */
  const [preview, setPreview] = useState<{ destination: LngLat; result: RouteResult } | null>(null)
  /** Quando o último recálculo por desvio começou — ver RECALCULATION_COOLDOWN_MS. */
  const lastRecalculationAtRef = useRef(0)
  /**
   * Percurso concluído, aguardando o usuário fechar a tela de finalização.
   *
   * Guarda os números do trajeto no instante da chegada porque a navegação é
   * encerrada junto: um quadro depois `activeScoredRoute` já não existe, e a
   * tela mostraria distância e tempo vazios.
   */
  const [arrival, setArrival] = useState<{ label: string | null; distanceMeters: number; durationMinutes: number } | null>(
    null,
  )
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isSearchingAlternative, setIsSearchingAlternative] = useState(false)
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null)
  /** Alternativa encontrada e ainda não decidida pelo usuário. */
  /**
   * Comparação de rotas durante a navegação.
   *
   * Guarda TODAS as alternativas distintas, não só a melhor. O usuário
   * precisa pesar "mais rápida com trecho vermelho" contra "um pouco mais
   * longa e limpa", e para isso as duas têm que estar na tela ao mesmo tempo.
   *
   * `appliedId` é o id da rota em vigor, ou null para a original — guardar o
   * ID e não o índice evita que a seleção aponte para outra rota se a lista
   * mudar de tamanho.
   */
  const [alternative, setAlternative] = useState<{
    options: ScoredRoute[]
    /** Rota que estava valendo quando a comparação abriu — para poder voltar a ela. */
    original: ScoredRoute
    appliedId: string | null
  } | null>(null)
  const [isFollowingUser, setIsFollowingUser] = useState(true)
  const [sheetSnap, setSheetSnap] = useState<SheetSnapPoint>('half')
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  /** Tela de busca em tela cheia (SearchScreen do handoff) — aberta pelo campo "Para onde?" e pela lupa. */
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isExploreOpen, setIsExploreOpen] = useState(false)
  const [searchSeed, setSearchSeed] = useState<string | null>(null)
  /** Instruções faladas. Começa ligada quando o dispositivo suporta — num GPS, voz é o padrão esperado. */
  const [voiceEnabled, setVoiceEnabled] = useState(isSpeechSupported)
  const [selectedPoi, setSelectedPoi] = useState<GeocodingResult | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(
    isMapConfigured ? null : 'Mapa em modo demonstração — configure VITE_MAP_STYLE_URL no .env para produção.',
  )

  const { sample, isLocating, locate, error: locationError, permission } = useGeolocation()
  // Vivendo em App.tsx (não dentro do ProfilePanel) para a conexão persistir
  // entre navegação de painéis e alimentar o NavigationPanel com bateria real quando disponível.
  const vehicleBluetooth = useVehicleBluetooth()
  const { preferences, update: updatePreferences } = useUserPreferences()
  const userPosition = sample?.position ?? null
  const [followUserAsOrigin, setFollowUserAsOrigin] = useState(false)
  const [pendingCenter, setPendingCenter] = useState(false)
  const [centerToken, setCenterToken] = useState(0)
  const [northToken, setNorthToken] = useState(0)
  const [isVehicleSheetOpen, setIsVehicleSheetOpen] = useState(false)
  /** Trecho classificado aberto em detalhe (handoff tela 07). */
  const [openSegmentRunIndex, setOpenSegmentRunIndex] = useState<number | null>(null)
  /** Rumo do mapa, espelhado do MapView só para a agulha da bússola girar. */
  const [mapBearing, setMapBearing] = useState(0)
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

  /**
   * Encerra a espera por localização quando o GPS FALHA.
   *
   * Sem isto, "Traçar rota" a partir de um POI/salvo sem origem conhecida
   * deixava a tela presa para sempre em "Obtendo sua localização para traçar
   * a rota…": o efeito acima só dispara quando `userPosition` chega, e se a
   * permissão for negada ela nunca chega. Era um dos travamentos infinitos
   * relatados — reproduzido neste ambiente com a permissão bloqueada.
   *
   * Aqui o estado pendente é limpo e o usuário recebe uma instrução acionável
   * (definir a origem manualmente), em vez de um carregamento eterno.
   */
  useEffect(() => {
    if (!locationError || !pendingCenter) return

    setPendingCenter(false)
    setFollowUserAsOrigin(false)
    if (originText === 'Localizando…') setOriginText('')

    if (pendingTraceDestination) {
      setPendingTraceDestination(null)
      setStatusMessage(LOCATION_UNAVAILABLE_MESSAGE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationError, pendingCenter])

  /**
   * Tira o aviso de localização quando a localização VOLTA.
   *
   * Bug real, reproduzido: com a permissão bloqueada o aviso aparecia, o
   * usuário tocava em "Tentar usar minha localização", a posição chegava, a
   * origem era preenchida, a rota era traçada — e o aviso continuava ali,
   * dizendo que a localização falhou, por cima de uma tela que provava o
   * contrário. Ele só era limpo no caminho em que havia um "Traçar rota"
   * pendente esperando a posição.
   *
   * A comparação é por IDENTIDADE com a constante, não por conteúdo: assim
   * este efeito nunca apaga uma mensagem de outra natureza (erro de cálculo de
   * rota, região não suportada) que por acaso esteja na tela.
   */
  useEffect(() => {
    if (!userPosition) return
    setStatusMessage((atual) => (atual === LOCATION_UNAVAILABLE_MESSAGE ? null : atual))
  }, [userPosition])

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

  /**
   * "Repetir trajeto" a partir da aba Atividade. Recalcula do zero com a
   * posição/regras atuais — nunca reexibe a rota antiga, que pode estar
   * desatualizada (obras, mudança de sentido, outra preferência de rota).
   * Reaproveita `handleTraceRouteToPlace`, então herda de graça o caso de
   * ainda não haver origem conhecida (espera o GPS e completa sozinho).
   */
  function handleRepeatTrip(entry: ActivityEntry) {
    if (!entry.destinationPoint) return
    setActivePanel(null)
    handleTraceRouteToPlace(entry.destinationLabel, entry.destinationPoint)
  }

  /** Resultado escolhido na tela de busca: registra no histórico, fecha a busca e abre a ficha do local. */
  function handlePickFromSearch(result: GeocodingResult) {
    recordSearch(result)
    setIsSearchOpen(false)
    handleSelectDestination(result)
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
        // Guardadas para permitir "Repetir trajeto" na aba Atividade — sem elas,
        // o histórico seria só uma lista de texto sem ação possível.
        originPoint: origin,
        destinationPoint: destination,
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

  /** "Traçar rota" a partir de uma ficha de POI ou de um lugar salvo: origem = localização atual (se já disponível) ou dispara localização; destino = coordenadas já conhecidas do lugar — usuário não precisa digitar nada. */
  function handleTraceRouteToPlace(label: string, point: LngLat) {
    setSelectedPoi(null)
    setActivePanel(null)
    setDestinationText(label)
    setDestinationPoint(point)

    // O preview já rodou o pipeline completo para ESTE destino: promovê-lo
    // revela as alternativas na hora, sem uma segunda espera por algo que já
    // foi calculado. A comparação é pelo destino PEDIDO (guardado junto com o
    // resultado), não pelo fim da geometria — a rota termina encaixada na via
    // mais próxima, que quase nunca é a coordenada exata do local.
    if (preview && isSamePoint(preview.destination, point)) {
      const scored = preview.result.selected
      setRouteResult(preview.result)
      setActiveRouteId(scored.route.id)
      setSheetSnap('half')
      recordActivity({
        originLabel: originText.trim() || CURRENT_LOCATION_LABEL,
        destinationLabel: label,
        originPoint: originPoint ?? userPosition ?? undefined,
        destinationPoint: point,
        distanceMeters: scored.route.totalDistanceMeters,
        etaMinutes: scored.etaMinutes,
        suitabilityScore: scored.suitabilityScore,
      })
      return
    }

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

  /** Aviso que some sozinho: em movimento, ninguém vai tocar para dispensar. */
  function showNavigationNotice(message: string) {
    setNavigationNotice(message)
    window.setTimeout(() => setNavigationNotice((current) => (current === message ? null : current)), 5000)
  }

  /**
   * "Buscar alternativa" durante a navegação.
   *
   * Recalcula a partir da POSIÇÃO ATUAL, não da origem original: no meio do
   * trajeto, as opções que existiam na partida já não são as mesmas. Passa
   * pelo mesmo `planRoute`, então a alternativa respeita veículo, regras e
   * preferências exatamente como a rota em uso.
   *
   * Nunca troca sozinha — o resultado vira uma sugestão que o usuário aceita
   * ou descarta (ver AlternativeSheet). E se nenhuma candidata percorrer um
   * caminho realmente diferente, avisa discretamente em vez de oferecer a
   * mesma rota com outro nome.
   */
  async function handleFindAlternative() {
    const from = navigationSession.gpsSample?.position ?? navigationSession.progress?.snappedPosition
    if (!from || !destinationPoint || !activeScoredRoute || isSearchingAlternative) return

    setIsSearchingAlternative(true)
    setStatusMessage(null)
    try {
      const result = await planRoute({ origin: from, destination: destinationPoint })
      const candidates = [result.selected, ...result.alternatives]
      const picked = pickAlternatives(activeScoredRoute, candidates)

      if (picked.length === 0) {
        showNavigationNotice('Nenhuma rota alternativa diferente desta foi encontrada agora.')
        return
      }

      setAlternative({ options: picked, original: activeScoredRoute, appliedId: null })
    } catch {
      showNavigationNotice('Não foi possível buscar uma alternativa agora.')
    } finally {
      setIsSearchingAlternative(false)
    }
  }

  /**
   * Troca de rota DENTRO da comparação.
   *
   * Tocar num card aplica na hora — é assim que o handoff (tela 05) define, e
   * é seguro porque a ação é imediatamente reversível tocando no outro card.
   * Não há botão de confirmar: o que estiver aplicado quando a sheet fechar é
   * o que fica valendo, e o padrão é a rota atual.
   */
  function handleSelectAlternative(routeId: string | null) {
    if (!alternative) return
    const chosen =
      routeId == null ? alternative.original : (alternative.options.find((o) => o.route.id === routeId) ?? alternative.original)
    setRouteResult({ selected: chosen, alternatives: [] })
    setActiveRouteId(chosen.route.id)
    setAlternative({ ...alternative, appliedId: routeId })
    // O trajeto mudou: `useVoiceGuidance` limpa a fila ao ver outra rota, e o
    // desvio pendente deixa de valer para a rota nova.
    navigationSession.acknowledgeRecalculation()
  }

  function handleCenterOnUser() {
    if (isNavigating) {
      // Retoma o acompanhamento E pede a recentralização explícita. Os dois
      // são necessários: `isFollowingUser` religa o rastreamento contínuo, e o
      // token dispara a animação que restaura zoom, padding e orientação de
      // uma vez — sem ele, o enquadramento só voltaria ao normal na próxima
      // amostra de GPS, que pode demorar segundos.
      setIsFollowingUser(true)
      setCenterToken((current) => current + 1)
      return
    }
    setFollowUserAsOrigin(true)
    setPendingCenter(true)
    if (!originText.trim()) setOriginText('Localizando…')
    locate()
  }

  /**
   * Calcula o preview assim que existem destino e origem conhecidos.
   *
   * Usa o MESMO pipeline (`planRoute`) do fluxo confirmado — não há um
   * "roteador de preview" simplificado, então o traçado mostrado aqui é a
   * geometria real pelas vias e já respeita as regras do veículo e as
   * preferências de rota. A diferença é só quanto do resultado a UI revela.
   *
   * Falha em silêncio de propósito: o preview é uma conveniência. Se o
   * provedor não responder, o usuário ainda vê os dois pontos no mapa e o
   * botão "Traçar rota" continua fazendo o cálculo com tratamento de erro
   * visível. Poluir a tela com um erro de algo que ele não pediu seria pior.
   */
  useEffect(() => {
    // Rota já confirmada (ou navegando): o preview não tem mais função.
    if (routeResult || isNavigating) return

    const destination = selectedPoi?.point ?? null
    const origin = originPoint ?? userPosition
    if (!destination || !origin || !isRoutingConfigured) {
      setPreview(null)
      return
    }
    if (!isPointWithinRegion(origin) || !isPointWithinRegion(destination)) {
      setPreview(null)
      return
    }

    let cancelled = false
    setIsPreviewLoading(true)
    planRoute({ origin, destination })
      .then((result) => {
        if (!cancelled) setPreview({ destination, result })
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false)
      })

    return () => {
      // Destino trocado antes de a resposta chegar: descarta o resultado
      // antigo em vez de desenhar a rota do lugar anterior.
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoi, originPoint, userPosition, routeResult, isNavigating])

  /**
   * AUTONOMIA — derivada, nunca guardada em estado próprio.
   *
   * Se ela virasse `useState`, existiriam duas verdades sobre a bateria: a
   * preferência salva e a cópia em memória. Como derivada de `preferences`, ela
   * se recalcula sozinha quando o usuário informa a bateria, troca de veículo
   * ou percorre distância — que são exatamente os três eventos que a mudam.
   */
  const autonomy = useMemo(() => autonomyState(preferences), [preferences])

  /**
   * Confirmação de bateria na abertura — ver useBatteryCheckIn.
   *
   * Existe porque o odômetro só enxerga o que aconteceu com o app ABERTO:
   * quem roda com o GPS fechado deixa o app cego, e cego ele superestima.
   */
  const batteryCheckIn = useBatteryCheckIn(autonomy)

  /**
   * Confirma a bateria E APRENDE com o intervalo que se fecha aqui.
   *
   * Este é o único momento em que o app tem os dois lados da conta ao mesmo
   * tempo: quantos metros ele mediu desde a última informação, e quanto a
   * bateria de fato caiu. É daqui que sai a autonomia real deste usuário, em
   * vez da de catálogo (ver buildConsumptionSample — a maioria dos intervalos é
   * descartada por não ser medição confiável).
   */
  const confirmarBateria = (percent: number) => {
    const anterior = preferences.batteryPercent
    const percorrido = preferences.batteryDistanceSinceUpdateMeters

    const amostra =
      anterior != null
        ? buildConsumptionSample(percorrido, anterior, percent, preferences.rangeKm)
        : null

    updatePreferences({
      batteryPercent: percent,
      batteryUpdatedAt: Date.now(),
      // Zera o odômetro: o número novo já vale para agora, e o que foi rodado
      // antes dele (visto ou não pelo app) está embutido nele.
      batteryDistanceSinceUpdateMeters: 0,
      ...(amostra
        ? { consumptionSamples: appendConsumptionSample(preferences.consumptionSamples ?? [], amostra) }
        : {}),
    })
    batteryCheckIn.dispensar()
  }

  const allRoutes = routeResult ? [routeResult.selected, ...routeResult.alternatives] : []

  /**
   * Veredito de autonomia de CADA candidata, não só da ativa.
   *
   * É o que permite a comparação que o usuário realmente faz quando a bateria
   * está baixa: "a recomendada não cabe, mas esta outra cabe?". Calcular só
   * para a ativa deixaria essa pergunta sem resposta na tela em que ela é
   * feita.
   */
  const autonomyByRouteId = useMemo(() => {
    const map: Record<string, ReturnType<typeof assessRouteAutonomy>> = {}
    for (const entry of allRoutes) {
      map[entry.route.id] = assessRouteAutonomy(autonomy, entry.route.totalDistanceMeters)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeResult, autonomy])
  const activeScoredRoute = allRoutes.find((entry) => entry.route.id === activeRouteId) ?? routeResult?.selected ?? null

  /*
    HANDLE DE DESENVOLVIMENTO da rota ativa. Mesma justificativa do `__gpsMap`
    em MapView: inspecionar as tags do OSM que chegaram a cada trecho é
    impossível de fora, e sem isso não dá para distinguir "esta via não tem
    maxspeed no OSM" de "o enriquecimento perdeu a tag no caminho" — que é
    exatamente a dúvida que decide se a placa de limite funciona.

    `import.meta.env.DEV` é apagado no build de produção.
  */
  if (import.meta.env.DEV) {
    ;(window as unknown as { __gpsRoute?: unknown }).__gpsRoute = activeScoredRoute
  }

  /**
   * Trechos da rota ativa já classificados para o veículo — é o que faz o
   * traçado no mapa ter cores diferentes ao longo do percurso.
   *
   * Vem pronto do pipeline (`scoredRoute.severity`), calculado uma única vez
   * junto com a rota. A tela não reclassifica nada por conta própria: se
   * fizesse, mapa e painel poderiam discordar sobre o mesmo trecho.
   */
  const scoredForDisplay = activeScoredRoute ?? preview?.result.selected ?? null
  const routeSeveritySegments =
    // Classificação sem lastro em dado de via não vira cor no mapa. Passar os
    // trechos assim mesmo pintaria a rota inteira de azul "adequado" — a
    // mesma afirmação falsa que o painel evita dizer em texto. Sem isso, o
    // MapView desenha a rota inteira na cor padrão, que é o traçado neutro.
    scoredForDisplay?.severity.isReliable
      ? scoredForDisplay.severity.segments.map((segment) => ({ path: segment.path, severity: segment.severity }))
      : []

  /**
   * Trechos que o USUÁRIO pediu para evitar e que mesmo assim entraram na rota
   * (porque eram inevitáveis, ou porque desviar sairia caro demais).
   *
   * Eixo SEPARADO da severidade acima, de propósito. Severidade responde "esta
   * via serve para o meu veículo?"; isto responde "eu pedi para não passar por
   * aqui". Um trecho pode ser perfeitamente adequado e ainda assim contrariar
   * uma preferência (uma subida íngreme numa rua residencial tranquila, por
   * exemplo). Por isso continua como sobreposição, e não como mais uma cor na
   * linha.
   */
  const routeWarnings = (() => {
    const segments = activeScoredRoute?.route.segments ?? []
    const indexesToAvoid = new Set((activeScoredRoute?.avoidanceHits ?? []).flatMap((hit) => hit.segmentIndexes))

    return [...indexesToAvoid]
      .map((index) => segments[index])
      .filter((segment): segment is NonNullable<typeof segment> => segment != null)
      .map((segment) => ({ path: segment.path, severity: 'caution' as const }))
  })()

  const navigationSession = useNavigationSession(activeScoredRoute?.route ?? null, isNavigating)
  useVoiceGuidance(navigationSession.progress, voiceEnabled, isNavigating, activeScoredRoute?.route ?? null)

  // Desvio de rota sustentado (não ruído pontual do GPS) → recalcula a partir
  // da posição atual, mantendo o mesmo destino e perfil de veículo. As regras
  // de adequação (ruleEngine) são reaplicadas normalmente, pois a nova rota
  // passa pelo mesmo pipeline planRoute de sempre.
  useEffect(() => {
    if (!navigationSession.routeDeviated || !navigationSession.gpsSample || !destinationPoint || isRecalculating) return

    /**
     * INTERVALO MÍNIMO entre recálculos.
     *
     * `isRecalculating` já impedia dois recálculos SIMULTÂNEOS, mas nada
     * impedia dois SEGUIDOS. Medido em teste: com o usuário 60 m fora da rota
     * de forma sustentada, o app recalculava a cada poucos segundos — e cada
     * recálculo são quatro requisições (Valhalla e OSRM, com alternativas)
     * contra servidores públicos de demonstração. Doze requisições em 26 s.
     *
     * O ciclo se realimenta: a rota nova passa pela posição atual, o usuário
     * continua se afastando dela, e sai de rota outra vez. Recalcular de novo
     * em três segundos não produz rota diferente — produz tráfego e um painel
     * que pisca "recalculando".
     *
     * 12 s é maior que o tempo de detecção sustentada, então um desvio real e
     * continuado ainda gera um novo recálculo; o que ele corta é a repetição
     * dentro da mesma manobra errada.
     */
    const agora = Date.now()
    if (agora - lastRecalculationAtRef.current < RECALCULATION_COOLDOWN_MS) return
    lastRecalculationAtRef.current = agora

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

  /**
   * Candidatas desenhadas no mapa — SEM a ativa.
   *
   * A camada de candidatas fica acima da camada de trechos coloridos, então
   * incluir a rota ativa aqui a redesenhava por cima em azul chapado e
   * escondia as cores de adequação justamente na tela em que o usuário compara
   * rotas. A ativa é desenhada pela camada segmentada, trecho a trecho.
   */
  const routeOptions = allRoutes
    .filter((entry) => entry.route.id !== activeScoredRoute?.route.id)
    .map((entry) => ({
      id: entry.route.id,
      geometry: entry.route.geometry,
      eligibility: entry.eligibility,
      isActive: false,
    }))

  /**
   * Modo navegação — controla APENAS quais painéis aparecem por cima e como o
   * mapa se comporta, nunca QUAL mapa é renderizado.
   *
   * Antes existiam dois `<MapView>` em ramos de return diferentes. Como o
   * React desmonta a árvore inteira ao trocar de ramo, iniciar ou encerrar uma
   * navegação DESTRUÍA o mapa WebGL e recriava tudo: estilo, fontes, camadas,
   * marcadores e todos os tiles baixados de novo. Além do piscar visível, isso
   * consome cota do provedor de mapa a cada toque em "Iniciar"/"Encerrar" — e
   * este projeto já bateu no limite de requisições do MapTiler. Agora é uma
   * instância só, que apenas muda de props.
   */
  /**
   * Via e bairro exibidos no cabeçalho.
   *
   * Reaproveitam o endereço que a geocodificação reversa JÁ resolveu para a
   * origem quando ela é a posição atual — não há consulta nova. O rótulo vem
   * como "Rua X, Bairro, Cidade": a primeira parte é a via, o resto é a área.
   * Quando a origem foi digitada à mão, ela não descreve onde o usuário está,
   * então o cabeçalho não afirma nada.
   */
  const [currentStreetLabel, currentAreaLabel] = (() => {
    if (!followUserAsOrigin || !originText.trim() || originText === 'Localizando…') return [null, null]
    const parts = originText.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length === 0) return [null, null]
    return [parts[0], parts.slice(1).join(' · ') || null]
  })()

  /**
   * Trecho classificado logo à FRENTE, para o aviso antecipado.
   *
   * Só entra na tela um trecho que ainda não foi passado e que está dentro do
   * alcance de aviso — avisar de algo a 8 km é ruído, e avisar de algo já
   * percorrido é erro. Entre os candidatos, vale o mais próximo.
   */
  const upcomingSegmentWarning: { run: SeverityRun; index: number; aheadMeters: number } | null = (() => {
    if (!isNavigating || !activeScoredRoute || !navigationSession.progress) return null
    const { segments, runs } = activeScoredRoute.severity
    if (!activeScoredRoute.severity.isReliable) return null

    const traveled = navigationSession.progress.distanceTraveledMeters
    // Laço explícito, não `forEach`: dentro do callback o TypeScript estreita
    // `best` para `null` e não consegue alargar de volta na atribuição.
    const candidates: { run: SeverityRun; index: number; aheadMeters: number }[] = []
    for (let index = 0; index < runs.length; index += 1) {
      const run = runs[index]
      const startIndex = Math.min(...run.segmentIndexes)
      let start = 0
      for (let i = 0; i < startIndex; i += 1) start += segments[i]?.distanceMeters ?? 0
      const aheadMeters = start - traveled
      if (aheadMeters <= 0 || aheadMeters > SEGMENT_WARNING_LOOKAHEAD_METERS) continue
      candidates.push({ run, index, aheadMeters })
    }

    return candidates.sort((a, b) => a.aheadMeters - b.aheadMeters)[0] ?? null
  })()

  /**
   * Classificação das vias chega DEPOIS da rota.
   *
   * O enriquecimento (Overpass) leva 10–15 s e antes corria contra um prazo
   * dentro do `planRoute`: passou do prazo, resultado descartado, rota sem
   * classificação nenhuma — era por isso que os trechos não recomendados nunca
   * apareciam destacados. Agora a rota aparece em segundos e a classificação
   * chega quando chegar, repintando o traçado.
   *
   * `routeResult` é comparado por identidade: o upgrade substitui o objeto, e
   * a segunda passada vê `isReliable` já verdadeiro e não refaz nada.
   */
  useEffect(() => {
    if (!routeResult) return
    let cancelled = false
    enrichRouteResult(routeResult)
      .then((upgraded) => {
        if (upgraded && !cancelled) setRouteResult(upgraded)
      })
      .catch(() => {
        // Falhou: a rota continua utilizável, só sem classificação por trecho.
      })
    return () => {
      cancelled = true
    }
  }, [routeResult])

  /**
   * CHEGADA AO DESTINO.
   *
   * O provedor já anuncia "Chegou ao seu destino" por voz — o que faltava era
   * o encerramento visual. Aqui a navegação é encerrada e a tela de
   * finalização entra; a voz não é tocada nem repetida, ela roda pelo caminho
   * normal das instruções.
   *
   * A distância restante vem de `progress`, que é medida sobre a rota e não em
   * linha reta, então ela não dispara ao passar perto do destino por outra rua.
   */
  useEffect(() => {
    if (!isNavigating || arrival) return
    const progress = navigationSession.progress
    if (!progress || progress.remainingDistanceMeters > ARRIVAL_RADIUS_METERS) return

    const percorrido = activeScoredRoute?.route.totalDistanceMeters ?? progress.distanceTraveledMeters

    /*
      ODÔMETRO DA BATERIA.

      O que desconta da estimativa é o que o usuário REALMENTE percorreu, medido
      pela navegação — não a distância planejada da rota, que ele pode ter
      abandonado no meio. `distanceTraveledMeters` vem do progresso sobre a
      geometria, então um desvio de dois quarteirões conta os dois quarteirões.

      Acumular aqui, no fim do percurso, e não a cada amostra de GPS: gravar no
      localStorage a 1 Hz durante a navegação inteira seria escrita constante
      para um número que só é lido quando alguém abre uma tela.
    */
    if (progress.distanceTraveledMeters > 0) {
      updatePreferences({
        batteryDistanceSinceUpdateMeters:
          preferences.batteryDistanceSinceUpdateMeters + progress.distanceTraveledMeters,
      })
    }

    setArrival({
      label: destinationText || selectedPoi?.label || null,
      distanceMeters: percorrido,
      durationMinutes: activeScoredRoute?.etaMinutes ?? 0,
    })
    // Encerra a navegação de verdade: acompanhamento, comparação e avisos
    // pendentes saem junto, senão a tela de chegada conviveria com um painel
    // de manobra que não tem mais para onde apontar.
    setIsNavigating(false)
    setIsFollowingUser(true)
    setAlternative(null)
    setNavigationNotice(null)
    setOpenSegmentRunIndex(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, navigationSession.progress, arrival])

  /**
   * CLASSIFICAÇÃO DAS ALTERNATIVAS.
   *
   * Era o buraco do fluxo de comparação. `planRoute` devolve TODAS as
   * candidatas com `severity.isReliable: false` — a classificação por trecho
   * chega depois, via `enrichRouteResult`, e esse enriquecimento rodava só
   * para `routeResult` e para o preview. A alternativa nunca passava por ele.
   *
   * O efeito prático: a rota ATUAL mostrava a barra de adequação (ela veio do
   * `routeResult`, já enriquecido) e a alternativa não mostrava nada — a
   * `SuitabilityBar` não desenha sem lastro em dado de via, por decisão
   * deliberada de não afirmar "tudo verde" sobre uma rota que não foi
   * avaliada. O usuário só descobria a composição da alternativa depois de
   * escolhê-la.
   *
   * Aqui as opções passam pelo MESMO `enrichRouteResult` do resto do app —
   * nada de caminho paralelo. Como o cache de área do Overpass é por
   * continência e as alternativas percorrem o mesmo corredor da rota atual,
   * normalmente isso não custa nenhuma consulta nova.
   */
  useEffect(() => {
    if (!alternative) return
    if (alternative.options.every((option) => option.severity.isReliable)) return

    let cancelled = false
    enrichRouteResult({ selected: alternative.original, alternatives: alternative.options })
      .then((upgraded) => {
        if (!upgraded || cancelled) return
        setAlternative((current) => {
          // A comparação pode ter sido fechada ou refeita enquanto o
          // enriquecimento corria; aplicar o resultado antigo por cima
          // colocaria dados de uma busca em cima de outra.
          if (!current || current.original.route.id !== alternative.original.route.id) return current

          /**
           * O índice inclui `selected` E `alternatives`.
           *
           * `enrichRouteResult` REORDENA depois de enriquecer — a exposição a
           * via desaconselhada só é conhecida com as tags do OSM na mão, e a
           * regra de segurança precisa valer sobre o dado novo. Isso significa
           * que a rota que entrou como `selected` pode sair como alternativa e
           * vice-versa.
           *
           * Indexar só `upgraded.alternatives` fazia exatamente uma opção
           * ficar de fora do índice e manter para sempre o "avaliando vias…"
           * — observado em teste: dois de três cartões ganhavam a barra e o
           * terceiro não ganhava nunca.
           *
           * Aqui a ORDEM da comparação é preservada de propósito: reordenar os
           * cartões debaixo do dedo do usuário enquanto ele compara seria pior
           * que mostrá-los na ordem em que apareceram.
           */
          const porId = new Map(
            [upgraded.selected, ...upgraded.alternatives].map((entry) => [entry.route.id, entry]),
          )
          return {
            ...current,
            original: porId.get(current.original.route.id) ?? current.original,
            options: current.options.map((option) => porId.get(option.route.id) ?? option),
          }
        })
      })
      .catch(() => {
        // Sem classificação: os cartões mostram tempo e distância, e a barra
        // continua ausente em vez de inventada.
      })
    return () => {
      cancelled = true
    }
  }, [alternative])

  useEffect(() => {
    if (!preview) return
    let cancelled = false
    enrichRouteResult(preview.result)
      .then((upgraded) => {
        if (upgraded && !cancelled) setPreview((current) => (current ? { ...current, result: upgraded } : current))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [preview])

  const isNavigationView = isNavigating && activeScoredRoute != null

  /**
   * Aviso antecipado de trecho crítico — ver useSegmentAlerts.
   *
   * Fica no App e não no NavigationPanel porque depende da rota ATIVA (que
   * muda com a escolha de alternativa e com o recálculo) e do progresso, os
   * dois estados que já vivem aqui.
   */
  const segmentAlerts = useSegmentAlerts({
    isNavigating: isNavigationView,
    scoredRoute: activeScoredRoute,
    progress: navigationSession.progress,
    voiceEnabled,
  })

  const navPosition = navigationSession.progress?.snappedPosition ?? navigationSession.gpsSample?.position ?? null

  /**
   * Posição entregue ao mapa.
   *
   * A condição é `isNavigating`, NÃO `isNavigationView`. A diferença importa:
   * `isNavigationView` também exige `activeScoredRoute`, que fica nulo por um
   * ou dois quadros a cada RECÁLCULO de rota. Nesses quadros a expressão caía
   * em `userPosition` — que é a leitura pontual de `locate()`, feita uma vez
   * na abertura do app e nunca mais atualizada enquanto a navegação usa o seu
   * próprio rastreamento.
   *
   * Medido em teste: o marcador recebia, alternadamente, a posição real e uma
   * posição fixa 250 m atrás. Cada alternância era um salto — e a câmera ia
   * junto. Era isto que fazia a câmera "não acompanhar" e o marcador dar
   * pulos, e piorava exatamente onde mais incomoda: durante um recálculo.
   *
   * Navegando, só a posição da navegação vale; `userPosition` fica como último
   * recurso para o instante entre iniciar e a primeira amostra chegar.
   */
  const mapUserPoint = isNavigating ? (navPosition ?? userPosition) : userPosition

  /*
    `absolute inset-0`, NÃO `h-full w-full`.

    Era `h-full w-full` — percentual, resolvido contra a altura de `#root`.
    `body` e `#root` já usam `inset: 0` (não percentual) exatamente porque uma
    cadeia de alturas percentuais quebra assim que UM elo resolve contra um
    viewport diferente — mas essa div, a raiz de tudo que o app desenha
    (mapa, onboarding, cada sheet), continuava sendo esse elo solto.

    `#root` não tem cor de fundo própria. Quando o percentual fechava alguns
    pixels a menos que a altura real do `#root` (o mesmo tipo de divergência
    de viewport que motivou os dois consertos anteriores), a fresta expunha o
    `#root` transparente por trás — que por sua vez revela o `body`. Era a
    faixa clara na base, e o motivo de repintar `html`/`body`/aqui na cor do
    mapa não ter resolvido nada: o vazamento não vinha de nenhum deles ter a
    cor errada, vinha desta div nunca alcançar a borda real da tela.

    `absolute inset-0` tira o percentual do caminho: a div passa a ocupar
    exatamente a caixa do `#root` (seu ancestral posicionado mais próximo),
    ponto a ponto, sem depender de altura resolvida.
  */
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface">
      <MapView
        originPoint={originPoint}
        destinationPoint={destinationPoint}
        userPoint={mapUserPoint}
        routeGeometry={activeScoredRoute?.route.geometry ?? preview?.result.selected.route.geometry ?? null}
        // Na navegação existe UMA rota; as candidatas simultâneas são da tela
        // de escolha e sumiriam de qualquer forma pela visibilidade das camadas.
        routeOptions={isNavigationView ? [] : routeOptions}
        routeSeveritySegments={routeSeveritySegments}
        comparisonGeometry={
          // Traçado da alternativa em foco no mapa: a que está aplicada, ou a
          // primeira da lista quando ainda se está na rota atual. Sem isto o
          // usuário compararia cartões sem ver o caminho de nenhum deles.
          alternative
            ? (alternative.options.find((o) => o.route.id === alternative.appliedId) ?? alternative.options[0])?.route
                .geometry ?? null
            : null
        }
        // Os trechos que o usuário pediu para evitar passam a aparecer também
        // na tela de escolha — antes só a navegação recebia esta prop, então a
        // informação sumia justamente na hora de comparar as alternativas.
        routeWarnings={routeWarnings}
        isRoutePreview={!activeScoredRoute && preview != null}
        isNavigating={isNavigationView}
        // O marcador segue o veículo escolhido no Perfil / seletor de veículo.
        vehicleModelId={preferences.vehicleModelId}
        /*
          A camada de adequação só existe FORA da navegação.

          Navegando, o mapa já está inteiro dedicado a uma pergunta — por onde
          ir agora — e a rota já vem colorida por trecho com dados melhores
          (piso e tráfego reais, não só o tipo da via). Uma segunda malha
          colorida ali competiria com o traçado usando informação mais pobre.
        */
        suitabilityLayer={preferences.suitabilityLayerEnabled && !isNavigationView}
        // O anel existe enquanto o modo explorar está aberto — fechado, o mapa
        // volta a ser só mapa.
        rangeRingKm={isExploreOpen ? exploreRadiusKm(autonomy) : null}
        followUser={isNavigationView && isFollowingUser}
        speedKmh={isNavigationView ? navigationSession.currentSpeedKmh : null}
        headingDeg={isNavigationView ? navigationSession.headingDeg : null}
        theme={preferences.theme}
        onSelectRouteOption={setActiveRouteId}
        onUserInteraction={() => setIsFollowingUser(false)}
        centerRequestId={centerToken}
        resetNorthRequestId={northToken}
        onBearingChange={setMapBearing}
      />

      {isNavigationView ? (
        <>
        <NavigationPanel
          scoredRoute={activeScoredRoute}
          /*
            Recalculado a cada amostra de GPS, o que é barato: é uma soma sobre
            os segmentos até achar o atual, sobre dados que já estão em memória.
            Devolve null na maioria das vias — 21% de cobertura medida em
            Goiânia —, e nesse caso a placa não é desenhada.
          */
          speedLimit={
            navigationSession.progress
              ? currentSpeedLimit(activeScoredRoute.route, navigationSession.progress.distanceTraveledMeters)
              : null
          }
          segmentAlert={
            segmentAlerts.alert ? (
              <SegmentAlertBanner alert={segmentAlerts.alert} onDismiss={segmentAlerts.dismiss} />
            ) : null
          }
          progress={navigationSession.progress}
          gpsSample={navigationSession.gpsSample}
          currentSpeedKmh={navigationSession.currentSpeedKmh}
          locationError={navigationSession.locationError}
          routeDeviated={navigationSession.routeDeviated}
          isRecalculating={isRecalculating}
          vehicleBattery={vehicleBluetooth.status === 'connected' ? vehicleBluetooth.batteryPercent : null}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => {
            // Ligar a voz precisa acontecer DENTRO do toque: o iOS só libera a
            // síntese de fala a partir de um gesto real do usuário.
            if (!voiceEnabled) primeFromUserGesture()
            setVoiceEnabled((current) => !current)
          }}
          recenterControl={
            <MapControls
              onCenterOnUser={handleCenterOnUser}
              isLocating={navigationSession.isLocating}
              isFollowing={isFollowingUser}
              onResetNorth={() => setNorthToken((current) => current + 1)}
              bearingDeg={mapBearing}
            />
          }
          onStop={() => {
            setOpenSegmentRunIndex(null)
            setIsNavigating(false)
            setIsFollowingUser(true)
            setAlternative(null)
            setNavigationNotice(null)
          }}
          onFindAlternative={destinationPoint ? handleFindAlternative : undefined}
          isSearchingAlternative={isSearchingAlternative}
          notice={navigationNotice}
          /*
            A PÍLULA SOME ENQUANTO O AVISO ESTÁ NA TELA — e só para o MESMO
            trecho.

            As duas coisas dizem a verdade sobre o mesmo lugar de formas
            diferentes: o aviso é momentâneo, tem voz e explica o motivo; a
            pílula é permanente e abre o detalhe do trecho. Juntas, na mesma
            hora, sobre o mesmo trecho, viram duas frases empilhadas repetindo
            uma à outra — foi o que a auditoria encontrou na tela de navegação.

            Nove segundos depois o aviso se retira e a pílula volta, que é a
            divisão certa: primeiro a notícia, depois a referência.

            A comparação usa `runKey`, exportada de segmentAlerts — a mesma
            chave da regra de "avisa uma vez", para as duas não divergirem.
          */
          segmentWarning={
            upcomingSegmentWarning &&
            segmentAlerts.alert?.key !== runKey(upcomingSegmentWarning.run) && (
              <SegmentWarningPill
                run={upcomingSegmentWarning.run}
                distanceAheadMeters={upcomingSegmentWarning.aheadMeters}
                onOpen={() => setOpenSegmentRunIndex(upcomingSegmentWarning.index)}
              />
            )
          }
        />

        {openSegmentRunIndex != null && activeScoredRoute.severity.runs[openSegmentRunIndex] && (
          <SegmentDetailSheet
            run={activeScoredRoute.severity.runs[openSegmentRunIndex]}
            segments={activeScoredRoute.route.segments}
            isSearchingAlternative={isSearchingAlternative}
            onDismiss={() => setOpenSegmentRunIndex(null)}
            onFindAlternative={() => {
              setOpenSegmentRunIndex(null)
              handleFindAlternative()
            }}
          />
        )}

        {alternative && (
          <AlternativeSheet
            current={alternative.original}
            options={alternative.options}
            comparisons={alternative.options.map((option) => compareRoutes(alternative.original, option))}
            selectedId={alternative.appliedId}
            onSelect={handleSelectAlternative}
            onDismiss={() => setAlternative(null)}
          />
        )}
        </>
      ) : (
        <>

      {/*
        Topo da tela de exploração (handoff tela 01): cabeçalho de localização
        TRANSPARENTE + campo de busca de 58px, gutter de 16px.

        O campo de ORIGEM some daqui. No handoff a origem é sempre a posição do
        GPS, e editar origem é a exceção — por isso ele só reaparece abaixo
        quando não temos posição (permissão negada, sinal ruim), que é o único
        caso em que o usuário precisa digitar de onde está saindo. Sem esse
        fallback, negar a localização deixaria o app inutilizável.
      */}
      <TopScrim />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2.5 px-4 pt-[max(0.75rem,var(--safe-top))]">
        <LocationHeader
          avatarDataUrl={preferences.avatarDataUrl}
          currentStreet={currentStreetLabel}
          currentArea={currentAreaLabel}
          isLocating={isLocating}
          onProfileClick={() => setActivePanel('profile')}
          onMenuClick={() => setActivePanel('profile')}
        />

        <SearchBar onOpenSearch={() => setIsSearchOpen(true)} value={destinationText || null} />

        {!userPosition && (
          <OriginFallbackCard
            originText={originText}
            onOriginChange={handleOriginTextChange}
            onSelectOrigin={handleSelectOrigin}
            onRetryLocation={handleUseCurrentLocation}
            message={statusMessage ?? warningMessage}
          />
        )}

        {userPosition && (statusMessage ?? warningMessage) && (
          <div className="pointer-events-auto rounded-xl border border-hairline/[.06] bg-surface-overlay px-card py-2.5 text-caption font-semibold text-warning-text shadow-float backdrop-blur-xl">
            {statusMessage ?? warningMessage}
          </div>
        )}
      </div>


      {selectedPoi && !activeScoredRoute && (
        <PoiCard
          poi={selectedPoi}
          isSaved={isPoiSaved}
          userPoint={userPosition}
          previewRoute={
            preview && isSamePoint(preview.destination, selectedPoi.point) ? preview.result.selected : null
          }
          isRouteLoading={isPreviewLoading}
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
              // Destrava o áudio no iOS aproveitando este toque — as instruções
              // seguintes vêm do GPS, que não conta como gesto do usuário.
              if (voiceEnabled) primeFromUserGesture()
              setIsFollowingUser(true)
              setIsNavigating(true)
            }}
            autonomyByRouteId={autonomyByRouteId}
            onDismiss={() => {
              setRouteResult(null)
              setActiveRouteId(null)
            }}
          />
        </BottomSheet>
      ) : (
        !selectedPoi && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-stack px-3 pb-[calc(var(--safe-bottom)+0.375rem)]">
            {/*
              ESPAÇO ABAIXO DA BARRA DE ABAS (o `pb` acima).

              Era `max(0.75rem, var(--safe-bottom))`, e o `max` é o
              erro: num iPhone a safe area vale 34px e VENCE os 12px de
              respiro, então o resultado é 34px — exatamente a altura do
              indicador de gesto do sistema. A barra encostava nele, sem
              nenhuma folga própria, e ficava parecendo empurrada para fora da
              tela.

              Somar em vez de escolher: a safe area afasta do indicador e o
              respiro é o que separa a barra dessa área.

              O respiro é de 6px, não 12px: com 12 a barra subia demais e
              passava a ocupar espaço de mapa. 6px sobre a safe area de um
              iPhone dão 40px — acima do indicador de gesto, sem folga
              exagerada. Onde não há recorte (`env` vale 0) sobram os 6px.
            */}
            {/*
              O botão de recentralizar faz parte desta MESMA pilha, alinhado à
              direita. Antes ele flutuava com um `bottom` em pixels fixos, que
              não conhecia a altura real dos cards nem a safe area do iPhone —
              por isso encostava no bloco do veículo. Como irmão no flex, o
              espaçamento passa a ser garantido pelo `gap` em qualquer tela.
            */}
            {/* `mb-3` além do gap da pilha: o botão é um controle do MAPA, não
                parte do bloco de informações — o respiro extra deixa essa
                separação explícita em vez de parecer um card colado no outro. */}
            {/*
              A CONFIRMAÇÃO VEM PRIMEIRO na pilha, acima de tudo.

              Ela é a única coisa aqui que pode estar ERRADA sem o usuário
              saber, e todo o resto que fala de alcance (o número na barra do
              veículo, o raio do modo explorar, o veredito de cada rota) depende
              dela. Confirmar antes de olhar os outros números é a ordem certa.
            */}
            {batteryCheckIn.precisaConfirmar && autonomy.estimatedPercent != null && (
              <div className="mb-1">
                <BatteryCheckIn
                  percent={autonomy.estimatedPercent}
                  rangeKm={autonomy.rangeKm}
                  // "Sim" reafirma o MESMO valor: o que muda é a data, e é ela
                  // que devolve a confiança ao dado.
                  onConfirm={() => confirmarBateria(autonomy.estimatedPercent!)}
                  onUpdate={confirmarBateria}
                />
              </div>
            )}

            {/*
              ENTRADA DO MODO EXPLORAR.

              Botão próprio e não um toque escondido na barra do veículo: o modo
              responde uma pergunta que o resto da tela não faz ("até onde dá
              para ir?"), e uma pergunta nova precisa de uma porta visível. Fica
              alinhado à esquerda, oposto à coluna de controles do mapa, para
              não virar mais um botão redondo no meio dos outros.
            */}
            <div className="mb-1 flex justify-start">
              <button
                type="button"
                onClick={() => setIsExploreOpen(true)}
                className="pointer-events-auto flex items-center gap-2 rounded-pill border border-hairline/[.08] bg-surface-overlay px-3.5 py-2.5 shadow-float backdrop-blur-xl transition-all duration-fast active:scale-[.97]"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-success-500" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.5" />
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
                </svg>
                <span className="text-[13.5px] font-extrabold text-content-primary">Até onde dá para ir</span>
              </button>
            </div>

            <div className="mb-3 flex justify-end">
              <MapControls
                onCenterOnUser={handleCenterOnUser}
                isLocating={isLocating}
                onToggleSuitability={() =>
                  updatePreferences({ suitabilityLayerEnabled: !preferences.suitabilityLayerEnabled })
                }
                suitabilityActive={preferences.suitabilityLayerEnabled}
                // Fora da navegação a bússola só aparece com o mapa girado —
                // com o norte para cima ela não teria o que fazer.
                onResetNorth={Math.abs(mapBearing) > 1 ? () => setNorthToken((c) => c + 1) : undefined}
                bearingDeg={mapBearing}
              />
            </div>
            {/*
              A LEGENDA OCUPA O LUGAR DA BARRA DO VEÍCULO, não se soma a ela.

              Flutuando como um card a mais, a legenda empurrava a pilha inteira
              para o meio da tela e ficava boiando sobre o mapa, longe do que
              explica. Aqui ela herda a posição, a largura e o formato de um
              elemento que já existe — e a troca faz sentido de conteúdo, não só
              de espaço: as duas falam do MESMO veículo. Com a camada ligada, o
              que interessa saber sobre ele é em que vias ele anda; com a camada
              desligada, é quanto ele ainda anda.

              A barra volta assim que a camada é desligada, no mesmo lugar.
            */}
            {preferences.suitabilityLayerEnabled ? (
              <SuitabilityLegend vehicleLabel={mobilityProfile(preferences.vehicleModelId).label.toLowerCase()} />
            ) : (
              <VehicleStatusBar
                bluetooth={vehicleBluetooth}
                preferences={preferences}
                autonomy={autonomy}
                onOpen={() => setIsVehicleSheetOpen(true)}
              />
            )}
            <BottomNavBar
              active={activePanel ?? 'explore'}
              onSelect={(tab) => setActivePanel(tab === 'explore' ? null : tab)}
            />
          </div>
        )
      )}

      {activePanel === 'profile' && (
        <ProfilePanel
          onClose={() => setActivePanel(null)}
          vehicleBluetooth={vehicleBluetooth}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          onUpdateBattery={confirmarBateria}
        />
      )}
      {activePanel === 'saved' && (
        <SavedPanel
          onClose={() => setActivePanel(null)}
          onTraceRoute={(place: SavedPlace) => handleTraceRouteToPlace(place.label, place.point)}
        />
      )}
      {activePanel === 'activity' && (
        <ActivityPanel onClose={() => setActivePanel(null)} onRepeatTrip={handleRepeatTrip} />
      )}

      {isExploreOpen && (
        <ExploreSheet
          autonomy={autonomy}
          userPoint={userPosition}
          savedPlaces={listSavedPlaces()}
          frequentPlaces={frequentPlaces(listActivity())}
          onPickPlace={(label, point) => {
            setIsExploreOpen(false)
            handleTraceRouteToPlace(label, point)
          }}
          onSearchCategory={(query) => {
            // O modo explorar não tem busca própria: ele SEMEIA a busca que já
            // existe. Duplicar a lista de resultados aqui criaria uma segunda
            // implementação da mesma tela para manter em sincronia.
            setIsExploreOpen(false)
            setSearchSeed(query)
            setIsSearchOpen(true)
          }}
          // Mesmo caminho da confirmação de abertura: informar bateria em
          // QUALQUER lugar do app fecha um intervalo e alimenta o aprendizado.
          // Três caminhos gravando bateria e só um aprendendo faria o modelo
          // depender de por onde o usuário passou.
          onUpdateBattery={confirmarBateria}
          onClose={() => setIsExploreOpen(false)}
        />
      )}

      {isSearchOpen && (
        <SearchScreen
          onBack={() => {
            setIsSearchOpen(false)
            setSearchSeed(null)
          }}
          onPick={handlePickFromSearch}
          userPoint={userPosition}
          initialQuery={searchSeed ?? destinationText}
        />
      )}
          {/*
            Seletor de veículo sobre o mapa (handoff tela 06). Trocar de
            veículo muda as regras de classificação, então a rota em tela é
            recalculada — não basta gravar a preferência.
          */}
          {isVehicleSheetOpen && (
            <VehicleSheet
              preferences={preferences}
              onDismiss={() => setIsVehicleSheetOpen(false)}
              onSave={(patch) => {
                updatePreferences(patch)
                setIsVehicleSheetOpen(false)
                setPreview(null)
                if (routeResult && destinationPoint) {
                  setRouteResult(null)
                  setActiveRouteId(null)
                  calculateRoute(undefined, { text: destinationText, point: destinationPoint })
                }
              }}
            />
          )}
        </>
      )}

      {/*
        FINALIZAÇÃO fora dos dois ramos, de propósito.
        
        A chegada encerra a navegação, então quando esta tela aparece o app já
        está no ramo de exploração. Renderizá-la dentro do ramo de navegação a
        desmontaria no mesmo quadro em que ela deveria surgir.
      */}
      {/*
        CONFIGURAÇÃO INICIAL — por cima de tudo, no primeiro uso.

        Fica no fim do JSX e com z-index próprio em vez de substituir a árvore
        inteira: assim o mapa carrega e faz cache dos tiles por baixo enquanto o
        usuário escolhe o veículo, e a primeira tela depois do onboarding já
        aparece pronta em vez de começar cinza.
      */}

      {preferences.onboardingCompletedAt == null && (
        <VehicleOnboarding preferences={preferences} onFinish={updatePreferences} />
      )}

      {arrival && (
        <ArrivalSheet
          destinationLabel={arrival.label}
          distanceMeters={arrival.distanceMeters}
          durationMinutes={arrival.durationMinutes}
          onFinish={() => {
            // Nada é enviado nem guardado nesta versão — ver ArrivalSheet.
            // Fechar limpa o destino e devolve o mapa ao estado de exploração,
            // que é o que "voltar ao mapa" significa depois de um percurso
            // concluído: começar do zero, não reabrir a rota que acabou.
            setArrival(null)
            setRouteResult(null)
            setActiveRouteId(null)
            setPreview(null)
            setSelectedPoi(null)
            setDestinationText('')
            setDestinationPoint(null)
          }}
        />
      )}
    </div>
  )
}
