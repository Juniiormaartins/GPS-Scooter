/**
 * Interpolação do deslocamento do usuário entre amostras de GPS.
 *
 * PROBLEMA QUE ISTO RESOLVE. O GPS entrega uma posição por segundo, e o
 * marcador era reposicionado direto em cada uma — daí o "pulo" de ponto em
 * ponto. A câmera, por sua vez, era animada com `easeTo` de 1100 ms disparado
 * a cada amostra: como o intervalo entre amostras é ~1000 ms, a animação nunca
 * terminava, cada nova amostra cancelava a anterior no meio, e a câmera vivia
 * uma amostra atrás do marcador. Era esse o sintoma de "a câmera não acompanha
 * o marcador nas curvas".
 *
 * A CORREÇÃO É TER UMA FONTE SÓ. Este módulo mantém uma posição VISUAL que
 * caminha da amostra anterior até a atual, atualizada a cada quadro. Marcador
 * e câmera leem essa mesma posição no mesmo quadro, então é impossível um
 * ficar atrás do outro — não existe mais animação da câmera concorrendo com
 * nada, porque a câmera não anima: ela é reposicionada por quadro, que é como
 * navegadores nativos fazem.
 *
 * DURAÇÃO MEDIDA, NÃO CHUTADA. A interpolação dura o intervalo REAL entre as
 * duas últimas amostras. Um GPS que entrega a 2 Hz produz transições de 500 ms
 * e um a 0,5 Hz produz de 2 s, sem ninguém configurar nada — e sem o atraso
 * que uma duração fixa generosa causaria.
 *
 * SEM EXTRAPOLAÇÃO. Chegando ao alvo antes da próxima amostra, o marcador
 * PARA. Continuar andando na direção anterior seria adivinhar onde o usuário
 * está, e num GPS isso é exatamente o erro que faz o marcador atravessar
 * paredes num túnel ou seguir reto numa curva.
 */

export interface RiderSample {
  lng: number
  lat: number
  /** Rumo do deslocamento em graus (bússola). `null` = sem direção confiável. */
  headingDeg: number | null
}

export interface RiderFrame {
  lng: number
  lat: number
  headingDeg: number | null
}

/** Piso e teto da duração da transição. */
const MIN_DURATION_MS = 350
const MAX_DURATION_MS = 2500
/** Usada só na segunda amostra, quando ainda não há intervalo medido. */
const DEFAULT_DURATION_MS = 1000

/**
 * Acima desta distância a posição é assumida de uma vez, sem deslizar.
 *
 * Cobre recálculo de rota, retomada depois do app em segundo plano e salto de
 * GPS ao sair de um túnel ou garagem. Deslizar 300 m em um segundo produziria
 * um voo pelo mapa que não descreve deslocamento nenhum; o corte é honesto.
 */
const SNAP_DISTANCE_METERS = 60

/**
 * Abaixo disto a posição nova é ignorada e o marcador fica onde está.
 *
 * Parado, o GPS oscila 1–3 m entre amostras. Sem esta faixa morta o marcador
 * vibraria no lugar e — pior — o rumo derivado desse tremor giraria sozinho.
 */
const DEAD_ZONE_METERS = 0.8

function distanceMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6371000
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLng = (b.lng - a.lng) * toRad
  const lat1 = a.lat * toRad
  const lat2 = b.lat * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Interpola ângulos pelo arco curto: 350° → 10° são 20°, não 340°. */
function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180
  return (from + delta * t + 360) % 360
}

export class RiderAnimator {
  private from: RiderFrame | null = null
  private to: RiderFrame | null = null
  private startedAt = 0
  private durationMs = DEFAULT_DURATION_MS
  private lastSampleAt: number | null = null
  private frameId: number | null = null
  private onFrame: ((frame: RiderFrame) => void) | null = null
  /** Posição visual corrente — é ela que marcador e câmera leem. */
  private current: RiderFrame | null = null

  /** Última posição visual calculada, ou null antes da primeira amostra. */
  snapshot(): RiderFrame | null {
    return this.current
  }

  /**
   * Registra a amostra mais recente do GPS.
   *
   * A transição SEMPRE parte da posição visual corrente, nunca da amostra
   * anterior. É isso que impede o teletransporte quando uma amostra chega no
   * meio de uma interpolação: o marcador continua de onde o olho o vê.
   */
  push(sample: RiderSample, now = performance.now()) {
    const target: RiderFrame = { lng: sample.lng, lat: sample.lat, headingDeg: sample.headingDeg }

    if (!this.current) {
      this.current = { ...target }
      this.from = { ...target }
      this.to = { ...target }
      this.startedAt = now
      this.lastSampleAt = now
      return
    }

    const moved = distanceMeters(this.current, target)

    // Intervalo real entre esta amostra e a anterior. É ele que dita quanto
    // tempo a transição deve durar para terminar quando a próxima chegar.
    const interval = this.lastSampleAt == null ? DEFAULT_DURATION_MS : now - this.lastSampleAt
    this.lastSampleAt = now

    if (moved >= SNAP_DISTANCE_METERS) {
      this.current = { ...target }
      this.from = { ...target }
      this.to = { ...target }
      this.startedAt = now
      this.durationMs = MIN_DURATION_MS
      return
    }

    if (moved < DEAD_ZONE_METERS) {
      // Parado. A posição não muda, mas o rumo pode ter mudado (o usuário
      // girou o guidão, ou a rota recalculou), então o alvo angular acompanha.
      if (this.to) this.to.headingDeg = target.headingDeg
      return
    }

    this.from = { ...this.current }
    this.to = target
    this.startedAt = now
    this.durationMs = Math.min(Math.max(interval, MIN_DURATION_MS), MAX_DURATION_MS)
  }

  /** Descarta o estado — usado ao sair da navegação, para a próxima começar limpa. */
  reset() {
    this.from = null
    this.to = null
    this.current = null
    this.lastSampleAt = null
    this.durationMs = DEFAULT_DURATION_MS
  }

  start(onFrame: (frame: RiderFrame) => void) {
    this.onFrame = onFrame
    if (this.frameId != null) return
    const tick = () => {
      this.frameId = requestAnimationFrame(tick)
      const frame = this.advance(performance.now())
      if (frame && this.onFrame) this.onFrame(frame)
    }
    this.frameId = requestAnimationFrame(tick)
  }

  stop() {
    if (this.frameId != null) cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.onFrame = null
  }

  private advance(now: number): RiderFrame | null {
    const from = this.from
    const to = this.to
    if (!from || !to) return this.current

    // Linear de propósito: entre duas amostras o usuário andou a velocidade
    // aproximadamente constante, e é essa velocidade que a interpolação deve
    // reproduzir. Uma curva de aceleração aqui inventaria uma dinâmica que o
    // dado não tem, e o marcador desaceleraria antes de cada amostra —
    // exatamente o "soluço" a cada segundo que se quer evitar.
    const t = this.durationMs <= 0 ? 1 : Math.min((now - this.startedAt) / this.durationMs, 1)

    const headingDeg =
      to.headingDeg == null
        ? from.headingDeg
        : from.headingDeg == null
          ? to.headingDeg
          : lerpAngle(from.headingDeg, to.headingDeg, t)

    this.current = {
      lng: from.lng + (to.lng - from.lng) * t,
      lat: from.lat + (to.lat - from.lat) * t,
      headingDeg,
    }
    return this.current
  }
}
