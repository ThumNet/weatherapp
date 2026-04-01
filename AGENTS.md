# Dutch Weather PWA — Contributor & AI Working Guide

> Quick-reference for AI assistants, new contributors, or anyone picking up this codebase cold.

---

## What This App Is

An ad-free, offline-capable Dutch weather PWA targeting the Netherlands.  
No backend, no API keys — entirely powered by free public APIs, installable as a PWA.

**Live deployment:** GitHub Pages at `/weatherapp/`  
**Default fallback location:** Amsterdam (52.37°N, 4.9°E) — used when GPS is denied or unavailable.

---

## Stack

| Layer | Library / Tool | Notes |
|---|---|---|
| Framework | Vue 3 (Composition API) + TypeScript | `<script setup>` throughout |
| State | Pinia | Composition-API style (`defineStore(() => { ... })`) |
| Styling | Tailwind CSS v3 | Dark-mode via `class` strategy; custom `dutch-blue` + `weather` colour palettes |
| Charts | Chart.js + vue-chartjs | Used in `HourlyForecast.vue` |
| Maps | Leaflet + @vue-leaflet/vue-leaflet | Radar overlay in `RadarMap.vue` |
| Build | Vite 6 + vite-plugin-pwa | Workbox service worker, `autoUpdate` mode |
| Package manager | **Bun** (preferred) | `bun.lock` is committed; use `bun` not `npm`/`yarn` |
| Type-check | vue-tsc | Run before every commit; `build` script runs it first |

> **Note:** `package.json` does not list `chart.js` or `vue-chartjs` as explicit dependencies even though they are used in `HourlyForecast.vue` — they are resolved transitively. Do not add them as direct deps unless a version conflict arises.

---

## Commands

```bash
bun install           # install / sync dependencies
bun run dev           # start Vite dev server (hot-reload)
bun run type-check    # run vue-tsc --noEmit (no emit, type errors only)
bun run build         # type-check then Vite production build → dist/
bun run preview       # serve the dist/ folder locally
```

There are **no test commands** — the project has no test suite at this time.

---

## Directory Map

```
weatherapp/
├── index.html                  # App shell; <meta name="theme-color"> lives here
├── vite.config.ts              # Vite + PWA config; all Workbox cache rules
├── tailwind.config.js          # Custom colours, dark-mode class strategy
├── public/                     # Static assets (icons, PWA images)
│
└── src/
    ├── main.ts                 # App bootstrap: createApp, Pinia, mount
    ├── App.vue                 # Root: layout, GPS init, pull-to-refresh, data orchestration
    ├── style.css               # Global Tailwind directives + base resets
    │
    ├── components/
    │   ├── CurrentWeather.vue  # Hero card: temp, feels-like, wind, precip bar chart, rain alert
    │   ├── HourlyForecast.vue  # 24-hour Chart.js dual-axis chart (°C + precip probability)
    │   ├── DailyForecast.vue   # 7-day forecast rows
    │   ├── LocationSearch.vue  # Autocomplete city search (Open-Meteo geocoding)
    │   ├── RadarMap.vue        # Full-screen animated radar overlay (Leaflet + RainViewer)
    │   └── RadarScrubberB.vue  # Timeline scrubber bar used inside RadarMap
    │
    ├── services/
    │   ├── weatherService.ts       # Open-Meteo: current / hourly / daily + Nominatim reverse-geocode
    │   ├── buienradarService.ts    # Buienradar 2-hour precip nowcast (plain-text parser)
    │   └── rainviewerService.ts    # RainViewer: frame metadata fetch + tile URL builder
    │
    ├── stores/                 # Pinia stores — all persist relevant state to localStorage
    │   ├── location.ts         # lat / lon / cityName; default Amsterdam
    │   ├── weather.ts          # current + hourly + daily data, loading/error, lastUpdated
    │   ├── precipitation.ts    # Buienradar entries + derived getters (isRainExpected, minutesUntilRain)
    │   └── theme.ts            # dark / light / system cycle; applies `dark` class to <html>
    │
    ├── composables/
    │   ├── useGeolocation.ts   # navigator.geolocation wrapper; silently falls back on denial
    │   ├── useOnlineStatus.ts  # Reactive online/offline detection
    │   └── usePullToRefresh.ts # Touch pull-down gesture → triggers refreshAll()
    │
    ├── types/
    │   └── weather.ts          # All TS interfaces: API response shapes + normalised domain types
    │
    └── utils/
        └── weatherCodes.ts     # WMO weather code → description + emoji; degreesToCompass()
```

---

## Data Sources (all free, no API key required)

| API | Used for | Endpoint pattern |
|---|---|---|
| Open-Meteo forecast | Current weather, 24-hour hourly, 7-day daily | `api.open-meteo.com/v1/forecast` |
| Open-Meteo geocoding | City autocomplete search | `geocoding-api.open-meteo.com/v1/search` |
| Nominatim / OSM | Reverse geocode GPS coords → city name | `nominatim.openstreetmap.org/reverse` |
| Buienradar | 2-hour precipitation nowcast (5-min intervals, NL only) | `gpsgadget.buienradar.nl/data/raintext` |
| RainViewer | Animated radar frame metadata + tile images | `api.rainviewer.com` / `tilecache.rainviewer.com` |
| OpenStreetMap | Base map tiles in radar overlay | `[abc].tile.openstreetmap.org` |

**Important constraint:** Buienradar only covers the Netherlands. This is by design — the app targets NL users.

---

## Key Data Flows

### Startup sequence (`App.vue → onMounted`)
1. Immediately fetch weather + precipitation using the **persisted** location (or Amsterdam default).
2. In parallel, call `requestPosition()` (browser GPS — 8 s timeout).
3. If GPS succeeds → update `locationStore`, re-fetch weather + precipitation, reverse-geocode for city name.
4. If GPS fails/denied → silently keep the persisted location.

### Location change (user picks a city or GPS updates)
- `App.vue` watches `[locationStore.latitude, locationStore.longitude]`
- Any change triggers `weatherStore.fetchWeather()` + `precipitationStore.fetchPrecipitation()`

### Offline / PWA caching
- Workbox service worker is registered with `autoUpdate`.
- All API responses are cached via `NetworkFirst` with varying TTLs (10 min for radar, 1 h for weather, 24 h for geocoding/tiles).
- Stores hydrate from `localStorage` on init, so stale data is shown immediately while fresh data loads.

### Theme
- Cycles: `dark → light → system` via header button.
- `theme.ts` store applies/removes the `dark` class on `<html>` and updates `<meta name="theme-color">`.

---

## Configuration & Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `VITE_BASE_PATH` | Vite `base` path for sub-path deployments | `/` |

The only env variable is `VITE_BASE_PATH`. There is no `.env.example` because this is the only variable and it is only needed for GitHub Pages deployment.

In the CI workflow (`deploy.yml`) it is set to `/weatherapp/`.  
For local development the default `/` is correct — do not set it locally.

---

## Deployment

Deployed automatically to **GitHub Pages** on every push to `main` via `.github/workflows/deploy.yml`.

Pipeline steps:
1. `oven-sh/setup-bun@v2`
2. `bun install`
3. `bun run build` with `VITE_BASE_PATH=/weatherapp/`
4. Upload `dist/` as a Pages artifact and deploy.

There is no staging environment. The live app updates on every merge to `main`.

---

## localStorage Keys

| Key | Owner store | Content |
|---|---|---|
| `dutch-weather-location` | `location.ts` | `{ latitude, longitude, cityName }` |
| `dutch-weather:weather` | `weather.ts` | `{ currentWeather, hourlyForecast, dailyForecast, lastUpdated }` |
| `dutch-weather:precipitation` | `precipitation.ts` | `{ entries[], lastUpdated }` |
| `dutch-weather:theme` | `theme.ts` | `"dark" \| "light" \| "system"` |

---

## How to Make Safe Changes

### Adding or changing a UI component
- Components are self-contained SFCs in `src/components/`.
- They read data from Pinia stores; they do **not** call services directly.
- Tailwind classes only — do not introduce new CSS files; use `<style scoped>` sparingly for transitions/animations.
- Dark-mode: always pair light (`text-slate-800`) and dark (`dark:text-white`) variants.

### Adding a new data field from an existing API
1. Add the field to the relevant raw response interface in `src/types/weather.ts`.
2. Add it to the normalised domain interface (e.g. `CurrentWeather`).
3. Update the fetch function in the appropriate service file.
4. Update the store if the field needs to be cached/persisted.
5. Run `bun run type-check` — fix all type errors before considering the change done.

### Adding a new API / data source
1. Create a new service file in `src/services/`.
2. Add response types to `src/types/weather.ts` (or a new types file).
3. Add a Pinia store in `src/stores/` if the data needs reactive state.
4. Add a `runtimeCaching` rule in `vite.config.ts` (Workbox) for offline support.

### Changing the service worker / PWA behaviour
- All Workbox config is in `vite.config.ts` under the `VitePWA` plugin.
- `registerType: 'autoUpdate'` means the SW updates silently without prompting the user.
- Cache TTLs are set per-API — adjust `maxAgeSeconds` as needed; be conservative with radar data (updates every ~5–10 min).

### Type-checking
```bash
bun run type-check   # must pass clean before merging
```
The `build` script runs `vue-tsc --noEmit` first and will fail on type errors.

---

## Known Caveats & Gotchas

- **No test suite.** There are no unit or e2e tests. Rely on `type-check` and manual verification.
- **Buienradar is NL-only.** Querying it for coordinates outside the Netherlands returns empty or nonsensical data. The app is intentionally scoped to NL.
- **Chart.js not in package.json.** `vue-chartjs` brings Chart.js as a peer dependency. If you see chart-related type errors, check the installed version with `bun pm ls`.
- **GPS permission is silent-fail by design.** `PERMISSION_DENIED` and `POSITION_UNAVAILABLE` are swallowed; only `TIMEOUT` surfaces an error to the user. This is intentional UX.
- **Theme OS-change reactivity workaround.** `theme.ts` has a deliberate brief-toggle hack to re-trigger Vue reactivity when the OS colour scheme changes while `theme === 'system'`. This is a known quirk.
- **Nominatim User-Agent.** `weatherService.ts` sends a `User-Agent: DutchWeatherPWA/1.0` header to Nominatim (required by their ToS). Do not remove this.
- **`VITE_BASE_PATH` and `start_url`/`scope` in the PWA manifest.** The manifest hardcodes `scope: '/'` and `start_url: '/'`. If you ever change the deployment base path, update these in `vite.config.ts` as well, otherwise the PWA will not install correctly.
- **`dist/` is committed.** The `dist/` folder appears to be present in the repo tree (not gitignored). Do not rely on it being up to date — always run `bun run build` for a fresh artefact.
- **README.md is slightly stale.** README lists "Runtime: Bun" in the tech-stack table, which is accurate, but it does not mention Chart.js or vue-chartjs anywhere despite those being used for the hourly forecast chart.
