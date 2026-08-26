import { useEffect, useRef, useState } from 'react'
import type { AutonomyState } from '@/services/vehicle/autonomy'

/**
 * CONFIRMAÇÃO DE BATERIA A CADA SESSÃO.
 *
 * O BURACO QUE ISTO TAPA, e ele é grave. O odômetro que desconta a estimativa
 * só enxerga o que o app viu: distância percorrida com a navegação aberta. Se a
 * pessoa informa 100%, fecha o GPS, roda 20% da bateria e volta, o app continua
 * afirmando 100% — e afirma isso com a mesma cara de confiança de sempre.
 *
 * O erro cai para o LADO ERRADO. Superestimar autonomia é o que faz alguém sair
 * confiando num alcance que não tem; subestimar só faz parar antes. Um app que
 * opina sobre bateria não pode errar para cima em silêncio.
 *
 * A IDADE DO DADO NÃO RESOLVE sozinha: 20% de bateria podem ir embora em trinta
 * minutos. O sinal certo é a SESSÃO — o app esteve fechado, portanto esteve
 * cego, portanto precisa perguntar de novo.
 *
 * E É UMA CONFIRMAÇÃO, NÃO UM FORMULÁRIO. Um toque em "Sim" quando nada mudou;
 * o controle de porcentagem só aparece para quem responde que mudou. Essa é a
 * diferença entre perguntar toda vez (aceitável) e obrigar a preencher toda vez
 * (que é o que torna um app cansativo de abrir).
 */

/**
 * Marcador de sessão. `sessionStorage` some quando o app é FECHADO — inclusive
 * quando o PWA é encerrado e reaberto — mas sobrevive a um recarregamento da
 * página. É exatamente a distinção que interessa: recarregar não é ficar cego,
 * fechar é.
 */
const SESSION_KEY = 'gps-scooter:battery-session'

/**
 * Volta do segundo plano depois disto e a sessão é tratada como nova.
 *
 * Trocar de app por dez segundos para ver uma mensagem não é sair pilotando.
 * Vinte minutos é onde deixa de ser plausível que o veículo tenha ficado
 * parado.
 */
const BACKGROUND_THRESHOLD_MS = 20 * 60 * 1000

/** Confirmou agora há pouco? Não pergunta de novo — cobre o recarregar em sequência. */
const RECENT_CONFIRM_MS = 15 * 60 * 1000

export function useBatteryCheckIn(autonomy: AutonomyState) {
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  // Sessão nova: o app esteve fechado desde a última confirmação.
  useEffect(() => {
    // Sem bateria informada não há o que confirmar — nesse caso quem pede é o
    // próprio onboarding, e perguntar duas coisas ao mesmo tempo confunde.
    if (autonomy.informedAt == null) return

    let novaSessao = false
    try {
      novaSessao = sessionStorage.getItem(SESSION_KEY) == null
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // sessionStorage indisponível (modo privado em alguns navegadores):
      // trata como sessão nova. Perguntar a mais é o erro barato aqui.
      novaSessao = true
    }

    if (novaSessao && Date.now() - autonomy.informedAt > RECENT_CONFIRM_MS) {
      setPrecisaConfirmar(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Volta do segundo plano depois de um tempo longo o bastante para ter rodado.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        return
      }
      const saiuEm = hiddenAt.current
      hiddenAt.current = null
      if (saiuEm == null || autonomy.informedAt == null) return
      if (Date.now() - saiuEm < BACKGROUND_THRESHOLD_MS) return
      if (Date.now() - autonomy.informedAt < RECENT_CONFIRM_MS) return
      setPrecisaConfirmar(true)
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [autonomy.informedAt])

  return {
    precisaConfirmar,
    dispensar: () => setPrecisaConfirmar(false),
  }
}
