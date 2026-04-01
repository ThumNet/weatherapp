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
 * Derive a daily precipitation intensity bucket.
 *
 * Primary path — wet-hour average (requires `precipitationHours` ≥ 1):
 *   avg = precipitationSum / precipitationHours  (mm/h across wet hours)
 *
 *   avg buckets:
 *     dry:      0 mm or 0 wet hours   → undefined
 *     drizzle:  > 0   to < 0.5 mm/h  → 'light'
 *     light:    0.5   to  2.5  mm/h  → 'light'
 *     moderate: 2.6   to  7.6  mm/h  → 'moderate'
 *     heavy:    > 7.6 mm/h           → 'heavy'
 *
 *   Daily overrides (applied after the avg bucket, can only raise intensity):
 *     precipitationSum ≥ 35 mm/day                              → 'heavy'
 *     precipitationSum ≥ 20 mm/day                              → at least 'moderate'
 *     precipitationHours ≥ 8 and precipitationSum ≥ 15 mm/day  → 'heavy'
 *
 * Fallback — sum-only (when `precipitationHours` is null, older cache shapes):
 *   dry:      0 mm              → undefined
 *   drizzle:  > 0  to < 2.5    → 'light'
 *   light:    2.5  to  7.5 mm  → 'light'
 *   moderate: 7.6  to 20   mm  → 'moderate'
 *   heavy:    > 20 mm          → 'heavy'
 */
function dailyIntensity(precipHours: number | null, precipSum: number): WeatherIntensity | undefined {
  if (precipHours !== null) {
    // Primary: avg mm/h over wet hours
    if (precipHours === 0 || precipSum <= 0) return undefined
    const avg = precipSum / precipHours

    let intensity: WeatherIntensity
    if (avg > 7.6) {
      intensity = 'heavy'
    } else if (avg >= 0.5) {
      // covers light (0.5–2.5) and moderate (2.6–7.6)
      intensity = avg <= 2.5 ? 'light' : 'moderate'
    } else {
      intensity = 'light' // drizzle: > 0 to < 0.5 avg mm/h
    }

    // Daily overrides — can only raise, never lower
    if (precipSum >= 35) return 'heavy'
    if (precipHours >= 8 && precipSum >= 15) return 'heavy'
    if (precipSum >= 20 && intensity !== 'heavy') return 'moderate'

    return intensity
  }

  // Fallback: sum-based for legacy cache shapes where precipitationHours is null
  if (precipSum <= 0) return undefined
  if (precipSum > 20) return 'heavy'
  if (precipSum >= 7.6) return 'moderate'
  if (precipSum >= 2.5) return 'light'
  return 'light' // drizzle: > 0 to < 2.5 mm/day
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
