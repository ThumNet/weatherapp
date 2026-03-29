<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { getWeatherDescription, getWeatherIcon, degreesToCompass } from '@/utils/weatherCodes'

const weatherStore = useWeatherStore()

const weather = computed(() => weatherStore.currentWeather)
const loading = computed(() => weatherStore.loading)
const error = computed(() => weatherStore.error)

const temperature = computed(() =>
  weather.value !== null ? Math.round(weather.value.temperature) : null,
)
const feelsLike = computed(() =>
  weather.value !== null ? Math.round(weather.value.apparentTemperature) : null,
)
const icon = computed(() =>
  weather.value !== null ? getWeatherIcon(weather.value.weatherCode) : '',
)
const description = computed(() =>
  weather.value !== null ? getWeatherDescription(weather.value.weatherCode) : '',
)
const windCompass = computed(() =>
  weather.value !== null ? degreesToCompass(weather.value.windDirection) : '',
)

const lastUpdatedLabel = computed(() => {
  if (!weatherStore.lastUpdated) return null
  return weatherStore.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})
</script>

<template>
  <!-- ------------------------------------------------------------------ -->
  <!-- Loading skeleton                                                      -->
  <!-- ------------------------------------------------------------------ -->
  <div
    v-if="loading && !weather"
    class="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md"
    aria-busy="true"
    aria-label="Loading weather data"
  >
    <div class="p-6">
      <!-- Temperature skeleton -->
      <div class="mb-4 flex items-end justify-between">
        <div class="h-20 w-36 animate-pulse rounded-xl bg-white/20" />
        <div class="h-12 w-12 animate-pulse rounded-full bg-white/20" />
      </div>
      <!-- Description skeleton -->
      <div class="mb-6 h-5 w-40 animate-pulse rounded-lg bg-white/20" />
      <!-- Stats row skeleton -->
      <div class="grid grid-cols-3 gap-3">
        <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-white/20" />
      </div>
    </div>
  </div>

  <!-- ------------------------------------------------------------------ -->
  <!-- Error state                                                           -->
  <!-- ------------------------------------------------------------------ -->
  <div
    v-else-if="error && !weather"
    class="w-full max-w-md overflow-hidden rounded-3xl border border-red-400/30 bg-red-500/20 p-6 shadow-2xl backdrop-blur-md"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold text-white">Could not load weather</p>
        <p class="mt-1 text-sm text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- ------------------------------------------------------------------ -->
  <!-- Weather card                                                          -->
  <!-- ------------------------------------------------------------------ -->
  <div
    v-else-if="weather"
    class="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/20 via-white/10 to-white/5 shadow-2xl backdrop-blur-md transition-all duration-500 dark:from-slate-700/40 dark:via-slate-800/30 dark:to-slate-900/20"
  >
    <!-- Subtle loading bar when refreshing -->
    <div
      v-if="loading"
      class="h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-white/60 to-transparent"
    />

    <div class="p-6">
      <!-- Top row: temperature + big icon -->
      <div class="mb-2 flex items-start justify-between">
        <!-- Temperature -->
        <div>
          <div class="flex items-start leading-none">
            <span class="text-7xl font-thin tracking-tighter text-white drop-shadow-lg">
              {{ temperature }}
            </span>
            <span class="mt-3 text-3xl font-light text-white/80">°C</span>
          </div>
        </div>

        <!-- Weather icon (large) -->
        <span
          class="select-none text-6xl drop-shadow-md transition-all duration-300"
          aria-hidden="true"
        >
          {{ icon }}
        </span>
      </div>

      <!-- Description -->
      <p class="mb-6 text-lg font-medium text-white/90">
        {{ description }}
      </p>

      <!-- Stats grid -->
      <div class="grid grid-cols-3 gap-3">
        <!-- Feels like -->
        <div
          class="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/10 px-2 py-3 text-center dark:bg-white/5"
        >
          <span class="text-xl" aria-hidden="true">🌡️</span>
          <span class="text-xs font-medium uppercase tracking-wide text-white/60">Feels like</span>
          <span class="text-base font-semibold text-white">{{ feelsLike }}°C</span>
        </div>

        <!-- Humidity -->
        <div
          class="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/10 px-2 py-3 text-center dark:bg-white/5"
        >
          <span class="text-xl" aria-hidden="true">💧</span>
          <span class="text-xs font-medium uppercase tracking-wide text-white/60">Humidity</span>
          <span class="text-base font-semibold text-white">{{ weather.humidity }}%</span>
        </div>

        <!-- Wind -->
        <div
          class="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/10 px-2 py-3 text-center dark:bg-white/5"
        >
          <span class="text-xl" aria-hidden="true">💨</span>
          <span class="text-xs font-medium uppercase tracking-wide text-white/60">Wind</span>
          <span class="text-base font-semibold text-white">
            {{ Math.round(weather.windSpeed) }}
            <span class="text-xs font-normal text-white/70">km/h</span>
          </span>
          <span class="text-xs text-white/60">{{ windCompass }}</span>
        </div>
      </div>

      <!-- Last updated -->
      <p v-if="lastUpdatedLabel" class="mt-4 text-right text-xs text-white/40">
        Updated {{ lastUpdatedLabel }}
      </p>

      <!-- Inline error when a refresh fails (but old data is still shown) -->
      <p v-if="error" class="mt-2 text-center text-xs text-yellow-300" role="alert">
        ⚠️ Refresh failed — showing last known data
      </p>
    </div>
  </div>
</template>
