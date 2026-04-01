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
}

const hourlyCards = computed<HourlyCard[]>(() => {
  if (!forecast.value) return []
  return forecast.value.time.map((t, i) => ({
    time: formatHour(t),
    code: forecast.value!.weatherCode[i] ?? 0,
    temp: Math.round(forecast.value!.temperature[i] ?? 0),
    precip: forecast.value!.precipitation[i] ?? 0,
    precipProb: forecast.value!.precipitationProbability[i] ?? 0,
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
    class="w-full max-w-md overflow-hidden rounded-3xl border border-slate-300/50 dark:border-white/20 bg-slate-100 dark:bg-white/10 shadow-2xl backdrop-blur-md"
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
    class="w-full max-w-md overflow-hidden rounded-3xl border border-red-400/30 bg-red-500/20 p-6 shadow-2xl backdrop-blur-md"
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
    class="w-full max-w-md overflow-hidden rounded-3xl border border-slate-300/50 dark:border-white/20 bg-gradient-to-br from-white/70 via-white/60 to-white/50 dark:from-slate-700/40 dark:via-slate-800/30 dark:to-slate-900/20 shadow-2xl backdrop-blur-md transition-all duration-500"
  >
    <!-- Subtle loading bar when refreshing -->
    <div
      v-if="loading"
      class="h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-slate-400/60 dark:via-white/60 to-transparent"
    />

    <div class="p-5">
      <!-- Section title -->
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-white/60">
        24-Hour Forecast
      </h2>

      <!-- Horizontally scrollable card strip -->
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        <div
          v-for="card in hourlyCards"
          :key="card.time"
          class="flex-shrink-0 w-16 flex flex-col items-center gap-1 rounded-xl py-2 px-1 snap-start bg-slate-100/80 dark:bg-white/10"
        >
          <!-- Time -->
          <span class="text-xs text-slate-500 dark:text-white/60">{{ card.time }}</span>
          <!-- Weather icon -->
          <WeatherIcon
            :code="card.code"
            :intensity="card.precip >= 7.5 ? 'heavy' : card.precip >= 0.5 ? 'moderate' : card.precip > 0 ? 'light' : undefined"
            :size="28"
          />
          <!-- Temperature -->
          <span class="text-sm font-semibold text-slate-800 dark:text-white">{{ card.temp }}°</span>
          <!-- Precipitation mm (only if > 0) -->
          <span
            v-if="card.precip > 0"
            class="text-xs text-blue-500 dark:text-blue-300"
          >{{ card.precip }}mm</span>
          <!-- Precipitation probability -->
          <span class="text-[10px] text-slate-400 dark:text-blue-200/60">{{ card.precipProb }}%</span>
        </div>
      </div>

      <!-- Inline error when refresh fails but old data is shown -->
      <p v-if="error" class="mt-3 text-center text-xs text-yellow-600 dark:text-yellow-300" role="alert">
        ⚠️ Refresh failed — showing last known data
      </p>
    </div>
  </div>
  </div>
</template>
