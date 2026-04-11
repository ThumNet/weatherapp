<script setup lang="ts">
import { computed } from 'vue'
import { useLanguageStore } from '@/stores/language'
import { useWeatherStore } from '@/stores/weather'
import WeatherIcon from '@/components/WeatherIcon.vue'
import type { WeatherIntensity } from '@/utils/weatherCodes'

  const weatherStore = useWeatherStore()
const languageStore = useLanguageStore()

const precipitationIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0Z"/></svg>`

/** Format an ISO date string (YYYY-MM-DD) to a short day name like "Mon". */
function formatDayName(dateStr: string, index: number): string {
  if (index === 0) return languageStore.t('daily.today')
  const date = new Date(dateStr + 'T12:00:00') // noon to avoid TZ edge cases
  return date.toLocaleDateString(languageStore.locale, { weekday: 'short' })
}

/** Format a date string to show the month/day, e.g. "Mar 29". */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString(languageStore.locale, { month: 'short', day: 'numeric' })
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
    class="surface-panel w-full max-w-md overflow-hidden p-5"
    aria-busy="true"
    :aria-label="languageStore.t('daily.loading')"
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
    class="w-full max-w-md overflow-hidden rounded-panel border border-[#a96f61]/30 bg-[#b97a6a]/18 p-5 shadow-mist backdrop-blur-xl dark:border-[#dca293]/20 dark:bg-[#7d4c42]/18 dark:shadow-storm"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold">{{ languageStore.t('daily.error') }}</p>
        <p class="mt-1 text-sm text-red-600 dark:text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- Forecast card -->
  <div
    v-else-if="days.length"
    class="surface-panel relative w-full max-w-md overflow-hidden transition-all duration-500"
  >
    <!-- Subtle loading bar when refreshing with existing data -->
    <div
      v-if="weatherStore.loading"
      class="relative z-10 h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-storm-water-500/50 to-transparent dark:via-sea-mist-300/45"
    />

    <div class="relative z-10 p-5">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-storm-water-500 dark:text-sea-mist-300/65">
        {{ languageStore.t('daily.title') }}
      </h2>

      <!-- Forecast rows -->
      <div
        v-for="(day, index) in days"
        :key="day.date"
        class="surface-inset flex min-h-[52px] items-center gap-3 rounded-[1rem] px-3 py-3"
        :class="index > 0 ? 'mt-2' : ''"
      >
        <!-- Day name + date -->
        <div class="w-16 shrink-0">
          <span
            class="block text-sm font-semibold"
            :class="index === 0 ? 'text-storm-water-800 dark:text-dune-foam' : 'text-storm-water-700 dark:text-sea-mist-100'"
          >
            {{ day.dayName }}
          </span>
          <span class="block text-xs text-storm-water-400 dark:text-sea-mist-300/55">{{ day.dateLabel }}</span>
        </div>

        <!-- Weather icon -->
        <WeatherIcon
          :code="day.code"
          :intensity="dailyIntensity(day.precipHours, day.precipSum)"
          :size="28"
        />

        <!-- Precipitation info -->
        <div class="flex items-center gap-2 text-xs text-storm-water-600 dark:text-sea-mist-200">
          <span class="flex items-center gap-0.5">
            <span class="size-3.5" aria-hidden="true" v-html="precipitationIcon" />
            <span>{{ day.precipProb }}%</span>
          </span>
          <span v-if="day.precipSum > 0" class="flex items-center gap-0.5 text-storm-water-500 dark:text-[#d7b07c]/82">
            <span>{{ day.precipSum }}mm</span>
          </span>
        </div>

        <!-- Temperature range (pushed to the right) -->
        <div class="ml-auto flex items-baseline gap-1 tabular-nums">
          <span class="text-base font-semibold text-storm-water-800 dark:text-dune-foam">{{ day.tempMax }}°</span>
          <span class="text-xs text-storm-water-400 dark:text-sea-mist-300/55">/ {{ day.tempMin }}°</span>
        </div>
      </div>

      <!-- Inline error when a refresh fails but old data is shown -->
      <p v-if="error" class="mt-3 text-center text-xs text-[#7a5422] dark:text-[#e7c48b]" role="alert">
        ⚠️ {{ languageStore.t('common.refreshFailed') }}
      </p>
    </div>
  </div>
  </div>
</template>
