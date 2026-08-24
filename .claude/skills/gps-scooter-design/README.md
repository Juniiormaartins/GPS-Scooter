# Handoff: Interface GPS Scooter (design system + UI kit)

## Visão geral

Este pacote contém a camada visual completa do app GPS Scooter: tokens de design, componentes de UI,
guias de fundamentos e um protótipo clicável de 8 telas (explorar, busca, opções de rota, navegação,
salvos, atividade, detalhes da viagem, perfil).

O objetivo da migração é **substituir apenas a camada de apresentação** do projeto que já existe no
Claude Code, preservando integralmente lógica, estado, integrações, serviços de rota, permissões de
localização e — muito importante — **o mapa real do provedor já utilizado**.

## Sobre os arquivos deste pacote

Os arquivos aqui são **referências de design escritas em HTML/JSX de protótipo** — mostram a
aparência e o comportamento pretendidos. **Não são código de produção para copiar e colar.**
A tarefa é **recriar estes designs no ambiente já existente do projeto** (React Native, Expo, Flutter,
React web, SwiftUI — o que o projeto usar hoje), seguindo os padrões, bibliotecas e convenções que
o codebase já adota. Os valores numéricos (cores, espaçamentos, tipografia, raios) devem ser
copiados **exatamente**; a implementação técnica deve ser a do projeto.

Não há exportação automática entre Claude Design e Claude Code. As duas formas suportadas de
levar este trabalho adiante são:

1. **Baixar este pacote** (zip) e colocá-lo dentro do repositório do projeto, por exemplo em
   `design/gps-scooter-ui/`. Depois, no Claude Code, apontar para essa pasta: *"implemente as telas
   descritas em design/gps-scooter-ui/README.md usando nossos componentes atuais; não toque na
   camada de mapa"*.
2. **Usar o `SKILL.md` incluído** como Agent Skill do Claude Code: copie a pasta inteira para
   `.claude/skills/gps-scooter-design/`. Assim o Claude Code passa a ter as regras da marca, os
   tokens e os componentes disponíveis em qualquer tarefa futura, sem precisar reexplicar o design.

Recomendação: faça as duas coisas. (1) para esta migração, (2) para o dia a dia depois dela.

## Fidelidade

**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios, sombras e estados são finais e
devem ser reproduzidos pixel a pixel. Duas ressalvas honestas, porque o design foi derivado de
screenshots e não de um Figma/código original:

- **Tipografia:** o app usa uma sans geométrica arredondada não identificada. O pacote usa **Nunito**
  (Google Fonts) como substituto mais próximo. Se o projeto já tem a fonte real, troque em um único
  lugar (`tokens/fonts.css` → `--font-core`).
- **Ícones:** substituídos por **Lucide** (traço 2px, pontas arredondadas). Se o projeto já tem um
  set de ícones, use o dele e mantenha traço 2px / 24px de grid.

## O mapa — regra que não pode ser violada

`components/map/MapCanvas.jsx` é **apenas um cenário decorativo** feito para o protótipo funcionar
fora do app. **Ele não deve ser portado.**

No projeto principal:
- mantenha o componente de mapa real (Mapbox / Google Maps / MapLibre / o que estiver em uso), com
  ruas, POIs, gestos de pan/zoom e a câmera atual;
- aplique **apenas a estilização escura** descrita em "Cartografia" abaixo ao estilo do mapa real;
- desenhe as rotas como *polylines* reais do provedor, usando as cores semânticas dos tokens;
- toda a UI nova entra como **camada flutuante acima do mapa** (overlay), sem interceptar os gestos
  do mapa — só os próprios controles devem capturar toque.

### Cartografia (aplicar ao estilo do mapa real)

| Elemento | Valor |
|---|---|
| Fundo / água | `#0E1424` |
| Vias principais | `#2B3A56` |
| Vias secundárias | `#131C2E` |
| Grade / malha sutil | branco-azulado a 5% (`rgba(53,183,247,.05)`) |
| POIs | pontos `#3B4C6B`, sem rótulos além dos essenciais |
| Rótulos | `#8A9CB6`, peso 600, sem halo branco |
| Rota ativa | `#35B7F7`, 16px, ponta arredondada, glow `0 0 16px rgba(53,183,247,.45)` |
| Rota recomendada | `#2FD16A`, 16px, sólida |
| Rota com ressalva | `#F5A623`, 16px, pontilhada |
| Rota não recomendada | `#F04545`, 14px, pontilhada |
| Marcador do usuário (parado) | disco `#35B7F7` 22px + halo `rgba(53,183,247,.22)` 48px |
| Marcador do usuário (navegando) | anel branco 5px sobre a linha, mesmo halo |

---

## Design tokens

Fonte da verdade: `styles.css` + `tokens/`. São CSS custom properties; se o projeto for
React Native/Flutter, transcreva para o formato de tema equivalente mantendo os mesmos nomes.

### Cores — superfícies (do fundo ao topo)

| Token | Hex | Uso |
|---|---|---|
| `--ink-1000` | `#05080F` | fundo fora do app (desk do protótipo) |
| `--bg-app` / `--ink-950` | `#0A0E1A` | fundo de todas as telas de lista |
| `--bg-map` / `--ink-900` | `#0E1424` | fundo do mapa |
| `--surface-sunken` / `--ink-850` | `#131C2E` | faixa de busca, fundo de opção de rota não selecionada |
| `--surface-card` / `--ink-800` | `#1A2438` | cards, linhas de lista, bottom sheet |
| `--surface-card-raised` / `--ink-700` | `#212D45` | chips, card selecionado, botão secundário |
| `--surface-tile` / `--ink-600` | `#2B3A56` | tile de ícone, vias do mapa |
| `--ink-500` | `#3B4C6B` | trilho de switch desligado, POIs |
| `--surface-overlay` | `rgba(26,36,56,.86)` | qualquer coisa flutuando sobre o mapa |

**Profundidade em fundo escuro se expressa subindo essa rampa, não com sombra.**

### Cores — texto

| Token | Hex |
|---|---|
| `--text-primary` | `#FFFFFF` |
| `--text-secondary` | `#8A9CB6` |
| `--text-tertiary` | `#64748B` |
| `--text-accent` | `#35B7F7` |
| `--text-on-accent` | `#05080F` (texto sobre botão azul/verde) |

### Cores — acentos (cada um com uma função fixa)

| Token | Hex | Significado |
|---|---|---|
| `--accent-primary` | `#35B7F7` | navegação, links, seleção, rota ativa |
| `--accent-go` | `#2FD16A` | confirmar/iniciar, bateria, rota segura, ganho ecológico |
| `--accent-warn` | `#F5A623` | locais salvos, rota alternativa |
| `--accent-danger` | `#F04545` | ações destrutivas, via não recomendada |

Versões translúcidas para fundos de tag/chip: `--blue-a16` `rgba(53,183,247,.16)`,
`--green-a16` `rgba(47,209,106,.16)`, `--amber-a16` `rgba(245,166,35,.16)`,
`--red-a16` `rgba(240,69,69,.16)`.

**Nunca** use cor como decoração, nem gradiente colorido, nem roxo/violeta. Não existe tema claro.

### Tipografia

Família única: `Nunito` (substituto) — pesos 400 / 600 / 700 / 800 / 900.

| Papel | Tamanho | Peso | Extra |
|---|---|---|---|
| Título de tela ("Salvos") | 34px | 800 | tracking −0.4px, line-height 1.1 |
| Título de barra ("Detalhes da Viagem") | 22px | 800 | line-height 1.2 |
| Métrica ("8 min", "22 km/h") | 26–27px | 800 | tracking −0.2px |
| Título de linha ("Parque do Ibirapuera") | 17px | 700 | line-height 1.25 |
| Corpo / endereço | 15px | 400 | line-height 1.4 |
| Legenda | 13px | 400 | — |
| Eyebrow ("LOCAIS FAVORITOS") | 12px | 800 | UPPERCASE, tracking 1.2px |
| Tag ("RECOMENDADA") | 11px | 800 | UPPERCASE, tracking 0.6px |

Hierarquia vem de **peso e tamanho**, não de cor. Números são o maior elemento de qualquer tela de mapa.

### Espaçamento

Escala base 4: `4 8 12 16 20 24 32 40 48`.

| Token | Valor |
|---|---|
| `--screen-gutter` | 20px (lateral de toda tela) |
| `--stack-gap` | 12px (entre cards irmãos) |
| `--group-gap` | 24px (entre grupos rotulados) |
| `--card-pad-x/y` | 16px |
| `--row-min-height` | 72px |
| `--tap-target` | 44px (mínimo absoluto) |
| `--safe-top` / `--safe-bottom` | 44px / 34px |

### Raios

`8` tags · `12` tiles de ícone e campo de busca · `16` stat tiles e opções de rota ·
`20` cards e linhas de lista · `28` barras flutuantes e bottom sheet · `999` pills.
Nada no produto tem canto reto.

### Bordas, sombras, blur

- Hairline em cards: `1px rgba(255,255,255,.06)`; em chrome flutuante: `1px rgba(255,255,255,.10)`.
- Seleção: `2px solid #35B7F7` — a **única** borda colorida do sistema.
- Cards em fluxo: **sem sombra**.
- Chrome flutuante: `0 8px 24px rgba(0,0,0,.45)` + `backdrop-filter: blur(20px)` + fill 86%.
- Bottom sheet: `0 -12px 32px rgba(0,0,0,.55)`, cantos superiores 28px.
- Glow só em geometria viva de navegação (linha da rota, marcador).

### Movimento

| Token | Valor | Uso |
|---|---|---|
| `--dur-fast` | 120ms | press |
| `--dur-base` | 200ms | seleção, switch, chip |
| `--dur-slow` | 320ms | bottom sheet, push de tela |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | entradas |
| `--ease-standard` | `cubic-bezier(.4,0,.2,1)` | o resto |

**Press:** `scale(0.97)` + opacidade 0.88. A cor de fundo **não muda**.
Sem bounce, sem spring, sem overshoot. Hover não é estado (produto touch).

---

## Componentes

27 componentes em `components/`. Cada pasta tem `<Nome>.jsx` (referência),
`<Nome>.d.ts` (contrato de props) e `<Nome>.prompt.md` (quando e como usar).
Comece pelos `.d.ts` e `.prompt.md` — eles descrevem a API sem o ruído do protótipo.

| Grupo | Componentes |
|---|---|
| `core/` | `Icon`, `Button`, `IconButton`, `Chip`, `Tag`, `Card`, `SectionLabel`, `StatTile`, `Avatar` |
| `forms/` | `SearchField`, `RouteSearchField`, `Toggle`, `SettingsRow` |
| `navigation/` | `NavHeader`, `TabBar`, `GuidanceBanner`, `StatusBar` (+ `HomeIndicator`) |
| `data/` | `ListRow`, `SkeletonRow` |
| `map/` | `MapCanvas` ⚠️ não portar, `LocationPuck`, `BottomSheet`, `RouteOptionCard`, `StatPill`, `NavStatsBar`, `VehicleStatusBar` |

Notas de implementação:
- `Button` variantes: `go` (verde, CTA de ação), `primary` (azul), `secondary`, `quiet`
  (azul 16%, ex. "+ Adicionar"), `ghost`, `destructive` (label vermelho sobre card).
  Altura `lg` 56px / `md` 48px / `sm` 36px. Largura 100% em CTA de tela.
- `ListRow` é o componente mais reutilizado: tile de ícone 52px + título + subtítulo +
  valor à direita ou chevron. Variante `divider` (sem fill, hairline inferior) para resultados de busca.
- `StatusBar`/`HomeIndicator` são **chrome de mockup** — descarte no app real, use as safe areas do sistema.
- `Icon` é um wrapper sobre Lucide; troque pela biblioteca de ícones do projeto mantendo os nomes.

---

## Telas

Frame de referência: **393 × 852** (iPhone 15 lógico). Arquivos em `ui_kits/scooter-app/`.

### 1. Explorar — `ExploreScreen.jsx`
Mapa real em tela cheia. Sobreposto: `RouteSearchField` no topo (gutter 20px, abaixo da safe area),
e no rodapé, empilhados com gap 12px, `VehicleStatusBar` e `TabBar`, acima do home indicator.
Toque na barra de busca → tela de Busca. Avatar → Perfil.
Copy: origem "Sua localização", destino "Para onde?", veículo "Ninebot Max G30 · Conectado via
Bluetooth · 84% · 38 km restáveis".

### 2. Busca — `SearchScreen.jsx`
Sem mapa. Cabeçalho em `--surface-sunken`: seta voltar + `SearchField` focado (borda azul 2px) com
o valor digitado em 17px/700 e botão limpar; abaixo, fila horizontal de `Chip` com gap 12px
("Restaurantes", "Postos", "Estacionar"). Corpo: eyebrow "RESULTADOS" e `ListRow` variante
`divider` com tile circular azul, endereço e distância à direita. Último item: `SkeletonRow`
(barras estáticas, sem shimmer). Toque no resultado → Opções de rota.

### 3. Opções de rota — `RouteScreens.jsx`
Mapa com as rotas candidatas desenhadas simultaneamente (verde sólida, âmbar pontilhada, vermelha
pontilhada). `BottomSheet` ancorado embaixo: handle 56×5px, eyebrow "OPÇÕES DE ROTA", três
`RouteOptionCard` com gap 12px e, ao final, `Button variant="go" size="lg"` "Iniciar Navegação"
com ícone `navigation`, margem superior 20px.
Cada opção traz tag, distância, **o motivo em uma frase** e o ETA em 26px/800 à direita.
Exatamente uma opção selecionada (borda azul 2px + fill um passo acima).

### 4. Navegação — `RouteScreens.jsx`
`GuidanceBanner` no topo: tile 60px azul com o ícone da manobra, instrução 21px/800
("Vire à esquerda"), linha secundária com a rua e a distância em azul ("350m"), botão ✕ para encerrar.
Rodapé: `StatPill` "VELOCIDADE 22 km/h" à esquerda e "BATERIA 82%" (verde) à direita, e abaixo
`NavStatsBar` com três colunas — chegada `10:04` (azul), "6 min" restantes, "1.3 km" restantes.
Marcador em anel branco sobre a linha azul com glow.

### 5. Salvos — `ListScreens.jsx`
`NavHeader title="Salvos"` com ação `Button variant="quiet" size="sm"` "+ Adicionar".
Dois atalhos lado a lado (Casa / Trabalho) com ícone azul, rótulo 17/700 e valor 14px secundário —
"Definir endereço" quando vazio. Eyebrow "LOCAIS FAVORITOS" e `ListRow` com estrela âmbar + chevron.

### 6. Atividade — `ListScreens.jsx`
`NavHeader title="Atividade"`. Grupos por eyebrow "HOJE" / "ONTEM" / "ESTA SEMANA". Cada corrida:
tile com ícone `route` (verde nas recentes, neutro nas antigas), título "Origem → Destino" com seta
unicode como texto, subtítulo "1.8 km  •  8 min", chevron. Toque → Detalhes da viagem.

### 7. Detalhes da viagem — `DetailScreens.jsx`
`NavHeader variant="back"`. Miniatura do trajeto 180px de altura, raio 20px, hairline — **no app
real, um snapshot estático do mapa real**. Abaixo: origem (ponto azul) e destino (ponto verde),
17/700 + endereço 15px, com divisor inferior. Grade 2×2 de `StatTile` com gap 12px: distância
total, tempo total, velocidade média e economia de CO₂ (verde).

### 8. Perfil — `DetailScreens.jsx`
Avatar 88px + nome 26px/800 + e-mail secundário. Grupos: "MEU VEÍCULO" (`SettingsRow` com ação
"Editar"), "PREFERÊNCIAS DE ROTA" (três `SettingsRow` com `Toggle`: evitar vias rápidas ✓,
preferir ciclovias ✓, evitar subidas ✗), "APARÊNCIA & UNIDADES" (rows com valor: "Escuro",
"Kilômetros (km)") e, com margem 18px, "Sair da Conta" em vermelho centralizado.

## Interações e estados

- Navegação raiz: `TabBar` de 3 destinos; a aba ativa recebe cápsula azul 16%, ícone azul e label branco.
- Push de tela e bottom sheet: 320ms `ease-out`, sem overshoot.
- Seleção (chip, opção de rota): borda para azul 2px em 200ms.
- Press em qualquer controle: `scale(0.97)` + 88% de opacidade em 120ms.
- Carregamento: `SkeletonRow` no fim da lista, sem animação de shimmer.
- Estado vazio: rótulo de ação no lugar do valor ("Definir endereço") — não há ilustrações de vazio.
- Erro: não há tela de erro nas fontes originais. **Não invente uma** — reutilize o padrão de erro
  que já existe no projeto.

## Estado necessário (mínimo, camada de UI)

`view`/rota atual · `activeTab` · `query` de busca · `activeChip` · `results` · `selectedRouteIndex` ·
`isNavigating` · telemetria ao vivo (velocidade, bateria, ETA, distância restante) ·
preferências de rota (3 booleanos) · unidade e tema. Toda a lógica de roteamento, geocodificação,
GPS e Bluetooth permanece a que já existe no projeto.

## Conteúdo e tom de voz

Português do Brasil, métrico, sem emoji. Voz impessoal e instrucional — imperativos e rótulos secos
("Vire à esquerda", "Iniciar Navegação", "Definir endereço"), nunca primeira pessoa nem persona de
assistente. Title Case em ações e títulos; sentence case em descrições; UPPERCASE apenas em eyebrows
e tags. Números: `1.8 km`, `22 km/h`, `8m 24s`, `240g`, `84%`, `350m`, hora em 24h (`10:04`).
Toda rota listada explica **por que** foi classificada assim.

## Assets

- **Nenhum logo foi fornecido** — não existe marca neste pacote e nenhuma foi desenhada. Onde um
  logo iria, o nome é composto em tipo. Use a marca real do projeto.
- Sem fotografia, ilustração, textura ou ruído. O único conteúdo raster é o avatar do usuário.
- Ícones: Lucide via CDN (substituição declarada).

---

## Plano de migração

### A. Transferível diretamente (copie os valores como estão)
Tokens (cores, tipografia, espaçamento, raios, sombras, durações/easings), regras de estado
(press/seleção/hover), especificação de layout de cada tela, todo o copy em português, contratos de
props dos 27 componentes, estilo de cartografia escura.

### B. Precisa ser reimplementado no projeto principal
Os componentes em si, na stack do projeto (o `.jsx` aqui é referência, não biblioteca): overlays do
mapa como camada flutuante que não bloqueia gestos; bottom sheet com o mecanismo de sheet já usado
no app; navegação entre telas pelo router existente; `Icon` mapeado para a biblioteca de ícones do
projeto; miniatura de trajeto em Detalhes como snapshot do mapa real.

### C. Deve permanecer do projeto atual (não tocar)
**O mapa real e todo o SDK do provedor**, câmera/gestos, serviços de rota e geocodificação,
GPS e permissões, integração Bluetooth com a scooter, persistência, autenticação, analytics,
navegação/roteamento técnico, testes. Marca e fonte reais, se já existirem.

### D. Deve ser substituído pelo design novo
Toda a camada de apresentação: tema/estilos globais, cores e tipografia, todos os componentes
visuais, chrome das telas (headers, tab bar, sheets), estilo do mapa e das polylines, estados de
press/seleção/carregamento, e o copy dessas oito telas.

### Ordem sugerida (cada etapa é entregável e testável)
1. Tokens no tema do projeto + fonte real ou Nunito. Nada muda visualmente ainda.
2. Primitivos: `Button`, `Card`, `ListRow`, `Tag`, `Chip`, `SectionLabel`, `Icon`.
3. Telas de lista (Salvos, Atividade, Perfil, Detalhes) — não envolvem mapa, risco baixo.
4. Estilo escuro no mapa real + cores semânticas das polylines.
5. Overlays de Explorar: `RouteSearchField`, `VehicleStatusBar`, `TabBar`.
6. Fluxo de rota: Busca → `BottomSheet` com `RouteOptionCard` → `GuidanceBanner` + `StatPill` +
   `NavStatsBar`.
7. Passe de acabamento: durações, easings, press states, safe areas, contraste.

## Arquivos deste pacote

```
readme.md                     guia da marca: fundamentos visuais, tom de voz, iconografia
styles.css + tokens/          fonte da verdade dos tokens
components/<grupo>/           .jsx (referência) + .d.ts (props) + .prompt.md (uso) + card de estados
ui_kits/scooter-app/          protótipo clicável das 8 telas (abra index.html no navegador)
guidelines/                   cards de especificação (cores, tipo, espaçamento, marca)
templates/mobile-screen/      shell de tela em branco já ligado ao design system
SKILL.md                      cabeçalho para usar esta pasta como Agent Skill no Claude Code
```

Para ver o protótipo: abra `ui_kits/scooter-app/index.html` em um navegador (precisa de internet
para React, Babel, Lucide e a fonte).

> **Nota sobre extensões.** Dentro deste pacote os arquivos de código estão como `.jsx.txt` e
> `.d.ts.txt`. É só para evitar conflito com o design system ao vivo — o conteúdo é idêntico.
> Ao copiar para o repositório, remova o sufixo `.txt`.
