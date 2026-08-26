import type { ReactNode } from 'react'
import { LOW_ACCURACY_THRESHOLD_METERS, type GeolocationSample } from '@/hooks/useGeolocation'
import type { NavigationProgress } from '@/services/navigation/progress'
import { SuitabilityBar } from '@/components/route/SuitabilityBar'
import { remainingSeverity } from '@/services/routing/segmentSeverity'
import type { ManeuverType, ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta } from '@/utils/geo'
import { TopScrim } from '@/components/ui/TopScrim'
import { SpeedLimitSign } from '@/components/navigation/SpeedLimitSign'
import type { SpeedLimit } from '@/services/navigation/speedLimit'

interface NavigationPanelProps {
  scoredRoute: ScoredRoute
  /**
   * Aviso de trecho crítico à frente, quando houver. Vem pronto de fora (ver
   * useSegmentAlerts) porque a regra de QUANDO avisar depende de histórico e
   * relógio, que não são assunto de um componente de apresentação.
   */
  segmentAlert?: ReactNode
  progress: NavigationProgress | null
  gpsSample: GeolocationSample | null
  /** Velocidade real de deslocamento já filtrada (ver services/navigation/speedTracker.ts). null = sem leitura confiável. */
  currentSpeedKmh: number | null
  /**
   * Limite da via atual, quando o OpenStreetMap o traz. null = via não
   * etiquetada, e nesse caso NADA é exibido — ver speedLimit.ts.
   */
  speedLimit?: SpeedLimit | null
  locationError: string | null
  routeDeviated: boolean
  isRecalculating: boolean
  /**
   * Percentual REAL lido via Bluetooth, quando conectado e o dispositivo expõe
   * a telemetria — null caso contrário. Hoje nada é exibido a partir disso: a
   * pílula de bateria saiu da tela por não ter leitura real na maioria dos
   * casos. A prop permanece para quando a integração com o veículo existir.
   */
  vehicleBattery: number | null
  /** Botão de recentralizar, injetado por App.tsx para ficar na faixa inferior sem sobrepor os painéis. */
  recenterControl?: ReactNode
  /** Instruções por voz ligadas? */
  voiceEnabled: boolean
  onToggleVoice: () => void
  onStop: () => void
  /** Procura uma alternativa a partir da posição atual. Ausente = ação indisponível (sem destino/GPS). */
  onFindAlternative?: () => void
  /** Busca em andamento — o botão vira estado de espera em vez de aceitar outro toque. */
  isSearchingAlternative?: boolean
  /**
   * Aviso passageiro da navegação (ex.: "nenhuma alternativa diferente").
   *
   * Existe porque `statusMessage` do App só é renderizado no topo da tela de
   * exploração, que não está na tela durante a navegação — sem este slot, o
   * retorno da busca por alternativa seria escrito num lugar invisível.
   */
  notice?: string | null
  /** Aviso antecipado de trecho classificado à frente (handoff tela 04, item 2). */
  segmentWarning?: ReactNode
}

/**
 * Tela de navegação ativa (tela 4 do handoff): `GuidanceBanner` no topo,
 * `StatPill` de velocidade e bateria nos cantos inferiores, e `NavStatsBar`
 * de três colunas ancorada acima do home indicator.
 *
 * Todos os valores vêm do progresso real calculado a partir do GPS
 * (services/navigation/progress.ts) — nada aqui é contador artificial.
 */
export function NavigationPanel({
  scoredRoute,
  segmentAlert,
  progress,
  gpsSample,
  currentSpeedKmh,
  speedLimit = null,
  locationError,
  routeDeviated,
  isRecalculating,
  vehicleBattery,
  recenterControl,
  voiceEnabled,
  onToggleVoice,
  onStop,
  onFindAlternative,
  isSearchingAlternative = false,
  notice = null,
  segmentWarning,
}: NavigationPanelProps) {
  const { route, etaMinutes } = scoredRoute

  const remainingDistanceMeters = progress?.remainingDistanceMeters ?? route.totalDistanceMeters
  const remainingDurationMinutes = progress?.remainingDurationMinutes ?? etaMinutes
  const lowAccuracy = gpsSample ? gpsSample.accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS : false

  /**
   * Composição do que AINDA FALTA. A da rota inteira mentiria por omissão em
   * movimento: faltando 800 m de 15 km, "1,2 km em atenção" descreveria em
   * grande parte um trecho já percorrido.
   */
  const remaining = progress ? remainingSeverity(scoredRoute.severity, progress.distanceTraveledMeters) : null
  const remainingAtRisk = remaining ? remaining.attentionMeters + remaining.criticalMeters : 0

  return (
    <>
      <TopScrim />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2.5 px-gutter pt-[max(1rem,env(safe-area-inset-top))]">
        {progress?.nextStep ? (
          /*
            `GuidanceBanner` (handoff §5.1): card ESCURO #0F1729 de raio 28px,
            com tile de manobra 54px, "EM 200 m" em 13/800 no acento claro,
            manobra 25/900 e a via em 14/600.

            O escuro aqui não vem do tema: o handoff (§4.1, §7) define a
            navegação como escura sempre, para imersão — por isso as cores saem
            dos tokens --nav-*, que não invertem com o tema escolhido.
          */
          <div className="pointer-events-auto flex items-center gap-3.5 rounded-2xl bg-nav-surface px-4 py-3.5 shadow-nav-banner">
            <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-lg bg-nav-control text-nav-content">
              <ManeuverIcon maneuver={progress.nextStep.maneuver} />
            </span>
            <div className="min-w-0 flex-1">
              {/*
                "EM" em caixa alta, a distância NÃO. O `uppercase` aplicado à
                linha inteira transformava "60 m" em "60 M" — a unidade métrica
                é minúscula por regra do handoff (§4.2).
              */}
              <p className="text-[13px] font-extrabold tracking-[0.6px] text-nav-accent">
                <span className="uppercase">Em</span> {formatDistance(progress.distanceToNextManeuverMeters)}
              </p>
              <p className="mt-0.5 truncate text-maneuver text-nav-content">{progress.nextStep.instruction}</p>
              {progress.nextStep.roadName && (
                <p className="mt-0.5 truncate text-[14px] font-semibold text-nav-content-secondary">
                  {progress.nextStep.roadName}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <VoiceToggle enabled={voiceEnabled} onToggle={onToggleVoice} />
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto rounded-2xl border border-hairline/15 bg-surface-overlay px-card py-3.5 text-body text-content-secondary shadow-float backdrop-blur-xl">
            {locationError ?? 'Obtendo sua localização…'}
          </div>
        )}

        {/*
          O aviso de trecho entra AQUI: depois do card de manobra, antes do
          "saiu da rota". A ordem da pilha é a ordem da urgência — para onde ir
          agora, o que vem à frente, e só então o estado da navegação.
        */}
        {segmentAlert}

        {segmentWarning}

        {routeDeviated && (
          <div className="pointer-events-auto rounded-lg bg-warning-500 px-card py-2.5 text-body font-bold text-content-on-accent shadow-float">
            {isRecalculating ? 'Você saiu da rota — recalculando…' : 'Você saiu da rota.'}
          </div>
        )}

        {notice && (
          <div className="pointer-events-auto rounded-lg border border-hairline/15 bg-surface-overlay px-card py-2.5 text-body text-content-secondary shadow-float backdrop-blur-xl">
            {notice}
          </div>
        )}

        {progress && lowAccuracy && (
          <div className="pointer-events-auto rounded-lg border border-hairline/15 bg-surface-overlay px-card py-2 text-caption text-content-secondary shadow-float backdrop-blur-xl">
            Localização com baixa precisão (±{Math.round(gpsSample!.accuracyMeters)} m) — tente uma área aberta.
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-stack px-gutter pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/*
          Faixa inferior: velocidade real do GPS à esquerda e o botão de
          recentralizar à direita — este é o único lugar da navegação onde ele
          aparece, alinhado à mesma linha de base, sem sobrepor nada.

          A pílula de BATERIA foi removida: sem veículo conectado por Bluetooth,
          o valor vinha de uma estimativa sobre um percentual inicial fixo
          (config/vehicleStatusMock.ts) — ou seja, um número sem leitura real
          por trás. Quando houver telemetria de verdade, ela volta como
          `vehicleBattery` (a prop e o encanamento continuam existindo).
        */}
        {/*
          VIA ATUAL. Vem de `progress.currentRoadName` — o passo cuja manobra já
          foi passada, não `nextStep.roadName`, que é a via DEPOIS da próxima
          manobra. Fica aqui embaixo, discreta, para responder "em que rua eu
          estou?" sem competir com a instrução da próxima manobra lá em cima,
          que é a informação prioritária. Some quando o provedor não nomeia a
          via, em vez de mostrar um rótulo vazio.
        */}
        {progress?.currentRoadName && (
          <div className="pointer-events-auto self-start rounded-pill bg-nav-surface px-3.5 py-1.5 shadow-float">
            <p className="truncate text-[15px] font-bold text-nav-content">{progress.currentRoadName}</p>
          </div>
        )}

        {/*
          Velocidade à esquerda e controles do mapa à direita, na mesma linha
          de base. O botão de alternativa saiu daqui: o handoff o coloca na
          `NavStatsBar`, junto de "Sair", que é onde as AÇÕES da navegação
          ficam agrupadas — aqui em cima ficam só leitura e controle de câmera.
        */}
        <div className="flex items-end justify-between gap-3">
          {/*
            A PLACA FICA COLADA NA VELOCIDADE, e não num canto solto: as duas
            só significam alguma coisa uma ao lado da outra. "46 km/h" isolado
            não diz nada; "46 km/h" ao lado de uma placa de 40 diz tudo.

            Ausente quando a via não tem a tag — sem espaço reservado, sem
            placeholder. Ver SpeedLimitSign.
          */}
          <div className="flex items-end gap-2.5">
            <StatPill label="Velocidade" value={currentSpeedKmh != null ? `${currentSpeedKmh} km/h` : '—'} />
            {speedLimit && <SpeedLimitSign limit={speedLimit} currentSpeedKmh={currentSpeedKmh} />}
          </div>
          {recenterControl}
        </div>

        {/*
          `NavStatsBar` (handoff §5.1): encostada na base, raio só no topo, ETA
          em verde 30/900, a linha "distância · chegada" abaixo, e as ações à
          direita — buscar alternativa e sair.

          Ela é o único elemento do app que sangra até a borda inferior: o
          handoff a desenha assim para o painel fechar a tela, com o home
          indicator sobre o próprio escuro.
        */}
        <div className="pointer-events-auto -mx-gutter -mb-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center gap-3 rounded-t-2xl bg-nav-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-nav-panel">
          <div className="min-w-0 flex-1">
            <p className="text-eta text-success-400">{formatEta(remainingDurationMinutes)}</p>
            <p className="mt-1 truncate text-[14px] font-semibold text-nav-content-secondary">
              {formatDistance(remainingDistanceMeters)} · chegada {arrivalTime(remainingDurationMinutes)}
            </p>

            {/*
              ADEQUAÇÃO DO QUE FALTA. Este app existe para dizer se a via serve
              ao veículo, e essa informação estava ausente justamente na tela em
              que o usuário está EM CIMA das vias avaliadas — o dado já chegava
              aqui em `scoredRoute.severity` e não era usado.
              Uma barra, não uma porcentagem: "87%" não é acionável em
              movimento; ver que falta um bloco âmbar à frente é.
            */}
            {remaining && remaining.totalMeters > 0 && (
              <div className="mt-2.5 flex flex-col gap-1">
                <SuitabilityBar severity={scoredRoute.severity} breakdown={remaining} compact />
                <p className="truncate text-[12px] font-semibold text-nav-content-secondary">
                  {remainingAtRisk > 0
                    ? `${formatDistance(remainingAtRisk)} de atenção pela frente`
                    : 'Restante todo em vias adequadas'}
                </p>
              </div>
            )}
          </div>

          {onFindAlternative && (
            <button
              type="button"
              onClick={onFindAlternative}
              disabled={isSearchingAlternative}
              aria-label="Buscar rota alternativa"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-pill bg-nav-control text-nav-content transition-all duration-fast active:scale-[.97] active:opacity-[.88] disabled:opacity-60"
            >
              {isSearchingAlternative ? (
                <span className="h-[18px] w-[18px] animate-spin rounded-pill border-2 border-nav-content border-t-transparent" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 2l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 22l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onStop}
            className="flex h-[52px] shrink-0 items-center rounded-pill bg-danger-500 px-6 text-btn-primary text-white transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
          >
            Sair
          </button>
        </div>
      </div>
    </>
  )
}

/** Leitura flutuante pequena sobre o mapa (hoje só a velocidade real do GPS). */
function StatPill({
  label,
  value,
  tone = 'default',
  title,
}: {
  label: string
  value: string
  tone?: 'default' | 'go'
  title?: string
}) {
  return (
    <div
      title={title}
      className="pointer-events-auto inline-flex flex-col gap-1 rounded-lg border border-hairline/15 bg-surface-overlay px-card py-2.5 shadow-float backdrop-blur-xl"
    >
      <span className="text-eyebrow uppercase text-content-tertiary">{label}</span>
      <span className={`text-[24px] font-extrabold ${tone === 'go' ? 'text-success-500' : 'text-content-primary'}`}>
        {value}
      </span>
    </div>
  )
}

/** Hora prevista de chegada, derivada do tempo restante real — 24h, como manda o handoff. */
function arrivalTime(remainingMinutes: number): string {
  return new Date(Date.now() + remainingMinutes * 60_000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ManeuverIcon({ maneuver }: { maneuver: ManeuverType }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-brand-500 text-content-on-accent">
      {maneuver === 'turn-right' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M9 5v6a4 4 0 004 4h6M15 11l4 4-4 4" />
        </svg>
      )}
      {maneuver === 'turn-left' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M15 5v6a4 4 0 01-4 4H5M9 11L5 15l4 4" />
        </svg>
      )}
      {(maneuver === 'straight' || maneuver === 'depart' || maneuver === 'other') && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      )}
      {maneuver === 'roundabout' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 3v4M17 12h4" />
        </svg>
      )}
      {maneuver === 'arrive' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
        </svg>
      )}
    </span>
  )
}

/** Liga/desliga as instruções faladas. Ícone de alto-falante com ou sem ondas. */
function VoiceToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={enabled ? 'Desativar instruções por voz' : 'Ativar instruções por voz'}
      aria-pressed={enabled}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill transition-all duration-fast active:scale-[.97] active:opacity-[.88] ${
        enabled ? 'bg-brand-500 text-content-on-accent' : 'bg-surface-tile text-content-secondary'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M11 5L6 9H3v6h3l5 4V5z" strokeLinejoin="round" />
        {enabled ? (
          <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" strokeLinecap="round" />
        ) : (
          <path d="M16 9l5 6M21 9l-5 6" strokeLinecap="round" />
        )}
      </svg>
    </button>
  )
}
