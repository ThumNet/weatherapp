<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { getWeatherIcon } from '@/utils/weatherCodes'

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
  icon: string
  tempMax: number
  tempMin: number
  precipProb: number
}

const days = computed<DayRow[]>(() => {
  const f = weatherStore.dailyForecast
  if (!f) return []

  return f.time.map((date, i) => ({
    date,
    dayName: formatDayName(date, i),
    dateLabel: formatDate(date),
    icon: getWeatherIcon(f.weatherCode[i] ?? 0),
    tempMax: Math.round(f.temperatureMax[i] ?? 0),
    tempMin: Math.round(f.temperatureMin[i] ?? 0),
    precipProb: Math.round(f.precipitationProbabilityMax[i] ?? 0),
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
    class="w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-md dark:bg-white/5"
    aria-busy="true"
    aria-label="Loading 7-day forecast"
  >
    <div class="mb-4 h-4 w-28 animate-pulse rounded-lg bg-white/20" />
    <div v-for="n in 7" :key="n" class="flex animate-pulse items-center gap-3 py-2.5">
      <div class="h-4 w-10 rounded bg-white/20" />
      <div class="h-6 w-6 rounded bg-white/20" />
      <div class="ml-auto h-4 w-20 rounded bg-white/20" />
      <div class="h-4 w-10 rounded bg-white/20" />
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
        <p class="font-semibold text-white">Could not load forecast</p>
        <p class="mt-1 text-sm text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- Forecast card -->
  <div
    v-else-if="days.length"
    class="w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 via-white/10 to-white/5 shadow-xl backdrop-blur-md transition-all duration-500 dark:from-slate-700/30 dark:via-slate-800/20 dark:to-slate-900/10"
  >
    <!-- Subtle loading bar when refreshing with existing data -->
    <div
      v-if="weatherStore.loading"
      class="h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-white/60 to-transparent"
    />

    <div class="p-5">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-widest text-white/60">
        7-Day Forecast
      </h2>

      <!-- Forecast rows -->
      <div
        v-for="(day, index) in days"
        :key="day.date"
        class="flex min-h-[44px] items-center gap-3 py-2"
        :class="{ 'border-t border-white/10': index > 0 }"
      >
        <!-- Day name + date -->
        <div class="w-16 shrink-0">
          <span
            class="block text-sm font-semibold"
            :class="index === 0 ? 'text-white' : 'text-blue-100'"
          >
            {{ day.dayName }}
          </span>
          <span class="block text-xs text-blue-300">{{ day.dateLabel }}</span>
        </div>

        <!-- Weather icon -->
        <span class="text-xl leading-none" :title="day.icon" aria-hidden="true">
          {{ day.icon }}
        </span>

        <!-- Precipitation probability -->
        <div class="flex items-center gap-1 text-xs text-blue-200">
          <span aria-hidden="true">💧</span>
          <span>{{ day.precipProb }}%</span>
        </div>

        <!-- Temperature range (pushed to the right) -->
        <div class="ml-auto flex items-baseline gap-1 tabular-nums">
          <span class="text-sm font-bold text-white">{{ day.tempMax }}°</span>
          <span class="text-xs text-blue-300">/ {{ day.tempMin }}°</span>
        </div>
      </div>

      <!-- Inline error when a refresh fails but old data is shown -->
      <p v-if="error" class="mt-3 text-center text-xs text-yellow-300" role="alert">
        ⚠️ Refresh failed — showing last known data
      </p>
    </div>
  </div>
  </div>
</template>
