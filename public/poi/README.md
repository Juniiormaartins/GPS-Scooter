# Biblioteca de POIs — GPS de mobilidade elétrica

Pacote **exclusivo dos pontos de interesse** exibidos sobre o mapa. Não contém interface, mapa,
rotas nem os marcadores de veículo — nada além dos POIs e desta documentação.

```
badge/    20 SVGs — estado padrão sobre o mapa
pin/      20 SVGs — estado selecionado / destino (badge com cauda)
dot/      20 SVGs — zoom baixo / alta densidade (símbolo reduzido a 55%)
```

## Anatomia do componente

Um POI não é um ícone solto: é um **badge** com três camadas fixas.

| Camada | Especificação |
|---|---|
| Forma | squircle (superelipse) — **não** círculo puro, **não** quadrado arredondado comum. Raio efetivo ≈ 40% do lado. |
| Preenchimento | gradiente vertical de 2 paradas da categoria (tom claro no topo → tom escuro na base) |
| Realce | brilho interno superior, branco a 16%, apenas no terço de cima — dá o volume dos marcadores de veículo |
| Anel | branco a 94%, 3.4 unidades em 96 (≈ 1.4px quando renderizado a 40px) |
| Sombra | `dy 2.6`, `blur 3.2`, `#0F1729` a 34% |
| Símbolo | monoline branco, traço 2 na grade de 24, cantos e pontas redondos, ocupando **60%** do badge |

O anel branco + a sombra são o que garantem leitura sobre rua clara, rua escura, área urbana densa
e sobre os dois temas do app — sem depender da cor de fundo do mapa.

## Tamanhos e quando usar cada variante

| Contexto | Variante | Tamanho |
|---|---|---|
| Zoom baixo / muitos POIs próximos | `dot/` | 16–22px |
| Mapa padrão (exploração) | `badge/` | 30–36px |
| POI relevante / rótulo visível | `badge/` | 40px |
| POI selecionado, destino, resultado de busca | `pin/` | 40–48px (âncora na ponta) |

Âncora: `badge/` e `dot/` centralizam no ponto (50%, 50%); `pin/` ancora na **ponta inferior**
(50%, 100%). Nunca gire um POI — só o marcador do veículo rotaciona.

O `pin/` é **uma silhueta única**: squircle e cauda formam um só contorno, então o anel branco de 3.4
percorre badge e ponta sem interrupção — mesma regra de legibilidade dos badges. Não é um badge com um
espinho colado embaixo. `viewBox` 96×100.

O `dot/` mantém o símbolo em **55%** do disco, com traço engrossado para 3.4: sem isso, categorias da
mesma família cromática (transporte, recarga, estacionamento, hospedagem, serviços, genérico) ficariam
indistinguíveis a 16px. Os matizes dessas seis também foram afastados entre si — ciano, azul-royal,
violeta-azulado e dois cinza-azulados de luminosidades distintas.

## Hierarquia POI × rótulo

O POI nunca deve competir com a navegação:

- Rótulo à direita do badge, 13px peso 800, cor = tom **escuro** da categoria (a coluna
  "Cor base" da tabela), com `text-shadow: 0 1px 2px rgba(255,255,255,.9)` em tema claro e
  `0 1px 2px rgba(10,14,26,.9)` em tema escuro.
- Máximo 2 linhas, quebra por palavra.
- Durante **navegação ativa**, reduza os POIs a `dot/` a 14px e oculte os rótulos: a rota e a manobra
  têm prioridade absoluta.
- Densidade sugerida: no máximo 6–8 POIs com rótulo visíveis por tela.

## Catálogo — categoria, asset e função

| # | Categoria | Slug / asset | Cor topo | Cor base | Função no mapa |
|---|---|---|---|---|---|
| 1 | Restaurantes e alimentação | `poi_alimentacao` | `#F0784A` | `#D94E1E` | restaurantes, self-service, pizzarias |
| 2 | Cafés, lanchonetes e sobremesas | `poi_cafes` | `#D08A3A` | `#B4661A` | cafeterias, padarias, sorveterias, bares |
| 3 | Supermercados e conveniência | `poi_mercado` | `#F5AE3C` | `#E08A10` | mercados, hortifrúti, lojas de conveniência |
| 4 | Compras e comércio | `poi_compras` | `#EA6293` | `#D23A72` | shoppings, lojas, galerias |
| 5 | Saúde e hospitais | `poi_saude` | `#F0525F` | `#D62436` | hospitais, clínicas, pronto-socorro |
| 6 | Farmácias | `poi_farmacia` | `#2FBE8E` | `#0E9A6B` | farmácias e drogarias |
| 7 | Cuidados e bem-estar | `poi_bem_estar` | `#48BE8A` | `#22996A` | spa, salões, estética, academias |
| 8 | Transporte e mobilidade | `poi_transporte` | `#2E9FD8` | `#0E86C6` | terminais, paradas, estações |
| 9 | Recarga elétrica | `poi_recarga` | `#5AC8E8` | `#1FA3C9` | pontos de recarga — **relevante ao produto** |
| 10 | Postos e abastecimento | `poi_combustivel` | `#64778F` | `#44586F` | postos de combustível (cor sóbria: pouco relevante para veículo leve) |
| 11 | Estacionamento | `poi_estacionamento` | `#4E74E0` | `#2B4FC4` | estacionamentos, bicicletários pagos |
| 12 | Hospedagem | `poi_hospedagem` | `#8C7BD8` | `#6354BE` | hotéis, pousadas, hostels |
| 13 | Lazer e entretenimento | `poi_lazer` | `#E4577E` | `#C2325D` | cinemas, teatros, casas de show |
| 14 | Turismo e pontos de interesse | `poi_turismo` | `#A87B4E` | `#875C31` | museus, monumentos, marcos |
| 15 | Parques e áreas verdes | `poi_parques` | `#5FAA63` | `#3E8A46` | praças, parques, ciclovias de lazer |
| 16 | Educação | `poi_educacao` | `#96764E` | `#755430` | escolas, faculdades, cursos |
| 17 | Serviços | `poi_servicos` | `#8A98AE` | `#69788E` | oficinas, assistências, serviços gerais |
| 18 | Bancos e serviços financeiros | `poi_financeiro` | `#3A96A8` | `#1B7488` | bancos, caixas, casas de câmbio |
| 19 | Ciclismo e mobilidade leve | `poi_ciclismo` | `#2BAFCE` | `#0E8CAE` | bicicletarias, oficinas de patinete/scooter |
| 20 | Genérico / fallback | `poi_generico` | `#5B6B85` | `#414F66` | qualquer classe sem correspondência |

Lógica da paleta: **quente** = consumo (comer, comprar), **vermelho** = urgência/saúde,
**verde** = bem-estar e natureza, **azul/ciano** = mobilidade e finanças, **terroso** = cultura e
educação, **cinza-azulado** = serviços e o que é pouco relevante para veículo leve. Hospedagem usa um
violeta-azulado sóbrio apenas para se separar da faixa de mobilidade — não há gradiente violeta
decorativo em nenhum lugar.

## Mapeamento das camadas semânticas atuais → novo asset

Cobre as ~12 classes vetoriais em uso (MapTiler `poi` layer, campo `class`):

| Classe atual (MapTiler / Cloud Code) | Asset novo |
|---|---|
| `food_and_drink`, `restaurant`, `fast_food` | `poi_alimentacao` |
| `cafe`, `bar`, `bakery`, `ice_cream` | `poi_cafes` |
| `grocery`, `supermarket`, `convenience` | `poi_mercado` |
| `shop`, `shopping`, `commercial`, `mall` | `poi_compras` |
| `health`, `hospital`, `doctors`, `clinic` | `poi_saude` |
| `pharmacy` | `poi_farmacia` |
| `care`, `beauty`, `spa`, `hairdresser`, `fitness` | `poi_bem_estar` |
| `transport`, `bus`, `railway`, `terminal` | `poi_transporte` |
| `charging_station` | `poi_recarga` |
| `fuel` | `poi_combustivel` |
| `parking`, `bicycle_parking` | `poi_estacionamento` |
| `lodging`, `hotel` | `poi_hospedagem` |
| `entertainment`, `cinema`, `theatre`, `nightlife` | `poi_lazer` |
| `attraction`, `tourism`, `museum`, `monument` | `poi_turismo` |
| `park`, `garden`, `playground`, `square` | `poi_parques` |
| `education`, `school`, `college`, `university` | `poi_educacao` |
| `service`, `car_repair`, `craft`, `office` | `poi_servicos` |
| `bank`, `atm`, `finance` | `poi_financeiro` |
| `bicycle`, `bicycle_shop`, `scooter` | `poi_ciclismo` |
| qualquer outra classe / `class` nula | `poi_generico` |

Regra de fallback: classe desconhecida → `poi_generico`. Nunca esconda o POI por falta de
mapeamento.

## Implementação

Os arquivos são SVG puros, sem dependência externa e sem fonte embutida — funcionam como
`<img>`, como sprite, ou registrados no mapa (`map.addImage` do MapLibre/Mapbox após rasterizar no
`devicePixelRatio` do dispositivo, ou `UIImage` no iOS).

- Rasterize sempre a partir do SVG no DPR real (`@2x`, `@3x`) — não escale um PNG de tamanho único.
- O `viewBox` é 96×96 (`badge`), 32×32 (`dot`), 96×100 (`pin`); mantenha a proporção.
- Os ids internos dos gradientes/filtros já são únicos por categoria: pode inlinar vários no mesmo
  documento sem colisão.
- Para tema escuro nada muda: o anel branco e a sombra já resolvem os dois casos.

## Revisão de família (checado)

Todos os 20 badges compartilham forma, raio, anel, sombra, realce superior, espessura de traço e
proporção do símbolo (60%). Verificados lado a lado sobre mapa claro (`#E4EAF3`) e sobre chrome
escuro (`#0F1729`), nos três tamanhos, além de uma cena de mapa com rótulos — nenhum ícone se
destaca mais que a rota nem desaparece no fundo.

Correções aplicadas na revisão: a cauda do `pin/` passou a integrar a silhueta (antes era um espinho
sem anel branco); os `dot/` ganharam símbolo a 55% e as seis categorias da faixa azul tiveram os
matizes afastados.
