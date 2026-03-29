# Dutch Weather PWA

An ad-free, offline-capable weather app for the Netherlands — built with Vue 3 and powered entirely by free APIs.

## Features

- Current conditions: temperature, feels like, humidity, wind speed & direction
- 2-hour precipitation forecast with a live bar chart (Buienradar, 5-min intervals)
- Rain alert banner: "raining now", "rain in N minutes", or "no rain expected"
- 24-hour forecast with a dual-axis temperature + precipitation chart
- 7-day daily forecast with high/low temps and precipitation probability
- Animated rain radar overlay (RainViewer, full-screen Leaflet map)
- City search with autocomplete (Open-Meteo Geocoding)
- GPS-based location detection with reverse geocoding (Nominatim)
- Installable PWA with offline support and background caching
- Pull-to-refresh gesture on mobile

## Tech Stack

| Layer | Tools |
|---|---|
| Framework | Vue 3 + TypeScript |
| State | Pinia (with `localStorage` persistence) |
| Styling | Tailwind CSS |
| Charts | Chart.js + vue-chartjs |
| Maps | Leaflet + @vue-leaflet/vue-leaflet |
| Build | Vite + vite-plugin-pwa |
| Runtime | Bun |

## Getting Started

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.0

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Type-check
bun run type-check

# Production build
bun run build

# Preview production build
bun run preview
```

## Project Structure

```
src/
├── App.vue              # Root layout, GPS init, pull-to-refresh, data orchestration
├── components/
│   ├── CurrentWeather.vue   # Hero card: temp, stats, precipitation chart, rain alert
│   ├── HourlyForecast.vue   # 24-hour Chart.js dual-axis chart (temp + precip)
│   ├── DailyForecast.vue    # 7-day forecast rows
│   ├── LocationSearch.vue   # Autocomplete city search with keyboard navigation
│   └── RadarMap.vue         # Full-screen animated radar overlay (Leaflet + RainViewer)
├── services/
│   ├── weatherService.ts        # Open-Meteo (current, hourly, daily) + Nominatim geocoding
│   ├── buienradarService.ts     # Buienradar 2-hour precipitation forecast
│   └── rainviewerService.ts     # RainViewer radar frame metadata + tile URL builder
├── stores/
│   ├── location.ts       # Current lat/lon + city name, persisted to localStorage
│   ├── weather.ts        # Current/hourly/daily weather data + loading/error state
│   └── precipitation.ts  # Buienradar entries + derived rain getters
└── composables/
    ├── useGeolocation.ts      # Browser Geolocation API wrapper
    ├── useOnlineStatus.ts     # Reactive online/offline detection
    └── usePullToRefresh.ts    # Touch pull-down gesture handler
```

## Data Sources

| Source | Used For | Docs |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Current weather, hourly & daily forecasts, city search | open-meteo.com |
| [Buienradar](https://www.buienradar.nl) | 2-hour precipitation nowcast (5-min intervals) | gpsgadget.buienradar.nl |
| [RainViewer](https://www.rainviewer.com/api.html) | Animated radar tiles + nowcast frames | rainviewer.com |
| [Nominatim](https://nominatim.openstreetmap.org) | Reverse geocoding (GPS coords → city name) | nominatim.org |
| [OpenStreetMap](https://www.openstreetmap.org) | Base map tiles in the radar overlay | openstreetmap.org |

All APIs are free and require no API key.
