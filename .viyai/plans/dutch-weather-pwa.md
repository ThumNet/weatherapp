# Dutch Weather PWA Plan

## Problem Statement
Ad-free, fast personal weather app for the Netherlands that runs as a PWA on a phone. Needs current conditions, hourly/daily forecasts, interactive rain radar, and precipitation alerts — all from free APIs with no backend.

## Appetite
Weekend-sized side project. Functional and polished, not a commercial product.

## Scope
- In: Current weather, hourly forecast (24h), 7-day forecast, interactive rain radar (Leaflet + Buienradar tiles), 2-hour precipitation alert (Buienradar), geolocation + city search, PWA installable, offline support, dark/light mode
- Out: Backend/server, user accounts, push notifications, non-Netherlands optimization

## Success Criteria
- Installable on phone home screen as PWA
- Shows complete weather overview for detected/searched location
- Interactive rain radar with time animation
- Precipitation alert when rain is coming
- Works offline with cached data
- Zero ads, fast load

## Approach
Vue 3 + Vite + TypeScript SPA with Tailwind CSS for styling. Leaflet.js (via vue-leaflet) for interactive radar map with Buienradar radar tiles. Chart.js (via vue-chartjs) for hourly forecast charts. Open-Meteo API for all weather data (uses KNMI data, no API key). Buienradar API for precipitation forecast and radar tiles. vite-plugin-pwa for service worker and installability. Pinia for state management. Static files only — host anywhere.

**Why not alternatives:**
- Vanilla JS: more boilerplate, no less complexity for this feature set
- Other frameworks: no advantage, user knows Vue from work
- Embedded radar image: rejected in favor of interactive Leaflet map for advanced UX
- Backend: unnecessary, all APIs are public with CORS support

## Rabbit Holes
1. **Buienradar radar tile URLs** — undocumented but stable for years in Dutch dev community. Mitigation: isolate tile URL config so it's a one-line fix if it changes.
2. **Geolocation denied** — user may deny permission. Mitigation: default to Amsterdam + prominent city search bar.
3. **CORS on Buienradar** — precipitation API supports CORS, radar tiles served as images (no CORS issue). Low risk.
4. **Service worker over-caching** — stale weather data defeats the purpose. Mitigation: network-first for API calls, cache-first for static assets only.

## Steps

1. [ ] **Project scaffolding**
   - Scaffold Vue 3 + Vite + TypeScript project
   - Install and configure Tailwind CSS
   - Install and configure vite-plugin-pwa with manifest (app name, theme color, icons)
   - Install dependencies: vue-leaflet, leaflet, vue-chartjs, chart.js, pinia
   - Set up project structure: `src/components/`, `src/composables/`, `src/stores/`, `src/services/`, `src/types/`
   - Files: `package.json`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.vue`
   - Done when: `npm run dev` serves a blank PWA-installable app with Tailwind working

2. [ ] **Geolocation + city search**
   - Create a `useGeolocation` composable wrapping the browser Geolocation API
   - Create a location Pinia store to hold current coordinates and city name
   - Create a `weatherService.ts` with a function to call Open-Meteo Geocoding API (`https://geocoding-api.open-meteo.com/v1/search`)
   - Build a `LocationSearch.vue` component with autocomplete city search
   - On app load: attempt geolocation, fall back to Amsterdam (52.37, 4.90)
   - Reverse geocode coordinates to city name via Open-Meteo
   - Files: `src/composables/useGeolocation.ts`, `src/stores/location.ts`, `src/services/weatherService.ts`, `src/components/LocationSearch.vue`
   - Done when: app detects location or lets you search a Dutch city, location persists in Pinia store

3. [ ] **Current weather display**
   - Add function to `weatherService.ts` to fetch current conditions from Open-Meteo (`https://api.open-meteo.com/v1/forecast?current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,...`)
   - Create weather Pinia store to hold all weather data
   - Create a `CurrentWeather.vue` hero card component showing: temperature, weather description, weather icon (map WMO weather codes to icons), humidity, wind speed, feels-like temperature
   - Use a weather icon set (WMO code mapping) — can use simple SVG/emoji or a lightweight icon set
   - Files: `src/components/CurrentWeather.vue`, `src/stores/weather.ts`, `src/services/weatherService.ts`, `src/utils/weatherCodes.ts`
   - Done when: opening the app shows current weather for detected/searched location with appropriate icon

4. [ ] **Hourly forecast with charts**
   - Extend `weatherService.ts` to fetch 24-hour hourly forecast from Open-Meteo (`hourly=temperature_2m,precipitation_probability,precipitation,weather_code`)
   - Create `HourlyForecast.vue` component with Chart.js: temperature as line chart, precipitation probability/amount as bar chart
   - Make chart horizontally scrollable or show full 24 hours
   - Show weather icons for each hour above the chart
   - Files: `src/components/HourlyForecast.vue`, `src/services/weatherService.ts`
   - Done when: interactive chart shows next 24 hours of temperature and precipitation

5. [ ] **7-day daily forecast**
   - Extend `weatherService.ts` to fetch 7-day daily forecast from Open-Meteo (`daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max`)
   - Create `DailyForecast.vue` component showing each day as a card/row: day name, weather icon, high/low temperature, precipitation chance
   - Files: `src/components/DailyForecast.vue`, `src/services/weatherService.ts`
   - Done when: 7-day forecast renders as a clean list below the hourly chart

6. [ ] **Precipitation alert (Buienradar)**
   - Add Buienradar precipitation forecast function to a `buienradarService.ts` (`https://gpsgadget.buienradar.nl/data/raintext?lat=...&lon=...`)
   - Parse the text response (time + precipitation intensity pairs)
   - Create `PrecipitationAlert.vue` component: show a mini precipitation intensity graph for next 2 hours, alert banner when rain is coming ("Rain in X minutes")
   - Files: `src/services/buienradarService.ts`, `src/components/PrecipitationAlert.vue`
   - Done when: component shows precipitation forecast and alerts when rain is expected within 2 hours

7. [ ] **Interactive rain radar map**
   - Create `RadarMap.vue` component using vue-leaflet
   - Center map on user location, show location marker
   - Overlay Buienradar radar tiles (`https://image.buienradar.nl/2d/image/...` or tile layer endpoint)
   - Research current Buienradar radar tile URL pattern and implement
   - Add time slider/animation to step through recent radar frames (last 2 hours, 5-minute intervals)
   - Add play/pause button for animation
   - Files: `src/components/RadarMap.vue`, `src/services/buienradarService.ts`
   - Done when: interactive map shows rain overlay for NL with time animation and play/pause

8. [ ] **PWA polish + offline**
   - Configure vite-plugin-pwa service worker: network-first strategy for API calls, cache-first for static assets
   - Generate PWA icons (multiple sizes) — can use a placeholder/generated icon
   - Configure manifest: name "Dutch Weather", short_name "Weather", theme_color, background_color, display standalone
   - Add offline fallback: show last cached weather data when offline with "last updated" timestamp
   - Add pull-to-refresh functionality to manually refresh weather data
   - Files: `vite.config.ts` (PWA config), `public/` (icons), `src/App.vue`
   - Done when: app installs to home screen with icon, shows cached data offline, has pull-to-refresh

9. [ ] **Mobile-first UI polish**
   - Responsive layout: single column on mobile, wider layout on tablet/desktop
   - System-preference dark/light mode via Tailwind `dark:` classes and `prefers-color-scheme`
   - Smooth transitions between loading/loaded states
   - Loading skeletons while fetching data
   - Proper error states (API failure, no location)
   - Typography, spacing, color palette — clean and modern
   - Test on mobile viewport, ensure no horizontal scroll
   - Files: `src/App.vue`, all components, `tailwind.config.js`
   - Done when: app feels native on phone, supports dark/light mode, has loading states, no layout issues

## Clarity Scores
- Gate 1 (Problem): 0.97 (Goal: 1.0, Constraint: 0.95, Success Criteria: 0.95)
- Gate 2 (Solution): 0.92 (Approach: 1.0, Feasibility: 0.90, Step: 0.90, Risk: 0.90)
