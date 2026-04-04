<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import WeatherIcon from '@/components/WeatherIcon.vue'

const weatherStore = useWeatherStore()

const forecast = computed(() => weatherStore.hourlyForecast)
const loading = computed(() => weatherStore.loading)
const error = computed(() => weatherStore.error)

/** Format an ISO time string like "2024-01-15T14:00" → "14:00" */
function formatHour(isoTime: string): string {
  const parts = isoTime.split('T')
  return parts[1]?.slice(0, 5) ?? isoTime
}

interface HourlyCard {
  time: string
  code: number
  temp: number
  precip: number
  precipProb: number
  isDay: boolean | null
}

const hourlyCards = computed<HourlyCard[]>(() => {
  if (!forecast.value) return []
  return forecast.value.time.map((t, i) => ({
    time: formatHour(t),
    code: forecast.value!.weatherCode[i] ?? 0,
    temp: Math.round(forecast.value!.temperature[i] ?? 0),
    precip: forecast.value!.precipitation[i] ?? 0,
    precipProb: forecast.value!.precipitationProbability[i] ?? 0,
    isDay: forecast.value!.isDay !== null ? (forecast.value!.isDay[i] === 1) : null,
  }))
})
</script>

<template>
  <div>
  <!-- -------------------------------------------------------------------- -->
  <!-- Loading skeleton                                                        -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-if="loading && !forecast"
    class="surface-panel w-full max-w-md overflow-hidden"
    aria-busy="true"
    aria-label="Loading hourly forecast"
  >
    <div class="p-5">
      <div class="mb-4 h-4 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-white/20" />
      <!-- Card strip skeleton -->
      <div class="flex gap-2 overflow-x-hidden pb-2">
        <div
          v-for="n in 8"
          :key="n"
          class="h-24 w-16 flex-shrink-0 animate-pulse rounded-xl bg-slate-200 dark:bg-white/20"
        />
      </div>
    </div>
  </div>

  <!-- -------------------------------------------------------------------- -->
  <!-- Error state                                                             -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-else-if="error && !forecast"
    class="w-full max-w-md overflow-hidden rounded-panel border border-[#a96f61]/30 bg-[#b97a6a]/18 p-6 shadow-mist backdrop-blur-xl dark:border-[#dca293]/20 dark:bg-[#7d4c42]/18 dark:shadow-storm"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold">Could not load hourly forecast</p>
        <p class="mt-1 text-sm text-red-600 dark:text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- -------------------------------------------------------------------- -->
  <!-- Forecast card                                                           -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-else-if="forecast"
    class="surface-panel relative w-full max-w-md overflow-hidden transition-all duration-500"
  >
    <!-- Subtle loading bar when refreshing -->
    <div
      v-if="loading"
      class="relative z-10 h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-storm-water-500/50 to-transparent dark:via-sea-mist-300/45"
    />

    <div class="relative z-10 p-5">
      <!-- Section title -->
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-storm-water-500 dark:text-sea-mist-300/65">
        24-Hour Forecast
      </h2>

      <!-- Horizontally scrollable card strip -->
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        <div
          v-for="card in hourlyCards"
          :key="card.time"
          class="surface-inset flex w-[4.5rem] flex-shrink-0 snap-start flex-col items-center gap-1.5 rounded-[1rem] px-1.5 py-2.5"
        >
          <!-- Time -->
          <span class="text-[11px] uppercase tracking-[0.18em] text-storm-water-500 dark:text-sea-mist-300/65">{{ card.time }}</span>
          <!-- Weather icon -->
          <WeatherIcon
            :code="card.code"
            :intensity="card.precip > 7.6 ? 'heavy' : card.precip >= 0.5 ? 'moderate' : card.precip > 0 ? 'light' : undefined"
            :is-day="card.isDay"
            :size="28"
          />
          <!-- Temperature -->
          <span class="text-base font-semibold text-storm-water-800 dark:text-dune-foam">{{ card.temp }}°</span>
          <!-- Precipitation mm (only if > 0) -->
          <span
            v-if="card.precip > 0"
            class="text-[11px] font-medium text-storm-water-600 dark:text-sea-mist-200/90"
          >{{ card.precip }}mm</span>
          <!-- Precipitation probability -->
          <span class="text-[10px] text-storm-water-400 dark:text-[#d7b07c]/70">{{ card.precipProb }}%</span>
        </div>
      </div>

      <!-- Inline error when refresh fails but old data is shown -->
      <p v-if="error" class="mt-3 text-center text-xs text-[#7a5422] dark:text-[#e7c48b]" role="alert">
        ⚠️ Refresh failed — showing last known data
      </p>
    </div>
  </div>
  </div>
</template>
