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

Existiu um painel de diagnóstico (`?diag=1`) que foi **removido** depois de
cumprir seu papel — ele aparecia na tela e não tem lugar num app em uso. Se for
preciso medir de novo, vale reconstruí-lo com o que se aprendeu:

**Meça TODAS as camadas.** O painel original media `body`, `#root`, canvas,
`innerHeight` e `visualViewport`, e deixava de fora a `<div>` raiz do app — que
era exatamente onde estava a fresta. Como tudo que era medido concordava entre
si, a conclusão era sempre "0px de sobra", e a busca ia para fora da página.
Meça também o `top` de cada camada, não só a altura: duas caixas de mesma altura
podem estar deslocadas uma da outra.

**Duas armadilhas para chegar ao modo standalone:**

- ao adicionar à tela de início, o iOS abre a `start_url` do **manifest** e
  descarta a query — um parâmetro de URL não chega lá;
- um app aberto pelo ícone usa **armazenamento separado** do navegador, então
  `localStorage` não serve de ponte.

A saída é adicionar à tela de início a URL **já com o parâmetro**, ou apontar a
`start_url` do manifest para ela temporariamente.

**O teste que realmente resolveu** foi pintar cada camada de uma cor berrante
(`html` magenta, `body` ciano, raiz do app verde) e pedir um print. Uma imagem
identificou a camada culpada depois de oito tentativas às cegas. Se houver dúvida
sobre qual elemento pinta alguma coisa, faça isso primeiro, não por último.
