<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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

const isEditingLocation = ref(false)

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
      <!-- Compact header bar -->
      <header class="pb-4 pt-safe pt-6">
        <!-- Header row -->
        <div class="flex items-center gap-2">
          <!-- Brand emoji -->
          <span class="text-xl" aria-hidden="true">🌤️</span>

          <!-- Location: detecting state or city name + edit button -->
          <template v-if="geoLoading">
            <svg
              class="size-4 animate-spin text-blue-200"
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
            <span class="text-sm text-blue-200">Detecting…</span>
          </template>
          <template v-else>
            <span class="text-sm font-semibold text-white">{{ locationStore.cityName }}</span>
            <button
              class="flex size-8 items-center justify-center rounded-full text-blue-200/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Change location"
              @click="isEditingLocation = true"
            >
              <svg
                class="size-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                />
              </svg>
            </button>
          </template>

          <!-- Right side: last updated + refresh -->
          <div class="ml-auto flex items-center gap-1">
            <Transition name="fade">
              <span v-if="isOnline && lastUpdatedLabel" class="text-xs text-blue-300/60">
                Last updated {{ lastUpdatedLabel }}
              </span>
            </Transition>

            <!-- Refresh button — min 44px tap target -->
            <button
              class="flex size-8 items-center justify-center rounded-full text-blue-200/60 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20 disabled:opacity-40"
              :disabled="isLoading"
              :title="isLoading ? 'Refreshing…' : 'Refresh weather data'"
              aria-label="Refresh weather data"
              @click="refreshAll"
            >
              <svg
                class="size-4"
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
        </div>

        <!-- Search row: visible when editing -->
        <Transition name="fade">
          <div v-if="isEditingLocation" class="mt-2">
            <LocationSearch
              @select="isEditingLocation = false"
              @cancel="isEditingLocation = false"
            />
          </div>
        </Transition>

        <!-- Geolocation error notice -->
        <Transition name="fade">
          <p v-if="geoError" class="mt-2 text-xs text-yellow-300">
            {{ geoError }}
          </p>
        </Transition>
      </header>

      <!-- Main content: each component fills the column width -->
      <main class="mt-6 flex flex-col gap-5 pb-safe">
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
