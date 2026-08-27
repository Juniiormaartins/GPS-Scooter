# Layout de tela cheia no iOS — o que não repetir

Este documento existe por causa de um episódio concreto: uma faixa clara no
rodapé que levou **nove tentativas e várias horas** para ser corrigida. A
correção final foi reverter a mudança que a causou. As oito tentativas
anteriores foram desperdício.

## A regra que resolve

> **No iOS, dimensione a tela cheia por `100vh` (viewport GRANDE), nunca por
> `inset: 0` num elemento fixo.**

O motivo é assimétrico e é tudo que importa:

| erro | o que acontece na tela |
|---|---|
| a página fica **maior** que a área visível | transborda, é recortada, **invisível** |
| a página fica **menor** que a área visível | sobra uma **faixa** da cor de fundo |

`100vh` no iOS reporta a altura da tela com a interface do navegador recolhida —
o maior valor. Erra para mais. `inset: 0` num elemento fixo o iOS resolve contra
o viewport curto em modo standalone. Erra para menos.

Entre errar para mais e errar para menos, **só um dos dois aparece**.

## A geometria que funciona

```css
html, body, #root {
  height: 100%;
  margin: 0;
  overscroll-behavior: none;
}
```

E a raiz do app em `relative h-screen w-screen overflow-hidden` (`h-screen` é
`100vh`). O container do mapa em `absolute inset-0`.

Não mexa nisso sem uma razão forte e sem poder testar num iPhone real em modo
standalone (ícone na tela de início). O ambiente de teste do agente **não tem**
safe area, não tem modo standalone e não tem a barra de status do iOS — três
coisas que só existem no aparelho.

## O que NÃO era a causa (todas foram testadas e descartadas)

- cor de fundo de `html`, `body`, `#root` ou da raiz do app
- `background_color` / `theme_color` do manifest
- `apple-mobile-web-app-status-bar-style`
- `viewport-fit=cover`
- altura por `100lvh`, `100dvh` ou `#root` absoluto
- transbordo do mapa com inset negativo
- `overflow: hidden` nos ancestrais
- cache do service worker (ele não faz cache)

Uma pista que economiza tempo: **se a faixa muda de cor junto com o tema**, ela é
pintada por uma variável CSS da página — não pelo manifest, não pelo sistema.

## O erro de método, que custou mais que o erro técnico

O erro técnico foi trocar uma geometria que funcionava por outra. O erro de
método foi não voltar atrás.

Cada tentativa a partir da segunda foi construída **sobre a base já quebrada**.
Por isso nenhuma podia funcionar, por mais correta que fosse isoladamente. E
cada uma custou uma ida e volta com o usuário, que virou sensor de um processo
que deveria ser de medição.

**A regra:** ao segundo fracasso numa regressão visual, `git log` do arquivo,
achar o commit que a introduziu, e voltar ao estado anterior. Recomeçar dali —
não empilhar.

## Como medir no aparelho quando for preciso

Existe um painel de diagnóstico em `src/components/ui/Diagnostics.tsx`, ligado
por `?diag=1` na URL (e desligado por `?diag=0`). Ele mostra insets reais,
alturas de cada camada e a sobra na base.

Duas armadilhas descobertas na prática:

- ao adicionar à tela de início, o iOS abre a `start_url` do **manifest** e
  descarta a query — o parâmetro não chega ao modo standalone;
- um app aberto pelo ícone usa **armazenamento separado** do navegador, então
  `localStorage` não serve de ponte.

Para medir em standalone, adicione à tela de início a URL **já com `?diag=1`**,
ou aponte a `start_url` do manifest para ela temporariamente.

E o mais importante: **inclua todas as camadas na medição.** O painel media
`body`, `#root`, canvas, `innerHeight` e `visualViewport`, e deixava de fora a
`<div>` raiz do app — que era exatamente onde estava a fresta. Como tudo que era
medido concordava entre si, a conclusão era sempre "0px de sobra", e a busca ia
para fora da página.
