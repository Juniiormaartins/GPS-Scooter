/**
 * Campo numérico que se deixa APAGAR.
 *
 * Extraído do onboarding para ser usado também no Perfil: os dois lugares
 * pedem os mesmos dois números do veículo, e duas implementações do mesmo
 * campo divergem na primeira correção. Os limites vivem aqui pelo mesmo
 * motivo — autonomia válida no onboarding tem de ser válida no Perfil.
 *
 * BUG QUE ISTO CONSERTA, e vale registrar porque é fácil reintroduzir: a
 * versão original aplicava `Math.max(min, Math.min(max, n))` a cada tecla.
 * Apagar tudo produz string vazia, `Number('')` é 0, e 0 é finito — então o
 * campo, em vez de ficar em branco, grudava no MÍNIMO. A partir daí cada
 * dígito digitado se concatenava com o número preso: digitar "10" num campo
 * travado em 6 dava 610, que o clamp então cortava para o máximo.
 *
 * A CAUSA DE FUNDO é validar durante a DIGITAÇÃO. Um número em construção é
 * quase sempre inválido — "" e "1" são estados legítimos no caminho para "120"
 * — e corrigi-los na hora impede o usuário de chegar ao valor que quer. Aqui o
 * campo aceita vazio e só ajusta à faixa quando o dedo sai (`onBlur`).
 *
 * `type="text"` com `inputMode="numeric"`, e não `type="number"`: o campo
 * numérico do navegador tem comportamento próprio de incremento, aceita "e" e
 * "-", e em alguns navegadores devolve string vazia para valores que ele julga
 * inválidos — o que reintroduziria exatamente esta classe de bug.
 */

/**
 * Faixas aceitas.
 *
 * Largas de propósito. O ponto do campo livre é o app se adaptar ao veículo
 * real, não o contrário: uma scooter de 120 km de autonomia e uma bicicleta de
 * 25 km/h precisam caber igual. Os limites existem só para barrar o que não
 * pode ser um veículo — não para impor um catálogo.
 */
export const RANGE_LIMITS = { min: 5, max: 400 }
export const SPEED_LIMITS = { min: 6, max: 120 }

interface NumberFieldProps {
  label: string
  unit: string
  /** null = campo vazio. É um estado válido enquanto se digita. */
  value: number | null
  min: number
  max: number
  onChange: (value: number | null) => void
}

export function NumberField({ label, unit, value, min, max, onChange }: NumberFieldProps) {
  return (
    <label className="flex-1">
      <span className="block text-[12px] font-bold uppercase tracking-wide text-content-tertiary">{label}</span>
      <span className="mt-1 flex items-baseline gap-1 rounded-lg border border-hairline/[.12] bg-surface-tile px-3 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={value == null ? '' : String(value)}
          onChange={(event) => {
            const texto = event.target.value.replace(/\D/g, '')
            if (texto === '') {
              onChange(null)
              return
            }
            // Sem clamp aqui: "1" a caminho de "120" não pode virar o mínimo.
            onChange(Number(texto))
          }}
          onBlur={() => {
            if (value == null) return
            const ajustado = Math.max(min, Math.min(max, value))
            if (ajustado !== value) onChange(ajustado)
          }}
          className="w-full min-w-0 bg-transparent text-[18px] font-extrabold text-content-primary outline-none"
        />
        <span className="shrink-0 text-[12.5px] font-bold text-content-tertiary">{unit}</span>
      </span>
    </label>
  )
}
