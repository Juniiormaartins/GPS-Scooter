import { useCallback, useEffect, useState } from 'react'
import { getUserPreferences, setUserPreferences, type UserPreferences } from '@/config/userPreferences'
import { setPreferredVoice } from '@/services/navigation/voiceGuidance'

/**
 * Preferências do usuário como estado reativo do app.
 *
 * Existe porque tema e perfil de veículo precisam refletir na interface
 * inteira no instante em que mudam — ler o localStorage direto dentro de cada
 * componente (como era antes) não notifica ninguém. O tema é aplicado no
 * elemento <html> via `data-theme`, de onde o CSS deriva todas as cores.
 */
export function useUserPreferences() {
  const [preferences, setPreferencesState] = useState<UserPreferences>(() => getUserPreferences())

  // Aplica o tema no documento — é o que faz a troca valer para todas as
  // telas de uma vez, inclusive as que não recebem estas props.
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme
    // Mantém a barra de status do iOS/Android coerente com o tema escolhido.
    const themeColor = preferences.theme === 'dark' ? '#0A0E1A' : '#F4F6FB'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
  }, [preferences.theme])

  // A síntese de voz é um singleton fora do React (fila de fala), então a
  // escolha do usuário precisa ser empurrada para lá — inclusive no primeiro
  // render, senão a preferência salva só valeria depois de ser trocada.
  useEffect(() => {
    setPreferredVoice(preferences.voiceUri)
  }, [preferences.voiceUri])

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPreferencesState((current) => {
      const next = { ...current, ...patch }
      setUserPreferences(next)
      return next
    })
  }, [])

  return { preferences, update }
}
