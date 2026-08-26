# Biblioteca de POIs + Marcador de Destino — GPS de mobilidade elétrica

Pacote **exclusivo dos POIs e do marcador de destino**. Não contém interface, mapa, rotas nem os
marcadores de veículo.

```
badge/     58 SVGs — estado padrão sobre o mapa (96×96)
pin/       58 SVGs — estado selecionado / resultado de busca (96×100)
dot/       58 SVGs — zoom baixo / alta densidade (32×32)
destino/    5 SVGs — marcador do destino selecionado
```

**58 categorias em 21 famílias de cor.** A expansão preservou todos os slugs da versão anterior —
nenhum asset antigo foi renomeado ou removido.

---

## Regra de fallback (obrigatória)

> **Quando um estabelecimento, negócio ou ponto de interesse não possuir correspondência com nenhuma
> categoria específica da biblioteca, o sistema deve utilizar o POI genérico (`poi_generico`) como
> fallback.**

O `poi_generico` é membro oficial da biblioteca: mesma anatomia, mesma silhueta, mesmo anel e mesma
sombra dos demais. Usa o cinza-azulado neutro `#5B6B85 → #414F66` — visível o suficiente para não
desaparecer no mapa e discreto o suficiente para nunca competir com uma categoria específica. Seu
glifo é um pino de local genérico, sem semântica de setor.

Nunca oculte um POI por falta de mapeamento; nunca invente uma categoria aproximada quando a classe
não for reconhecida. Categoria desconhecida → `poi_generico`.

---

## Princípio da família de cor

Subcategorias **compartilham exatamente a cor da família** e se diferenciam apenas pelo glifo.
Pizzaria, lanchonete e restaurante são o mesmo laranja; museu, igreja e mirante são o mesmo terroso.

É isso que faz 58 ícones conviverem no mesmo enquadramento sem virar mosaico: o usuário lê primeiro
a **cor** (que tipo de coisa é) e depois o **símbolo** (o que exatamente é). Se cada subcategoria
tivesse a própria cor, o mapa perderia a leitura em bloco.

| Família | Cor topo → base | Categorias |
|---|---|---|
| Alimentação | `#F0784A` → `#D94E1E` | `alimentacao`, `lanchonete`, `pizzaria` |
| Cafés, padaria e bar | `#D08A3A` → `#B4661A` | `cafes`, `padaria`, `sorveteria`, `bar` |
| Mercado | `#F5AE3C` → `#E08A10` | `mercado`, `hortifruti`, `feira` |
| Compras | `#EA6293` → `#D23A72` | `compras`, `loja_roupas`, `eletronicos`, `floricultura` |
| Saúde | `#F0525F` → `#D62436` | `saude`, `clinica`, `odontologia`, `laboratorio`, `veterinario` |
| Farmácia | `#2FBE8E` → `#0E9A6B` | `farmacia` |
| Bem-estar e esporte | `#48BE8A` → `#22996A` | `bem_estar`, `salao_beleza`, `academia`, `esportes` |
| Transporte | `#2E9FD8` → `#0E86C6` | `transporte`, `onibus`, `metro`, `aeroporto`, `taxi` |
| Recarga elétrica | `#5AC8E8` → `#1FA3C9` | `recarga` |
| Automotivo | `#64778F` → `#44586F` | `combustivel`, `oficina` |
| Estacionamento | `#4E74E0` → `#2B4FC4` | `estacionamento` |
| Hospedagem | `#8C7BD8` → `#6354BE` | `hospedagem` |
| Lazer e entretenimento | `#E4577E` → `#C2325D` | `lazer`, `cinema`, `teatro`, `estadio` |
| Áreas verdes | `#5FAA63` → `#3E8A46` | `parques` |
| Cultura e turismo | `#A87B4E` → `#875C31` | `turismo`, `museu`, `igreja`, `livraria`, `mirante` |
| Educação | `#96764E` → `#755430` | `educacao` |
| Serviços | `#8A98AE` → `#69788E` | `servicos`, `escritorio`, `correios`, `lavanderia`, `materiais`, `imobiliaria` |
| Segurança e serviços públicos | `#3C5A8A` → `#22406E` | `policia`, `bombeiros`, `servico_publico` |
| Financeiro | `#3A96A8` → `#1B7488` | `financeiro`, `caixa_eletronico` |
| Mobilidade leve | `#2BAFCE` → `#0E8CAE` | `ciclismo` |
| Genérico (fallback) | `#5B6B85` → `#414F66` | `generico` |

Lógica: **quente** = consumo · **vermelho** = saúde e urgência · **verde** = bem-estar, esporte e
natureza · **azul/ciano** = mobilidade, recarga e finanças · **terroso** = cultura e educação ·
**cinza-azulado** = serviços e o pouco relevante para veículo leve · **azul-marinho** = poder público.
Nenhum gradiente decorativo; a cor sempre carrega significado.

---

## Anatomia do componente

| Camada | Especificação |
|---|---|
| Forma | squircle (superelipse), raio efetivo ≈ 40% do lado — não círculo puro, não retângulo arredondado |
| Preenchimento | gradiente vertical de 2 paradas da família (claro no topo → escuro na base) |
| Realce | brilho branco a 16% no terço superior — mesmo volume dos marcadores de veículo |
| Anel | branco a 94%, 3.4 em 96 (≈1.4px quando exibido a 40px) |
| Sombra | `dy 2.6`, `blur 3.2`, `#0F1729` a 34% |
| Símbolo | monoline branco, traço 2 na grade de 24, pontas redondas, a **60%** do badge |

O anel branco + a sombra é o que garante leitura sobre rua clara, rua escura, área urbana densa e
sobre os dois temas — sem depender da cor do fundo.

O `pin/` é **uma silhueta única**: squircle e cauda formam um só contorno, então o anel percorre
badge e ponta sem interrupção. O `dot/` mantém o símbolo a **55%** com traço 3.4, para que
categorias da mesma família ainda se distingam a 16px.

## Tamanhos e variantes

| Contexto | Variante | Tamanho |
|---|---|---|
| Zoom baixo / muitos POIs próximos | `dot/` | 16–22px |
| Mapa padrão (exploração) | `badge/` | 30–36px |
| POI relevante, com rótulo | `badge/` | 40px |
| Selecionado, destino, resultado de busca | `pin/` | 40–48px |

Âncora: `badge/` e `dot/` no centro (50%, 50%); `pin/` na **ponta inferior** (50%, 100%).
Nunca gire um POI — só o marcador do veículo rotaciona.

## Hierarquia POI × rótulo

- Rótulo à direita do badge, 13px peso 800, cor = **tom base** da família, com
  `text-shadow: 0 1px 2px rgba(255,255,255,.9)` no tema claro e `0 1px 2px rgba(10,14,26,.9)` no escuro.
- Máximo 2 linhas; no máximo 6–8 POIs com rótulo por tela.
- Em **navegação ativa**, reduza tudo a `dot/` 14–16px e oculte os rótulos: rota e manobra têm
  prioridade absoluta.

---

## Marcador de destino (novo)

Substitui a bolinha atual. Reusa a **silhueta da família de POIs** — por isso pertence ao sistema —
mas com corpo **azul-marinho** `#1B2B47 → #0A1220` e um **alvo ciano concêntrico** `#35B7F7` no lugar
do glifo. O marinho é deliberado: a rota é `#0E86C6`, então um marcador azul-claro se dissolveria no
traçado; o corpo escuro cria o contraste e o ciano amarra a identidade.

| Asset | Função | Âncora |
|---|---|---|
| `destino/destino_marcador.svg` | estado padrão do destino (96×100) | ponta inferior (50%, 100%) |
| `destino/destino_marcador_ativo.svg` | destino em foco: halo + anel pulsante de 2.6s (200×200) | base do halo (50%, 70%) |
| `destino/destino_chegada_rota.svg` | tampa onde o traçado termina (72×72) | centro |
| `destino/destino_base.svg` | halo e sombra isolados, para compor no mapa (200×100) | centro da elipse |
| `destino/destino_dot.svg` | versão compacta, zoom baixo (40×40) | centro |

### Rota → chegada → marcador

A conexão precisa parecer intencional, não uma bolinha jogada sobre a linha:

1. A polyline da rota termina **no centro** da tampa de chegada — não passa por baixo dela nem para
   antes. Corte a geometria exatamente nesse ponto.
2. `destino_chegada_rota.svg` entra logo **acima** da rota e **abaixo** do marcador, a 32–36px.
   O anel branco de 4 separa o traçado do marcador; o miolo ciano repete o alvo do marcador.
3. `destino_marcador.svg` ancora com a ponta **no mesmo ponto** da tampa, então o pino "nasce" da
   chegada. Nada de deslocamento lateral.
4. Ordem de camadas: rota → tampa de chegada → halo/base (se ativo) → marcador → rótulo do destino.
5. Em zoom baixo, mantenha só a tampa e o `destino_dot.svg`; abaixo de ~14px, só o dot.

O marcador nunca gira, nunca muda de cor por categoria e nunca é substituído por um POI: se o
destino também for um POI conhecido, o POI aparece como `dot/` **atrás** do marcador de destino, não
no lugar dele.

---

## Catálogo completo (58) e mapeamento das classes

| Categoria | Asset | Família | Classes atuais (MapTiler / OSM `class`) |
|---|---|---|---|
| Restaurantes e alimentação | `poi_alimentacao` | Alimentação | `restaurant`, `food_and_drink`, `food_court` |
| Lanchonetes e fast-food | `poi_lanchonete` | Alimentação | `fast_food`, `burger`, `snack_bar` |
| Pizzarias | `poi_pizzaria` | Alimentação | `pizza` |
| Cafés e cafeterias | `poi_cafes` | Cafés, padaria e bar | `cafe`, `coffee`, `tea` |
| Padarias | `poi_padaria` | Cafés, padaria e bar | `bakery`, `pastry` |
| Sorveterias e sobremesas | `poi_sorveteria` | Cafés, padaria e bar | `ice_cream`, `dessert`, `confectionery` |
| Bares e vida noturna | `poi_bar` | Cafés, padaria e bar | `bar`, `pub`, `nightclub`, `alcohol` |
| Supermercados e conveniência | `poi_mercado` | Mercado | `grocery`, `supermarket`, `convenience` |
| Hortifrúti e produtos frescos | `poi_hortifruti` | Mercado | `greengrocer`, `farm`, `butcher`, `deli` |
| Feiras e mercados de rua | `poi_feira` | Mercado | `marketplace`, `street_market` |
| Compras e centros comerciais | `poi_compras` | Compras | `shop`, `shopping`, `mall`, `commercial`, `department_store` |
| Vestuário e moda | `poi_loja_roupas` | Compras | `clothing_store`, `clothes`, `shoes`, `jewelry` |
| Eletrônicos e tecnologia | `poi_eletronicos` | Compras | `electronics`, `computer`, `mobile_phone` |
| Floriculturas e presentes | `poi_floricultura` | Compras | `florist`, `gift` |
| Hospitais e prontos-socorros | `poi_saude` | Saúde | `hospital`, `health`, `emergency_room` |
| Clínicas e consultórios | `poi_clinica` | Saúde | `clinic`, `doctors`, `physiotherapist` |
| Odontologia | `poi_odontologia` | Saúde | `dentist` |
| Laboratórios e exames | `poi_laboratorio` | Saúde | `laboratory`, `medical_laboratory`, `blood_donation` |
| Veterinários e pet shops | `poi_veterinario` | Saúde | `veterinary`, `pet`, `pet_shop` |
| Farmácias e drogarias | `poi_farmacia` | Farmácia | `pharmacy`, `chemist` |
| Bem-estar, spa e estética | `poi_bem_estar` | Bem-estar e esporte | `care`, `spa`, `beauty`, `massage`, `sauna` |
| Salões, barbearias e beleza | `poi_salao_beleza` | Bem-estar e esporte | `hairdresser`, `barber`, `nail_salon` |
| Academias e fitness | `poi_academia` | Bem-estar e esporte | `fitness_centre`, `gym` |
| Esportes e quadras | `poi_esportes` | Bem-estar e esporte | `sports`, `pitch`, `sports_centre`, `swimming_pool` |
| Transporte público e terminais | `poi_transporte` | Transporte | `transport`, `station`, `terminal`, `public_transport` |
| Paradas e linhas de ônibus | `poi_onibus` | Transporte | `bus`, `bus_stop`, `bus_station` |
| Metrô e trens urbanos | `poi_metro` | Transporte | `railway`, `subway`, `tram`, `train_station` |
| Aeroportos | `poi_aeroporto` | Transporte | `aerodrome`, `airport`, `airfield` |
| Táxis e pontos de embarque | `poi_taxi` | Transporte | `taxi`, `ride_hailing` |
| Recarga elétrica | `poi_recarga` | Recarga elétrica | `charging_station` |
| Postos e abastecimento | `poi_combustivel` | Automotivo | `fuel`, `gas` |
| Oficinas e serviços automotivos | `poi_oficina` | Automotivo | `car_repair`, `car_parts`, `car_wash`, `tyres` |
| Estacionamentos e bicicletários | `poi_estacionamento` | Estacionamento | `parking`, `bicycle_parking`, `motorcycle_parking` |
| Hotéis e hospedagem | `poi_hospedagem` | Hospedagem | `lodging`, `hotel`, `hostel`, `guest_house`, `motel` |
| Lazer e entretenimento | `poi_lazer` | Lazer e entretenimento | `entertainment`, `nightlife`, `amusement`, `bowling` |
| Cinemas | `poi_cinema` | Lazer e entretenimento | `cinema`, `movie_theater` |
| Teatros e casas de show | `poi_teatro` | Lazer e entretenimento | `theatre`, `arts_centre`, `concert_hall` |
| Estádios e arenas | `poi_estadio` | Lazer e entretenimento | `stadium`, `arena` |
| Parques, praças e áreas verdes | `poi_parques` | Áreas verdes | `park`, `garden`, `playground`, `square`, `pitch_green` |
| Turismo e pontos de interesse | `poi_turismo` | Cultura e turismo | `attraction`, `tourism`, `monument`, `memorial`, `castle` |
| Museus e galerias | `poi_museu` | Cultura e turismo | `museum`, `gallery` |
| Igrejas e templos | `poi_igreja` | Cultura e turismo | `place_of_worship`, `church`, `temple`, `mosque`, `synagogue` |
| Livrarias e bibliotecas | `poi_livraria` | Cultura e turismo | `books`, `library` |
| Mirantes e vistas | `poi_mirante` | Cultura e turismo | `viewpoint`, `lookout` |
| Escolas e educação | `poi_educacao` | Educação | `education`, `school`, `college`, `university`, `kindergarten` |
| Serviços gerais | `poi_servicos` | Serviços | `service`, `craft`, `commercial_service`, `repair` |
| Escritórios e coworking | `poi_escritorio` | Serviços | `office`, `coworking`, `company` |
| Correios e encomendas | `poi_correios` | Serviços | `post`, `post_office`, `parcel_locker` |
| Lavanderias | `poi_lavanderia` | Serviços | `laundry`, `dry_cleaning` |
| Materiais e construção | `poi_materiais` | Serviços | `hardware`, `doityourself`, `building_materials` |
| Imobiliárias | `poi_imobiliaria` | Serviços | `estate_agent`, `real_estate` |
| Polícia e segurança | `poi_policia` | Segurança e serviços públicos | `police`, `security` |
| Bombeiros e emergência | `poi_bombeiros` | Segurança e serviços públicos | `fire_station`, `emergency` |
| Serviços públicos e órgãos | `poi_servico_publico` | Segurança e serviços públicos | `townhall`, `public_building`, `government`, `courthouse`, `embassy` |
| Bancos e serviços financeiros | `poi_financeiro` | Financeiro | `bank`, `finance`, `bureau_de_change`, `insurance` |
| Caixas eletrônicos | `poi_caixa_eletronico` | Financeiro | `atm` |
| Bicicletarias e mobilidade leve | `poi_ciclismo` | Mobilidade leve | `bicycle`, `bicycle_shop`, `bicycle_rental`, `scooter` |
| Genérico / fallback | `poi_generico` | Genérico (fallback) | qualquer outra classe, `class` nula, POI sem categoria |

Cada linha atende também os `subclass` correspondentes. Classe fora desta tabela → `poi_generico`
(ver "Regra de fallback").

---

## Implementação

SVG puro, sem dependência externa, sem fonte embutida — funciona como `<img>`, sprite, ou registrado
no mapa (`map.addImage` no MapLibre/Mapbox após rasterizar no `devicePixelRatio`, `UIImage` no iOS).

- Rasterize a partir do SVG no DPR real (@2x, @3x). Não escale um PNG único.
- `viewBox`: 96×96 (badge), 96×100 (pin), 32×32 (dot); destino conforme a tabela acima.
- Os ids de gradiente e filtro já são únicos por categoria (`g_<slug>`, `s_<slug>`): pode inlinar
  vários no mesmo documento sem colisão.
- Tema escuro não exige variantes: o anel branco e a sombra resolvem os dois casos.
- Substitua os POIs atuais 1-para-1 pelo slug correspondente da tabela; nada além da camada de POI e
  do marcador de destino precisa mudar.

## Revisão de família (checado)

Os 58 badges compartilham forma, raio, anel, sombra, realce superior, espessura de traço e proporção
do símbolo. Verificados lado a lado sobre mapa claro (`#E4EAF3`) e sobre chrome escuro (`#0F1729`),
nos três tamanhos, mais uma cena de mapa com rótulos, rota e o marcador de destino no fim do traçado.
O marcador de destino foi checado nos dois temas contra a rota `#0E86C6`: o corpo marinho mantém
separação clara do traçado em todos os tamanhos.
