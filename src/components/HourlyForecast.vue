<script setup lang="ts">
import { computed } from 'vue'
import { useLanguageStore } from '@/stores/language'
import { useWeatherStore } from '@/stores/weather'
import WeatherIcon from '@/components/WeatherIcon.vue'
import { degreesToCompass } from '@/utils/weatherCodes'

const weatherStore = useWeatherStore()
const languageStore = useLanguageStore()

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
  windSpeed: number | null
  windDirection: number | null
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
    windSpeed: forecast.value!.windSpeed?.[i] ?? null,
    windDirection: forecast.value!.windDirection?.[i] ?? null,
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
    class="w-full border-b border-slate-200 pb-6 dark:border-slate-800"
    aria-busy="true"
    :aria-label="languageStore.t('hourly.loading')"
  >
    <div class="px-2">
      <div class="mb-4 h-4 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-white/20" />
      <!-- Card strip skeleton -->
      <div class="flex overflow-x-hidden pb-2">
        <div
          v-for="n in 8"
          :key="n"
          class="flex h-24 w-[4.5rem] flex-shrink-0 flex-col items-center justify-center gap-2 border-r border-slate-200 last:border-r-0 dark:border-slate-800"
        >
          <div class="h-3 w-8 animate-pulse rounded bg-slate-200 dark:bg-white/20" />
          <div class="h-6 w-6 animate-pulse rounded-full bg-slate-200 dark:bg-white/20" />
          <div class="h-4 w-6 animate-pulse rounded bg-slate-200 dark:bg-white/20" />
        </div>
      </div>
    </div>
  </div>

  <!-- -------------------------------------------------------------------- -->
  <!-- Error state                                                             -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-else-if="error && !forecast"
    class="w-full border-b border-[#a96f61]/30 bg-[#b97a6a]/18 p-6 dark:border-[#dca293]/20 dark:bg-[#7d4c42]/18"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold">{{ languageStore.t('hourly.error') }}</p>
        <p class="mt-1 text-sm text-red-600 dark:text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- -------------------------------------------------------------------- -->
  <!-- Forecast card                                                           -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-else-if="forecast"
    class="relative w-full border-b border-slate-200 pb-6 transition-all duration-500 dark:border-slate-800"
  >
    <!-- Subtle loading bar when refreshing -->
    <div
      v-if="loading"
      class="absolute left-0 top-0 z-10 h-0.5 w-full animate-pulse bg-dutch-orange"
    />

    <div class="relative z-10 px-2">
      <!-- Section title -->
      <div class="mb-4">
        <h2 class="text-sm font-semibold uppercase tracking-[0.24em] text-storm-water-500 dark:text-sea-mist-300/65">
          {{ languageStore.t('hourly.title') }}
        </h2>
      </div>

      <!-- Horizontally scrollable card strip -->
      <div class="relative">
        <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory pr-8">
          <div
            v-for="(card, idx) in hourlyCards"
            :key="card.time"
            class="flex w-[4.5rem] flex-shrink-0 snap-start flex-col items-center gap-1.5 border-r border-slate-200 px-1.5 py-2.5 last:border-r-0 dark:border-slate-800"
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
            <!-- Wind -->
            <div v-if="card.windSpeed !== null" class="flex items-baseline gap-1 text-storm-water-500 dark:text-sea-mist-300/70">
              <span class="text-[10px] font-medium">{{ Math.round(card.windSpeed) }}</span>
              <span class="text-[9px] uppercase tracking-wider">{{ card.windDirection !== null ? degreesToCompass(card.windDirection) : '' }}</span>
            </div>
            <!-- Precipitation mm (only if > 0) -->
            <span
              v-if="card.precip > 0"
              class="text-[11px] font-medium text-storm-water-600 dark:text-sea-mist-200/90"
            >{{ card.precip }}mm</span>
            <!-- Precipitation probability -->
            <span class="text-[10px] text-storm-water-400 dark:text-[#d7b07c]/70">{{ card.precipProb }}%</span>
          </div>
        </div>

        <!-- Floating Scroll indicator arrow -->
        <div class="pointer-events-none absolute -right-2 top-0 bottom-0 flex items-center justify-end bg-gradient-to-l from-white via-white/80 to-transparent dark:from-slate-950 dark:via-slate-950/80 w-10 pb-2 pr-1">
          <svg class="size-4 text-storm-water-400 dark:text-sea-mist-300/50 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>

      <!-- Inline error when refresh fails but old data is shown -->
      <p v-if="error" class="mt-3 text-center text-xs text-[#7a5422] dark:text-[#e7c48b]" role="alert">
        ⚠️ {{ languageStore.t('common.refreshFailed') }}
      </p>
    </div>
  </div>
  </div>
</template>
