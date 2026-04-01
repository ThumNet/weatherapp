<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import WeatherIcon from '@/components/WeatherIcon.vue'
import type { WeatherIntensity } from '@/utils/weatherCodes'

const weatherStore = useWeatherStore()

/** Format an ISO date string (YYYY-MM-DD) to a short day name like "Mon". */
function formatDayName(dateStr: string, index: number): string {
  if (index === 0) return 'Today'
  const date = new Date(dateStr + 'T12:00:00') // noon to avoid TZ edge cases
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

/** Format a date string to show the month/day, e.g. "Mar 29". */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface DayRow {
  date: string
  dayName: string
  dateLabel: string
  code: number
  tempMax: number
  tempMin: number
  precipProb: number
  precipSum: number
  /** Hours with precipitation ≥ 0.1 mm; null when field is absent from older cache shapes */
  precipHours: number | null
}

/**
 * Derive a daily precipitation intensity bucket using wet-duration as the
 * primary signal and total-sum as a fallback for older cache shapes where
 * `precipitationHours` is absent (null).
 *
 * Wet-duration buckets (hours with ≥ 0.1 mm):
 *   0        → undefined (dry)
 *   < 2 h    → 'light'   (occasional showers or brief drizzle)
 *   < 6 h    → 'moderate'(several hours of rain across the day)
 *   ≥ 6 h    → 'heavy'   (persistent / all-day rain)
 *
 * Sum-only fallback (mm/day, only when precipitationHours is null):
 *   > 0      → 'light'
 *   ≥ 5      → 'moderate'
 *   ≥ 20     → 'heavy'
 */
function dailyIntensity(precipHours: number | null, precipSum: number): WeatherIntensity | undefined {
  if (precipHours !== null) {
    if (precipHours === 0) return undefined
    if (precipHours < 2) return 'light'
    if (precipHours < 6) return 'moderate'
    return 'heavy'
  }
  // Fallback: sum-based (crude but safe for legacy cache)
  if (precipSum <= 0) return undefined
  if (precipSum >= 20) return 'heavy'
  if (precipSum >= 5) return 'moderate'
  return 'light'
}

const days = computed<DayRow[]>(() => {
  const f = weatherStore.dailyForecast
  if (!f) return []

  return f.time.map((date, i) => ({
    date,
    dayName: formatDayName(date, i),
    dateLabel: formatDate(date),
    code: f.weatherCode[i] ?? 0,
    tempMax: Math.round(f.temperatureMax[i] ?? 0),
    tempMin: Math.round(f.temperatureMin[i] ?? 0),
    precipProb: Math.round(f.precipitationProbabilityMax[i] ?? 0),
    precipSum: Math.round((f.precipitationSum[i] ?? 0) * 10) / 10,
    // precipitationHours is null when absent from older persisted cache shapes
    precipHours: f.precipitationHours !== null ? (f.precipitationHours[i] ?? null) : null,
  }))
})

const isLoading = computed(() => weatherStore.loading && !weatherStore.dailyForecast)
const error = computed(() => weatherStore.error)
</script>

<template>
  <div>
  <!-- Loading skeleton -->
  <div
    v-if="isLoading"
    class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-300/50 dark:border-white/20 bg-slate-100 dark:bg-white/10 p-5 shadow-xl backdrop-blur-md"
    aria-busy="true"
    aria-label="Loading 7-day forecast"
  >
    <div class="mb-4 h-4 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-white/20" />
    <div v-for="n in 7" :key="n" class="flex animate-pulse items-center gap-3 py-2.5">
      <div class="h-4 w-10 rounded bg-slate-200 dark:bg-white/20" />
      <div class="h-6 w-6 rounded bg-slate-200 dark:bg-white/20" />
      <div class="ml-auto h-4 w-20 rounded bg-slate-200 dark:bg-white/20" />
      <div class="h-4 w-10 rounded bg-slate-200 dark:bg-white/20" />
    </div>
  </div>

  <!-- Error state (no data at all) -->
  <div
    v-else-if="error && !days.length"
    class="w-full max-w-md overflow-hidden rounded-2xl border border-red-400/30 bg-red-500/20 p-5 shadow-xl backdrop-blur-md"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold">Could not load forecast</p>
        <p class="mt-1 text-sm text-red-600 dark:text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- Forecast card -->
  <div
    v-else-if="days.length"
    class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-300/50 dark:border-white/20 bg-gradient-to-br from-white/70 via-white/60 to-white/50 dark:from-slate-700/30 dark:via-slate-800/20 dark:to-slate-900/10 shadow-xl backdrop-blur-md transition-all duration-500"
  >
    <!-- Subtle loading bar when refreshing with existing data -->
    <div
      v-if="weatherStore.loading"
      class="h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-slate-400/60 dark:via-white/60 to-transparent"
    />

    <div class="p-5">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-white/60">
        7-Day Forecast
      </h2>

      <!-- Forecast rows -->
      <div
        v-for="(day, index) in days"
        :key="day.date"
        class="flex min-h-[44px] items-center gap-3 py-2"
        :class="{ 'border-t border-slate-200 dark:border-white/10': index > 0 }"
      >
        <!-- Day name + date -->
        <div class="w-16 shrink-0">
          <span
            class="block text-sm font-semibold"
            :class="index === 0 ? '' : 'text-slate-600 dark:text-blue-100'"
          >
            {{ day.dayName }}
          </span>
          <span class="block text-xs text-slate-400 dark:text-blue-300">{{ day.dateLabel }}</span>
        </div>

        <!-- Weather icon -->
        <WeatherIcon
          :code="day.code"
          :intensity="dailyIntensity(day.precipHours, day.precipSum)"
          :size="28"
        />

        <!-- Precipitation info -->
        <div class="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-200">
          <span class="flex items-center gap-0.5">
            <span aria-hidden="true">💧</span>
            <span>{{ day.precipProb }}%</span>
          </span>
          <span v-if="day.precipSum > 0" class="flex items-center gap-0.5 text-blue-500 dark:text-blue-300">
            <span>{{ day.precipSum }}mm</span>
          </span>
        </div>

        <!-- Temperature range (pushed to the right) -->
        <div class="ml-auto flex items-baseline gap-1 tabular-nums">
          <span class="text-sm font-bold">{{ day.tempMax }}°</span>
          <span class="text-xs text-slate-400 dark:text-blue-300">/ {{ day.tempMin }}°</span>
        </div>
      </div>

      <!-- Inline error when a refresh fails but old data is shown -->
      <p v-if="error" class="mt-3 text-center text-xs text-yellow-600 dark:text-yellow-300" role="alert">
        ⚠️ Refresh failed — showing last known data
      </p>
    </div>
  </div>
  </div>
</template>
