<p align="center">
  <img src="public/icon.svg" width="128" height="128" alt="Dutch Weather Icon" />
</p>

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
bun install        # install dependencies
bun run dev        # start dev server
bun run build      # type-check + production build
bun run preview    # preview production build locally
```

## Data Sources

All APIs are free and require no API key.

| Source | Used For |
|---|---|
| [Open-Meteo](https://open-meteo.com) | Current weather, hourly & daily forecasts, city search |
| [Buienradar](https://www.buienradar.nl) | 2-hour precipitation nowcast (5-min intervals) |
| [RainViewer](https://www.rainviewer.com/api.html) | Animated radar tiles + nowcast frames |
| [Nominatim](https://nominatim.openstreetmap.org) | Reverse geocoding (GPS coords → city name) |
| [OpenStreetMap](https://www.openstreetmap.org) | Base map tiles in the radar overlay |
