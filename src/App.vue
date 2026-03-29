<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useGeolocation } from '@/composables/useGeolocation'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { useLocationStore } from '@/stores/location'
import { useWeatherStore } from '@/stores/weather'
import { usePrecipitationStore } from '@/stores/precipitation'
import { reverseGeocode } from '@/services/weatherService'
import LocationSearch from '@/components/LocationSearch.vue'
import CurrentWeather from '@/components/CurrentWeather.vue'
import HourlyForecast from '@/components/HourlyForecast.vue'
import DailyForecast from '@/components/DailyForecast.vue'
import PrecipitationAlert from '@/components/PrecipitationAlert.vue'
import RadarMap from '@/components/RadarMap.vue'

const locationStore = useLocationStore()
const weatherStore = useWeatherStore()
const precipitationStore = usePrecipitationStore()
const { requestPosition, loading: geoLoading, error: geoError } = useGeolocation()
const { isOnline } = useOnlineStatus()

// ── Refresh all data for the current location ───────────────────────────────
async function refreshAll(): Promise<void> {
  const lat = locationStore.latitude
  const lon = locationStore.longitude
  await Promise.allSettled([
    weatherStore.fetchWeather(lat, lon),
    precipitationStore.fetchPrecipitation(lat, lon),
  ])
}

// ── Pull-to-refresh ──────────────────────────────────────────────────────────
const { isPulling, isRefreshing, pullProgress } = usePullToRefresh({ onRefresh: refreshAll })

// ── Last-updated timestamp (weather store is authoritative) ──────────────────
const lastUpdatedLabel = computed<string | null>(() => {
  const d = weatherStore.lastUpdated
  if (!d) return null
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
})

const isLoading = computed(() => weatherStore.loading || precipitationStore.loading)

onMounted(async () => {
  // Fetch weather + precipitation for the initial/persisted location immediately
  void weatherStore.fetchWeather(locationStore.latitude, locationStore.longitude)
  void precipitationStore.fetchPrecipitation(locationStore.latitude, locationStore.longitude)

  const position = await requestPosition()

  if (position) {
    // Got a real GPS fix — update coordinates and re-fetch weather + precipitation
    locationStore.updateLocation(position.lat, position.lon)
    void weatherStore.fetchWeather(position.lat, position.lon)
    void precipitationStore.fetchPrecipitation(position.lat, position.lon)
    try {
      const name = await reverseGeocode(position.lat, position.lon)
      locationStore.updateCityName(name)
    } catch {
      // Reverse geocoding failed — keep whatever city name is in the store
    }
  }
  // On failure the store already holds Amsterdam (or last persisted location)
})

// Re-fetch weather + precipitation whenever the location changes (e.g. user picks a city)
watch(
  [() => locationStore.latitude, () => locationStore.longitude],
  ([lat, lon]) => {
    void weatherStore.fetchWeather(lat, lon)
    void precipitationStore.fetchPrecipitation(lat, lon)
  },
)
</script>

<template>
  <div class="min-h-dvh text-white">
    <!-- Pull-to-refresh indicator -->
    <Transition name="ptr">
      <div
        v-if="isPulling || isRefreshing"
        class="flex items-center justify-center py-3 text-sm text-blue-200 dark:text-blue-300"
        :style="{ opacity: isRefreshing ? 1 : pullProgress }"
      >
        <svg
          class="mr-2 size-5"
          :class="{ 'animate-spin': isRefreshing }"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
          />
        </svg>
        {{ isRefreshing ? 'Refreshing…' : 'Release to refresh' }}
      </div>
    </Transition>

    <!-- Offline banner -->
    <Transition name="slide-down">
      <div
        v-if="!isOnline"
        class="flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2.5 text-center text-sm font-medium text-amber-950 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <svg
          class="size-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        Offline — showing cached data
        <template v-if="lastUpdatedLabel">· Last updated {{ lastUpdatedLabel }}</template>
      </div>
    </Transition>

    <!-- Page shell: centred column, mobile-first -->
    <div class="mx-auto w-full max-w-lg px-4 md:max-w-2xl">
      <!-- Header -->
      <header class="pb-5 pt-safe pt-8 text-center">
        <h1 class="mb-1 text-4xl font-bold tracking-tight drop-shadow-md">
          🌤️ Dutch Weather
        </h1>
        <p class="text-sm text-blue-200 dark:text-blue-300">
          Real-time forecasts for the Netherlands
        </p>
      </header>

      <!-- Location bar -->
      <section class="flex flex-col items-center gap-3">
        <!-- Search component -->
        <LocationSearch />

        <!-- Current location display + refresh button -->
        <div class="flex min-h-[44px] items-center gap-2 text-blue-100 dark:text-blue-200">
          <!-- Geolocation loading state -->
          <template v-if="geoLoading">
            <svg
              class="size-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="Detecting location"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span class="text-sm">Detecting your location…</span>
          </template>

          <!-- Normal state: show city name -->
          <template v-else>
            <svg
              class="size-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
              />
            </svg>
            <span class="text-sm font-semibold">{{ locationStore.cityName }}</span>
            <span class="text-xs text-blue-300/70">
              ({{ locationStore.latitude.toFixed(2) }}, {{ locationStore.longitude.toFixed(2) }})
            </span>
          </template>

          <!-- Refresh button — min 44 px tap target -->
          <button
            class="ml-1 flex size-11 items-center justify-center rounded-full text-blue-200 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20 disabled:opacity-40"
            :disabled="isLoading"
            :title="isLoading ? 'Refreshing…' : 'Refresh weather data'"
            aria-label="Refresh weather data"
            @click="refreshAll"
          >
            <svg
              class="size-5"
              :class="{ 'animate-spin': isLoading }"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <!-- Last updated notice (when online, subtle; offline handled by banner) -->
        <Transition name="fade">
          <p v-if="isOnline && lastUpdatedLabel" class="text-xs text-blue-300/60">
            Last updated {{ lastUpdatedLabel }}
          </p>
        </Transition>

        <!-- Geolocation error notice -->
        <Transition name="fade">
          <p v-if="geoError" class="max-w-sm text-center text-xs text-yellow-300">
            {{ geoError }}
          </p>
        </Transition>
      </section>

      <!-- Main content: each component fills the column width -->
      <main class="mt-6 flex flex-col gap-5 pb-safe">
        <Transition name="content-fade" appear>
          <PrecipitationAlert />
        </Transition>
        <Transition name="content-fade" appear>
          <CurrentWeather />
        </Transition>
        <Transition name="content-fade" appear>
          <RadarMap />
        </Transition>
        <Transition name="content-fade" appear>
          <HourlyForecast />
        </Transition>
        <Transition name="content-fade" appear>
          <DailyForecast />
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── Offline / pull-to-refresh banner ──────────────────────────────────── */
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
  max-height: 60px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ── Pull-to-refresh spinner ───────────────────────────────────────────── */
.ptr-enter-active,
.ptr-leave-active {
  transition: opacity 0.2s ease;
}

.ptr-enter-from,
.ptr-leave-to {
  opacity: 0;
}

/* ── Subtle fade for inline notices ───────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Content sections fade + slide up on appear ───────────────────────── */
.content-fade-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.content-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
</style>
