import type { ReactNode } from 'react'
import { SectionLabel } from '@/components/ui/primitives'

/**
 * Grupo de preferências: um cartão, linhas separadas por divisória.
 *
 * POR QUE ISTO EXISTE. A aba Perfil era uma sequência de cartões
 * independentes — cada preferência com sua própria borda, seu próprio fundo e
 * seu próprio arredondamento — separados por rótulos minúsculos. Nada na
 * apresentação dizia que "velocidade de referência" e "autonomia" pertencem ao
 * mesmo assunto e que "tema escuro" não pertence a nenhum dos dois. O
 * resultado era o que se descreveu: uma tela onde opções foram se acumulando.
 *
 * Com o cartão pertencendo ao GRUPO, a divisória passa a ser o que separa
 * irmãos e o espaço em branco o que separa assuntos — a hierarquia fica na
 * estrutura, não na leitura de cada rótulo.
 *
 * O `footnote` fica FORA do cartão, em texto terciário: é contexto sobre o
 * grupo inteiro, e dentro do cartão competiria com as próprias opções.
 */
export function SettingsGroup({
  title,
  footnote,
  children,
}: {
  title?: string
  footnote?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-group first:mt-0">
      {title && <SectionLabel className="mb-stack">{title}</SectionLabel>}
      <div className="overflow-hidden rounded-xl border border-hairline/10 bg-surface-card">
        {/*
          `divide-y` no wrapper interno, e não no externo: o `overflow-hidden`
          do cartão é o que apara os cantos das linhas, e aplicar as duas
          coisas no mesmo elemento faz a primeira e a última divisória
          aparecerem sobre a borda do cartão.
        */}
        <div className="divide-y divide-hairline/10">{children}</div>
      </div>
      {footnote && <p className="mt-2 px-1 text-caption text-content-tertiary">{footnote}</p>}
    </section>
  )
}
