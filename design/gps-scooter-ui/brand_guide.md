# GPS Scooter — Design System

A dark, map-first navigation app for electric scooter riders in Brazil. The product routes riders
door-to-door on scooter-appropriate streets: bike lanes and calm residential roads first, fast
arterials discouraged. It pairs over Bluetooth with the rider's own scooter (e.g. Ninebot Max G30)
and shows charge and remaining range alongside the route.

Interface language is **Brazilian Portuguese**. Units are metric. The app is dark-only.

## Sources

The only material supplied was eight iOS screenshots (in `uploads/`):

| File | Screen |
|---|---|
| `IMG_3303` | Explore — map, origin/destination bar, paired-scooter strip, tab bar |
| `IMG_3304` | Search — query field, category chips, results, loading placeholder |
| `IMG_3306` | Route options — bottom sheet with three routes, "Iniciar Navegação" |
| `IMG_3307` | Navigation — turn banner, live route, speed/battery pills, ETA bar |
| `IMG_3308` | Saved — Casa/Trabalho shortcuts, favourite places |
| `IMG_3309` | Activity — rides grouped by Hoje / Ontem / Esta semana |
| `IMG_3310` | Trip detail — route thumbnail, origin/destination, 2×2 metric tiles |
| `IMG_3311` | Profile — vehicle, route preferences, appearance, sign out |

No codebase, Figma file, font files or logo were provided. Everything below is measured from those
screenshots; where a value could not be measured it is a considered approximation, and where an
asset was missing it is flagged rather than invented. **See "Substitutions & gaps" at the bottom.**

---

## Content fundamentals

**Language.** Brazilian Portuguese throughout, including inside data ("Ciclovias e vias calmas e
residenciais", "38 km restáveis"). Accents are always correct — never strip them.

**Voice.** Impersonal and instructional. The app addresses the rider through imperatives and bare
labels, not through "I" or "you": *Vire à esquerda*, *Iniciar Navegação*, *Definir endereço*,
*Sair da Conta*. There is no first person, no assistant persona, no encouragement copy.

**Casing.** Title Case for actions and screen titles (*Iniciar Navegação*, *Detalhes da Viagem*).
Sentence case for descriptive lines (*Tráfego moderado, trecho sem ciclovia*). UPPERCASE with wide
tracking is reserved for two things only: section eyebrows (*LOCAIS FAVORITOS*, *OPÇÕES DE ROTA*,
*HOJE*) and classification tags (*RECOMENDADA*).

**Length.** Ruthlessly short. Row titles are a place name. Subtitles are one address line. Route
rationales are one clause and always answer *why this route* — never a bare route listing.

**Numbers.** Numeral + space + unit, lowercase: `1.8 km`, `22 km/h`, `8m 24s`, `240g`, `84%`.
Time-of-day is 24-hour (`10:04`). Distances under a kilometre switch to metres (`350m`, no space —
matches the guidance banner). Decimals use a dot in the screenshots.

**Emoji.** None. Not in labels, not in empty states, not in data.

**Vibe.** Instrument panel, not a social app. Confident, terse, factual — closer to a dashboard than
to a consumer travel app. The one place the product editorialises is safety: routes are labelled
*RECOMENDADA* / *ALTERNATIVA* / *MUITO RÁPIDA*, and "não recomendada para scooters" is said plainly.

---

## Visual foundations

**Colour.** Near-black navy, never neutral grey. Six surface steps from `#0A0E1A` (app background)
up to `#2B3A56` (icon tile); depth is expressed by moving *up* that ramp, not by shadow. Four
accents, each with a fixed job: **blue `#35B7F7`** = navigation, links, the active route, selection;
**green `#2FD16A`** = go, battery, safe routes, eco wins; **amber `#F5A623`** = saved places and
compromise routes; **red `#F04545`** = destructive actions and discouraged roads. Colour is
semantic — never used decoratively, never as a gradient wash. There are no purple/violet gradients
anywhere in this brand.

**Type.** One family, heavily weighted. Titles and metrics are 800; row titles 700; body 400.
The typographic hierarchy is carried by *weight and size*, not by colour or case. Numbers are the
largest thing on any map screen (ETA "8 min" is bigger than the route description next to it).

**Spacing & layout.** 4-based scale. 20px screen gutters, 12px between sibling cards, 24px between
labelled groups, 16px card padding, 72px minimum row height, 44px minimum tap target. Map screens
are full-bleed with floating chrome pinned top and bottom (search/guidance above, vehicle status →
tab bar → home indicator below). List screens are the inverse: flat background, no map, stacked cards.

**Backgrounds & imagery.** No photography, no illustration, no texture, no noise. The only "image"
in the product is the map itself — a stylised dark basemap of slate roads (`#2B3A56`) on near-black,
with a barely-there blue grid (5% opacity) and dim POI dots. Route lines are the sole saturated
geometry: solid for real routes, dotted for advisory ones. Avatars are the only raster content.

**Transparency & blur.** Used exactly where UI floats over the map: 86%-opacity card fill plus a
20px backdrop blur, with a 1px 10%-white border to separate it from the map. Never on in-flow
cards, never on list screens.

**Shadows & glow.** In-flow cards have no drop shadow at all — elevation is fill. Floating chrome
gets `0 8px 24px rgba(0,0,0,.45)`; the bottom sheet gets an upward `0 -12px 32px rgba(0,0,0,.55)`.
Glow appears only on live navigation geometry: the active route line and the location puck.

**Borders.** 1px `rgba(255,255,255,.06)` hairline on cards, `.10` on floating chrome. Selection is
a 2px solid blue border — the *only* border that carries colour.

**Corner radii.** 8 (tags) / 12 (icon tiles, search field) / 16 (stat tiles, route options) /
20 (cards, list rows) / 28 (floating bars, sheets) / pill (chips, toggles, tab capsules).
Nothing in the product has square corners.

**Cards.** Lighter fill, 20px radius, hairline border, 16px padding, no shadow. Selected cards keep
the same geometry and swap the border for 2px blue while lifting one surface step.

**Motion.** Fast and flat. 120ms press, 200ms selection/toggle, 320ms sheets and screen pushes,
`cubic-bezier(.16,1,.3,1)` for anything entering. No bounce, no spring, no overshoot — this is a
navigation instrument.

**Press & hover.** Press = scale 0.97 + drop to 88% opacity; the fill colour does not change. Hover
is not a state in the product (touch-only); desktop mirrors may reuse the press dim.

**Protection.** Floating chrome protects itself with fill + blur (capsules), not with scrim
gradients. `--scrim-top` / `--scrim-bottom` exist for edge-to-edge content over the map.

---

## Iconography

- **Set:** [Lucide](https://lucide.dev) — monoline, ~2px stroke, round caps and joins, 24px grid.
  This is a **substitution**: no icon assets were supplied, and Lucide is the closest CDN-available
  match to the screenshots' stroke weight and roundness.
- **Delivery:** loaded lazily from `https://unpkg.com/lucide@0.469.0` by the `Icon` component. No
  icon font, no sprite sheet, no PNG icons, no bundled SVG files in `assets/`.
- **Sizes:** 20px inline, 22px in the tab bar, 24px in list rows and settings, 26px for the search
  affordance, 30px in the guidance maneuver tile.
- **Colour:** icons inherit their row's text tone by default. They take an accent colour only when
  the accent means something — blue for navigation/actions, amber on saved places, green for the
  paired vehicle, red on destructive rows.
- **Named glyphs in use:** `search`, `map`, `star`, `clock`, `map-pin`, `navigation`,
  `chevron-right`, `arrow-left`, `circle-x`, `x`, `house`, `briefcase`, `route`, `bike`, `log-out`,
  `wifi`, `signal-high`, `battery-full`.
- **Never:** emoji, unicode glyph substitutes (the `→` in ride titles is text content, not an icon),
  filled/duotone icons, or two icon sets on one screen.

---

## Index

- `styles.css` — the single entry point consumers link. `@import`s only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`,
  `elevation.css`, `motion.css`, `base.css`.
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `components/` — see below.
- `ui_kits/scooter-app/` — click-through recreation of the mobile product.
- `assets/` — **empty**: no logo or imagery was supplied.
- `templates/mobile-screen/` — starting-point template: a blank app screen wired to the design system.
- `SKILL.md` — Agent-Skills entry point.

### Components

**core/** — `Icon`, `Button`, `IconButton`, `Chip`, `Tag`, `Card`, `SectionLabel`, `StatTile`, `Avatar`
**forms/** — `SearchField`, `RouteSearchField`, `Toggle`, `SettingsRow`
**navigation/** — `NavHeader`, `TabBar`, `GuidanceBanner`, `StatusBar` (+ `HomeIndicator`)
**data/** — `ListRow`, `SkeletonRow`
**map/** — `MapCanvas`, `LocationPuck`, `BottomSheet`, `RouteOptionCard`, `StatPill`, `NavStatsBar`, `VehicleStatusBar`

Each directory has a `<Name>.jsx`, a `<Name>.d.ts` props contract, a `<Name>.prompt.md` usage note,
and one `@dsCard` HTML showing the family's states.

**Intentional additions.** `Icon` (wrapper around the substituted glyph set), `StatusBar` /
`HomeIndicator` (mockup chrome, not product UI), `SkeletonRow` (the loading placeholder visible at
the bottom of the search results screen), and `MapCanvas` (a stand-in for the real map tiles, which
were not available). Everything else has a direct counterpart in the screenshots.

---

## Substitutions & gaps — please confirm

1. **Typeface.** The screenshots use a rounded geometric sans with a double-storey `a` that is not
   a system font. No font files were provided, so the system ships **Nunito** (Google Fonts) as the
   nearest match. Send the real font files and this becomes a one-file change in `tokens/fonts.css`.
2. **Icons.** Lucide substituted for the app's real set, as described above.
3. **Logo.** None supplied. `guidelines/brand-mark.card.html` sets the name in type as a
   placeholder; no mark has been drawn or reconstructed.
4. **Map tiles.** `MapCanvas` draws decorative geometry in the product's cartographic style. It is
   not a real map renderer.
5. **Product name.** "GPS Scooter" is inferred from `arthur@gpsscooter.app` on the profile screen.
