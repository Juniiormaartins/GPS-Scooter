import type { SpeedLimit } from '@/services/navigation/speedLimit'

/**
 * Placa de limite de velocidade.
 *
 * DESENHADA COMO A PLACA REAL — círculo branco, anel vermelho, número preto —
 * porque é assim que a informação é reconhecida sem ser lida. Alguém pilotando
 * não tem atenção sobrando para interpretar um rótulo novo; tem para reconhecer
 * um símbolo que já conhece da rua.
 *
 * Só é renderizada quando existe número. Não há estado "desconhecido", não há
 * placa vazia, não há traço: se a via não foi etiquetada no OpenStreetMap, o
 * espaço simplesmente não existe. Ver speedLimit.ts para o porquê.
 *
 * NÃO INVERTE COM O TEMA. Placa de trânsito é branca com anel vermelho em
 * qualquer lugar do mundo e a qualquer hora do dia — escurecê-la no tema noturno
 * a tornaria irreconhecível justamente para ganhar uma coerência que ninguém
 * pediu.
 */
export function SpeedLimitSign({
  limit,
  currentSpeedKmh,
}: {
  limit: SpeedLimit
  /** Velocidade medida, para destacar a placa quando ela é ultrapassada. null = sem leitura confiável. */
  currentSpeedKmh: number | null
}) {
  /*
    MARGEM DE 5 km/h antes de destacar.

    A velocidade vem do GPS, filtrada, e oscila alguns km/h mesmo em ritmo
    constante. Sem margem, a placa piscaria de destacada para normal em
    velocidade de cruzeiro — o que ensina o usuário a ignorá-la.
  */
  const excedendo = currentSpeedKmh != null && currentSpeedKmh > limit.kmh + 5

  return (
    <span
      className={`pointer-events-none flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-pill bg-white shadow-float transition-all duration-base ${
        excedendo ? 'ring-[5px] ring-danger-500 scale-105' : 'ring-[5px] ring-[#D92626]'
      }`}
      role="img"
      aria-label={`Limite de velocidade da via: ${limit.kmh} quilômetros por hora${
        excedendo ? '. Você está acima do limite' : ''
      }`}
    >
      <span className="text-[21px] font-black leading-none text-[#141A24] tabular-nums">{limit.kmh}</span>
    </span>
  )
}
