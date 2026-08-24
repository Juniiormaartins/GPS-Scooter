# UI kit — GPS Scooter mobile app

Click-through recreation of the iOS app, built entirely from the design system's own components.
Open `index.html`.

## Flow

- **Explorar** (default) — tap the search bar → **Busca**; tap the map → **Perfil**
- **Busca** — tap any result → **Opções de rota**; back arrow returns
- **Opções de rota** — pick a route, then *Iniciar Navegação* → **Navegação**; ✕ ends the ride
- **Salvos** / **Atividade** — via the tab bar; an activity row opens **Detalhes da Viagem**

## Files

| File | Screens |
|---|---|
| `ExploreScreen.jsx` | Explore + the shared `Screen` / `ScreenBody` shells and `TABS` |
| `SearchScreen.jsx` | Search with chips, results, loading row |
| `RouteScreens.jsx` | Route options sheet, turn-by-turn navigation |
| `ListScreens.jsx` | Saved places, ride activity |
| `DetailScreens.jsx` | Trip detail, profile & preferences |
| `App.jsx` | Router + mount |

## Notes

- Frame is 393×852 (iPhone 15 logical size). The status bar and home indicator are mockup chrome.
- The map is `MapCanvas` — stylised geometry in the product's cartography, not real tiles.
- No screen invents content: every label, address and metric is taken from the source screenshots.
