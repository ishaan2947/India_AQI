# Design system — *The air is the design*

This document is the reference for the visual language of the AQI India frontend.
It is written to be used: every number in here has a token behind it in
`frontend/tailwind.config.js` or `frontend/src/index.css`, and components are
expected to reach for the token rather than inventing a value.

---

## 1. Concept

**The site shows you how bad the air is before it tells you.**

One photograph of the Taj Mahal carries the whole identity. It is not
decoration: its subject sits at 27.1767°N, 78.0081°E, inside a city this site
monitors. So the photograph is a live reading. When the air in Agra is clean the
frame is crisp and the marble is white; as the AQI climbs, a brown-grey smog
layer settles over it, contrast collapses, the sky goes flat and the building
recedes. At 300+ you are looking through the air people are actually breathing.

Three consequences follow, and they decide almost every other choice in here:

1. **The reading is the headline.** No marketing sentence sits above the data.
   The first thing on the page is a city, a number and a verdict.
2. **Colour belongs to the air, not to the brand.** The only saturated colour in
   the interface comes off the CPCB AQI scale. The page's accent is whatever
   today's air says it is — the same page is olive-green on a clear day and
   maroon during a severe episode.
3. **Scroll is the mechanism.** Scrolling the hero thickens the haze from clear
   to today's real level, then hands you off to the ranking. Motion measures;
   it does not garnish.

---

## 2. Principles

1. **The data is the headline.** If a sentence can be replaced by the number it
   describes, replace it.
2. **Colour is a measurement.** Saturated colour is reserved for AQI. Everything
   else is warm neutral, so a red row means "red air", never "brand accent".
3. **Motion must explain something.** Every animation is bound to a value — haze
   density to AQI, a bar's width to a reading, a reveal to reading position. One
   easing curve, one timing set, no decorative transitions, and all of it off
   under `prefers-reduced-motion`.
4. **Editorial, not dashboard.** Prose at a readable measure, ranked tables with
   inline bars, full-bleed bands, asymmetric columns. No uniform card grids, no
   three-up stat rows.
5. **Be honest about the data.** Where it came from, how old it is, which scale
   it is being graded against, and how wide the forecast's uncertainty is — all
   stated plainly, in the open, next to the number they qualify.

---

## 3. Palette

### 3.1 Ground — warm neutral "smoke"

Deliberately *not* navy. A warm near-black reads as photographic shadow and
smog, lets the AQI yellows and oranges sit on it without turning acid, and is
the single fastest way to stop the site looking like every dark-mode template.

| Token | Hex | Role |
| --- | --- | --- |
| `smoke-950` | `#0C0B0A` | Page ground, full-bleed bands |
| `smoke-900` | `#131110` | Default surface, hero foot |
| `smoke-850` | `#1A1817` | Row hover, inset panels |
| `smoke-800` | `#231F1D` | Raised surface, chart plot ground |
| `smoke-700` | `#302B28` | Hairlines, rules, table dividers |
| `smoke-600` | `#5A534C` | Bar troughs, disabled marks — **never text** (2.6:1) |
| `smoke-500` | `#8A837A` | Tertiary text, axis ticks (5.25:1 on 950, 4.72:1 on 850) |
| `smoke-300` | `#B3ABA2` | Secondary text, labels (8.67:1 on 950) |
| `smoke-200` | `#D5CEC6` | Body text on dark (12.62:1 on 950) |
| `smoke-100` | `#EFEAE4` | Primary text, headlines (16.44:1 on 950) |
| `paper` | `#F6F3EE` | Inverted sections, popups, light cards |
| `paper-ink` | `#171412` | Text on `paper` (16.57:1) |

Contrast floor: body text uses `smoke-200` or lighter (≥ 12:1). `smoke-500` is
the darkest value allowed to carry type and still clears AA at normal size
against every surface in the ramp. `smoke-600` and below are marks only.

### 3.2 AQI scale — CPCB (India), six bands

The site is about Indian air, graded the way India grades it. CPCB bands are
wider than the US EPA's at the top end (201–300 "Poor", 301–400 "Very Poor",
401+ "Severe"), which matters here because so many readings live above 200.

| Band | Range | Token | Fill hex | On-dark text variant |
| --- | --- | --- | --- | --- |
| Good | 0–50 | `aqi-good` | `#4FA64B` (6.45:1) | `#7FD177` (10.57:1) |
| Satisfactory | 51–100 | `aqi-satisfactory` | `#9FC93C` (10.20:1) | `#BFE05C` (13.14:1) |
| Moderate | 101–200 | `aqi-moderate` | `#F2D73B` (13.63:1) | `#F7E364` (15.10:1) |
| Poor | 201–300 | `aqi-poor` | `#F08B33` (7.91:1) | `#F8A95C` (10.13:1) |
| Very poor | 301–400 | `aqi-veryPoor` | `#E54B38` (5.05:1) | `#F4705D` (6.86:1) |
| Severe | 401+ | `aqi-severe` | `#A8262B` (2.79:1) | `#E86E72` (6.47:1) |

Two values per band on purpose: the **fill** hex is for marks (dots, bars,
rules) and the **text variant** is the lightened version used when the category
colour has to carry glyphs on a dark ground. Raw `aqi-severe` as text on
`smoke-950` is 2.79:1 — unusable for type at any size — so every component that
sets `color` from the scale reads the text variant, and the fill hex is reserved
for areas and strokes.

Provenance note, stated in the UI and not only here: readings come from WAQI,
which publishes on the **US EPA** index. We display those values against
**CPCB band labels**, because the audience is Indian and the advice framing is
CPCB's. The two indices are close in spirit and diverge in detail; the
How-it-works page says so in plain words.

### 3.3 Live accent

`--accent` is a CSS custom property set at runtime from the AQI of the city
currently in the hero (and, on detail pages, the city being viewed). Rules,
underlines, focus rings and the scroll meter read from it. It is never used for
large flat fills — colour that strong stays attached to data marks.

---

## 4. Typography

**Pairing: Archivo (variable grotesk) + Newsreader (variable serif).**

Archivo has a width axis, which is the reason it is here: the giant AQI numeral
runs at `wdth 118` so it reads as a plotted, engineered figure, while small
labels run at `wdth 100`. Newsreader carries the narrative — a serif at a
comfortable measure is the clearest signal that this is a piece of writing about
air, not a SaaS dashboard. No Inter, and no monospace for atmosphere: mono
appears only where there is literal code (`RandomForestRegressor`), on the
How-it-works page.

| Role | Family | Settings |
| --- | --- | --- |
| Hero numeral | Archivo | `wght 800`, `wdth 118`, `tracking -0.045em`, tabular |
| Display headline | Archivo | `wght 700`, `wdth 112`, `tracking -0.03em` |
| Section heading | Archivo | `wght 600`, `wdth 106`, `tracking -0.02em` |
| Data value | Archivo | `wght 700`, tabular, `tracking -0.02em` |
| Label / eyebrow | Archivo | `wght 600`, `11–12 px`, `tracking 0.08em`, uppercase |
| Body prose | Newsreader | `wght 380`, `opsz` auto, `17–20 px`, `line-height 1.6` |
| Lead / pull quote | Newsreader | `wght 400`, `24–34 px`, `line-height 1.3` |
| Code | ui-monospace | `0.85em` |

Scale (clamped, so there is one ramp from 375 px to 2560 px):

| Token | Clamp | Use |
| --- | --- | --- |
| `text-mega` | `clamp(5.5rem, 17vw, 15rem)` | The hero AQI numeral |
| `text-display` | `clamp(2.4rem, 6.2vw, 5rem)` | Band headlines |
| `text-head` | `clamp(1.5rem, 2.6vw, 2.25rem)` | Section headings |
| `text-lead` | `clamp(1.25rem, 2vw, 1.75rem)` | Lead paragraphs |
| `text-row` | `clamp(1.05rem, 1.5vw, 1.4rem)` | Table city names |
| `text-body` | `1.0625rem` / `1.1875rem` at `sm` | Prose |
| `text-label` | `0.6875rem` | Uppercase labels |

**Numerals:** `font-variant-numeric: tabular-nums` is set globally on
`.tnum`, every data component, and all chart ticks. Rankings must not shimmer
when a value changes from 99 to 100.

Labels: uppercase + tracked labels are allowed as *data labels adjacent to the
value they name*, never as a centred eyebrow floating above a headline. The
distinction is the whole difference between a spec sheet and a landing page.

---

## 5. Spacing, measure, and layout

4 px base unit. Section rhythm uses a restricted set so vertical spacing is
recognisable rather than arbitrary: `8, 12, 16, 24, 32, 48, 64, 96, 128, 176`.

- **Page gutter:** `16px` → `24px` at `sm` → `40px` at `lg`.
- **Band padding:** `64px` vertical on phones, `128px` at `lg`.
- **Content widths:** prose `62ch` max; data tables `1400px` max; full-bleed
  bands ignore both and run to the viewport edge.
- **Grid:** asymmetric by default — `lg:grid-cols-[22rem_1fr]` for a sticky
  heading rail beside a ranked list, `lg:grid-cols-[1fr_minmax(0,34rem)]` for
  prose beside data. Equal-width multi-column card grids are out.
- **Dividers:** 1 px `smoke-700` hairlines, never shadows, never borders on all
  four sides. Elevation is expressed by ground colour, not by shadow.
- **375 px:** every band collapses to one column; the hero numeral drops to
  `5.5rem`; the ranking table hides the state column and the category word,
  keeping rank, city, bar, value.

---

## 6. Motion

One curve, four durations, and a rule that every motion is bound to a value.

```
--ease-air:  cubic-bezier(0.22, 0.68, 0.16, 1)   /* everything */
--t-tap:     140ms   /* hover, focus, colour */
--t-move:    320ms   /* position, size, row states */
--t-enter:   680ms   /* reveals */
--t-settle:  1600ms  /* the haze settling on load */
```

- **Haze:** density = `clamp01((aqi - 40) / 360)`, multiplied by a progress term
  that runs `0 → 1` across the hero's scroll. On load the progress eases to
  `0.6` over `--t-settle` so a visitor who never scrolls still sees today's air;
  scrolling takes it the rest of the way. Driven by one rAF-throttled scroll
  listener writing CSS custom properties — no React re-render per frame.
- **Reveals:** fire once, never re-animate on scroll-up. Lead lines reveal
  word-by-word with a 34 ms stagger (capped at 12 words); bodies fade as a
  block. Travel is 14 px. Anything more looks like the layout is assembling
  itself.
- **Bars:** grow from zero on first intersection over `--t-move`, because the
  growth *is* the value.
- **`prefers-reduced-motion: reduce`:** no transitions, no stagger, no scroll
  binding. Haze jumps straight to today's real density — the information is
  preserved, the animation is not. Nothing is ever hidden behind an animation
  that reduced motion would skip.

---

## 7. Component rules

- **Masthead:** text wordmark `AQI INDIA` (Archivo 700, `wdth 106`, tracking
  `0.14em`) with a hairline under the bar. No logo mark, no tagline, no gradient
  square. Backend health is silent when healthy and only speaks — as words, in
  the AQI palette — when the API is waking or down.
- **Tables:** the inline bar is a background layer inside the row, not a
  separate column; the value sits at the row's right edge in tabular Archivo.
  Whole row is the link target, focus ring is `--accent`.
- **Charts (Recharts):** plot ground `smoke-900`; horizontal gridlines only, 1 px
  `smoke-700`; no legend box when a direct label will do; axis ticks
  `smoke-500` 11 px tabular; forecast confidence band as a `smoke-600` → accent
  area at 18% opacity; units and timezone on the axis title, not in a tooltip.
- **Map:** muted dark basemap (Esri Dark Gray, already tinted in `index.css`),
  AQI colour as the only saturated thing on screen, custom dot markers sized by
  value, dark popups on `paper` with the category rule, Leaflet controls
  restyled to the smoke palette.
- **States:** loading skeletons mirror the real layout's geometry (same row
  heights, same column widths) and are explicit about the cold start — "waking
  the backend, ~30 s" rather than an anonymous spinner. Error states keep the
  last good data on screen and say what failed. Empty states name the reason.
- **Focus:** `:focus-visible` only, 2 px `--accent` ring with a 2 px offset in
  `smoke-950`, on every interactive element including table rows and the hero
  city switcher.

---

## Appendix A — Audit of the pre-redesign UI

What was there, why it read as generated, and where it went.

| # | Pattern | Where | Resolution |
| --- | --- | --- | --- |
| 1 | Centred eyebrow (`LIVE AIR QUALITY · 30 INDIAN CITIES`, `tracking-[0.22em]`) above a centred headline | `Landing.tsx` hero | Removed. The hero is now the live reading itself. |
| 2 | Generic headline + subtitle (`Should you go outside?` + two-line explainer) | `Landing.tsx` hero | Replaced by `city · number · verdict`. |
| 3 | Two pill CTAs, one filled + one outlined with `backdrop-blur-sm` | `Landing.tsx` hero | Removed. Navigation happens through the data (rows, map band, nav). |
| 4 | Gradient square logo (`bg-gradient-to-br from-aqi-good via-aqi-moderate to-aqi-unhealthy` + `ring-1 ring-white/10`) | `Navbar.tsx` | Replaced with a text wordmark. |
| 5 | Italic tagline beside the logo (`what to breathe before stepping outside`) | `Navbar.tsx` | Deleted. |
| 6 | Green `LIVE` status-dot pill with `animate-pulse`, plus a mono uppercase label | `Navbar.tsx` | Silent when healthy; words, not a dot, when waking or down. |
| 7 | Row of three equal stat cards with `view city →` / `open the map →` micro-CTAs | `Landing.tsx` `LiveStrip` | Gone. The ranking table carries all thirty cities. |
| 8 | Numbered section headings `01 / 02 / 03` in mono | `Landing.tsx` `Section` | Unnumbered editorial beats with a hairline and a short label. |
| 9 | "At a glance" key/value rail with mono values | `Landing.tsx` `RailBlock` | Moved to `/how-it-works`, set in proportional type. |
| 10 | Tech-stack chips (12 mono pills: FastAPI, Pydantic v2, Vite…) | `Landing.tsx` `STACK` | Moved to `/how-it-works` as prose by layer. |
| 11 | Monospace as texture — 7 `font-mono` uses for AQI values, counts, timestamps, `01`/`02` | `Landing.tsx`, `CityCard`, `Sidebar`, `CityRanking` | JetBrains Mono dropped from the bundle. Numbers are Archivo with tabular figures; mono survives only for literal code. |
| 12 | `backdrop-blur` glass surfaces (7 instances: nav, stat strip, photo badge, map legend) | `Navbar.tsx`, `Landing.tsx`, `AQIMap.tsx` | Solid warm-neutral grounds and hairlines. |
| 13 | Hover-scale / lift effects (`group-hover:scale-[1.02]` on the hero photo, `hover:-translate-y-0.5` + `hover:shadow-xl` on cards) | `Landing.tsx`, `CityCard.tsx` | Removed. Hover changes ground colour and the accent rule only. |
| 14 | Decorative gradient hairline sweeping in on card hover | `Landing.tsx` `StatCard` | Removed. |
| 15 | Dark navy ground `#0b1220` + dotted texture overlay | `index.css`, `tailwind.config.js` | Warm `smoke-950` ground; texture dropped — the photograph is the texture. |
| 16 | `Inter`-class neutral grotesk (Geist) for everything, display and body alike | `index.html` | Archivo + Newsreader pairing with a real display/text split. |
| 17 | US EPA AQI bands and colours (`#00E400`, `#FFFF00`, `#FF0000`…) on an Indian site | `aqiHelpers.ts` | CPCB bands and a palette tuned for a dark warm ground. |
| 18 | Uniform `rounded-xl` cards with 1 px borders on all sides, 3–4 across | `Predictions.tsx`, `CityCard.tsx`, `CityRanking.tsx` | Scheduled for the next pass (ranked rows + full-bleed bands). |
| 19 | Pulsing marker animation on the worst city (`aqi-marker-pulse`, stroke 2→7) | `index.css`, `AQIMarker.tsx` | Scheduled for the map pass — keep the emphasis, drop the throb. |
| 20 | Relative-only timestamps (`recently`) with no timezone, and naive-UTC strings parsed as local time | `aqiHelpers.ts` | Timestamps parsed as UTC; freshness shown as `X min ago` plus an explicit IST clock. |

Rows 18 and 19 are the map / forecasts / city-detail pass, which is deliberately
not part of the home-page review.
