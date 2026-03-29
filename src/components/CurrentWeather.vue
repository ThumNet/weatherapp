<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { usePrecipitationStore } from '@/stores/precipitation'
import { getWeatherDescription, getWeatherIcon, degreesToCompass } from '@/utils/weatherCodes'

defineEmits<{ (e: 'open-radar'): void }>()

const weatherStore = useWeatherStore()
const precipStore = usePrecipitationStore()

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

// ── Precipitation helpers ────────────────────────────────────────────────────

/**
 * Bar height as a percentage of the chart area (4–100 %).
 * Clamped to 4 % minimum so zero-rain bars remain visible as a thin line.
 * Uses an absolute minimum scale of 2.5 mm/h (light rain) so drizzle bars
 * stay proportionally short even when there's no heavier rain in the window.
 */
const MIN_SCALE_MM = 2.5
function barHeightPercent(mmPerHour: number): number {
  const max = Math.max(precipStore.maxIntensity, MIN_SCALE_MM)
  if (max <= 0) return 4
  return Math.max(4, (mmPerHour / max) * 100)
}

/** Color class for a precipitation bar based on intensity */
function barColorClass(mmPerHour: number): string {
  if (mmPerHour <= 0) return 'bg-white/15 dark:bg-white/10'
  if (mmPerHour < 0.5) return 'bg-blue-300/60 dark:bg-blue-300/50'
  if (mmPerHour <= 2.5) return 'bg-blue-400/80 dark:bg-blue-400/70'
  if (mmPerHour <= 7.5) return 'bg-blue-600/85 dark:bg-blue-500/80'
  return 'bg-purple-500/90 dark:bg-purple-400/85'
}

/** Describes the intensity of the first upcoming rain */
const rainIntensityLabel = computed<string>(() => {
  const idx = precipStore.entries.findIndex((e) => e.mmPerHour >= 0.1)
  if (idx === -1) return ''
  const mm = precipStore.entries[idx].mmPerHour
  if (mm < 0.5) return 'Light drizzle'
  if (mm <= 2.5) return 'Light rain'
  if (mm <= 7.5) return 'Moderate rain'
  return 'Heavy rain'
})

/** Icon for the current/upcoming rain intensity */
const rainIntensityIcon = computed<string>(() => {
  const idx = precipStore.entries.findIndex((e) => e.mmPerHour >= 0.1)
  if (idx === -1) return '☀️'
  const mm = precipStore.entries[idx].mmPerHour
  if (mm < 0.5) return '🌦️'
  if (mm <= 7.5) return '🌧️'
  return '⛈️'
})

/** Show every Nth label to avoid crowding (Buienradar gives 24 × 5-min entries) */
const labelInterval = computed<number>(() => {
  const count = precipStore.entries.length
  if (count <= 12) return 2
  if (count <= 20) return 4
  return 6
})

const alertStyle = computed<'rain' | 'soon' | 'clear'>(() => {
  const mins = precipStore.minutesUntilRain
  if (mins === null) return 'clear'
  if (mins === 0) return 'rain'
  return 'soon'
})

const chartScale = computed(() => Math.max(precipStore.maxIntensity, MIN_SCALE_MM))

const gridLines = computed(() => {
  const max = chartScale.value
  const thresholds = [0.5, 2.5, 7.5]
  const visible = thresholds.filter(t => {
    const pct = (t / max) * 100
    return pct >= 5 && pct <= 95
  })
  return visible.map((t, i) => ({
    mmPerHour: t,
    percent: (t / max) * 100,
    label: `${t}`,
  }))
})
</script>

<template>
  <div>
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

      <!-- Divider skeleton -->
      <div class="my-4 h-px w-full animate-pulse rounded bg-white/10" />

      <!-- Precipitation skeleton -->
      <div class="mb-3 h-8 animate-pulse rounded-lg bg-white/20" />
      <div class="flex items-end gap-0.5">
        <div
          v-for="n in 24"
          :key="n"
          class="h-16 flex-1 animate-pulse rounded-t bg-white/10"
          :style="{ animationDelay: `${n * 40}ms` }"
        />
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

      <!-- Inline error when a refresh fails (but old weather data is still shown) -->
      <p v-if="error" class="mt-3 text-center text-xs text-yellow-300" role="alert">
        ⚠️ Refresh failed — showing last known data
      </p>

      <!-- ---------------------------------------------------------------- -->
      <!-- Precipitation section                                              -->
      <!-- ---------------------------------------------------------------- -->
      <hr class="my-4 border-white/10" />

      <!-- Precipitation loading skeleton (weather card already visible) -->
      <template v-if="precipStore.loading && precipStore.entries.length === 0">
        <div
          class="mb-3 h-8 animate-pulse rounded-lg bg-white/20"
          aria-busy="true"
          aria-label="Loading precipitation data"
        />
        <div class="flex items-end gap-0.5">
          <div
            v-for="n in 24"
            :key="n"
            class="h-16 flex-1 animate-pulse rounded-t bg-white/10"
            :style="{ animationDelay: `${n * 40}ms` }"
          />
        </div>
      </template>

      <!-- Precipitation data -->
      <template v-else-if="precipStore.entries.length > 0">
        <!-- Bar chart -->
        <div class="relative">
          <!-- Chart area with gridlines -->
          <div class="relative flex h-20">
            <!-- Bars -->
            <div class="relative flex-1">
              <!-- Horizontal gridlines (behind bars) -->
              <div
                v-for="line in gridLines"
                :key="line.mmPerHour"
                class="pointer-events-none absolute left-0 right-0 z-10"
                :style="{ bottom: `${line.percent}%` }"
              >
                <div class="border-t border-dashed border-white/20" />
              </div>

              <!-- Bar columns -->
              <div class="flex h-full items-end gap-px">
              <div
                v-for="(entry, idx) in precipStore.entries"
                :key="entry.time"
                class="relative flex-1 rounded-t transition-all duration-300"
                :class="barColorClass(entry.mmPerHour)"
                :style="{ height: `${barHeightPercent(entry.mmPerHour)}%` }"
                :title="`${entry.time} — ${entry.mmPerHour > 0 ? entry.mmPerHour.toFixed(2) + ' mm/h (' + (entry.mmPerHour < 0.5 ? 'drizzle' : entry.mmPerHour <= 2.5 ? 'light' : entry.mmPerHour <= 7.5 ? 'moderate' : 'heavy') + ')' : 'dry'}`"
                :aria-label="`${entry.time}: ${entry.mmPerHour.toFixed(2)} mm/h`"
              >
                <!-- Highlight the first rainy bar -->
                <div
                  v-if="idx === precipStore.minutesUntilRain! / 5 && precipStore.isRainExpected"
                  class="absolute inset-x-0 -top-1 mx-auto h-1 w-1 rounded-full bg-yellow-300"
                />
              </div>
            </div>
            </div>

            <!-- Scale labels (right side) -->
            <div class="relative w-8 shrink-0">
              <span
                v-for="line in gridLines"
                :key="'label-' + line.mmPerHour"
                class="pointer-events-none absolute right-0 -translate-y-1/2 text-[9px] leading-none text-white/40"
                :style="{ bottom: `${line.percent}%` }"
              >
                {{ line.label }}
              </span>
            </div>
          </div>

          <!-- Time axis labels -->
          <div class="mt-1 flex items-start gap-px">
            <div
              v-for="(entry, idx) in precipStore.entries"
              :key="entry.time + '-label'"
              class="flex-1 overflow-visible text-center"
            >
              <span
                v-if="idx % labelInterval === 0"
                class="text-[10px] leading-tight text-slate-600 dark:text-blue-200/60"
              >
                {{ entry.time }}
              </span>
            </div>
            <span class="shrink-0 text-[9px] leading-tight text-blue-200/40 pl-1">mm/h</span>
          </div>
        </div>

        <!-- Alert banner — tappable button to open radar -->
        <button
          class="mt-4 w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-inner transition-colors"
          :class="{
            'bg-blue-500/70 text-white': alertStyle === 'rain',
            'bg-yellow-400/80 text-yellow-900': alertStyle === 'soon',
            'bg-green-500/60 text-white': alertStyle === 'clear',
          }"
          @click="$emit('open-radar')"
        >
          <!-- Icon -->
          <span class="text-xl leading-none">
          {{ rainIntensityIcon }}
          </span>

          <!-- Message -->
          <span v-if="alertStyle === 'rain'">{{ rainIntensityLabel }} — falling now</span>
          <span v-else-if="alertStyle === 'soon'">
            {{ rainIntensityLabel }} in {{ precipStore.minutesUntilRain }} minute{{
              precipStore.minutesUntilRain === 1 ? '' : 's'
            }}
          </span>
          <span v-else>No rain expected for the next 2 hours</span>

          <!-- Refreshing spinner -->
          <svg
            v-if="precipStore.loading"
            class="ml-auto size-4 animate-spin opacity-60"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Refreshing"
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

          <!-- Chevron right (only shown when not loading) -->
          <svg
            v-else
            class="ml-auto size-4 opacity-60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <!-- Non-blocking precipitation error notice -->
        <p v-if="precipStore.error" class="mt-3 text-center text-xs text-yellow-300/80">
          ⚠️ {{ precipStore.error }}
        </p>
      </template>

      <!-- Precipitation error (no data at all) -->
      <template v-else-if="precipStore.error">
        <div class="flex items-start gap-3 rounded-xl bg-red-500/20 px-4 py-3" role="alert">
          <span class="mt-0.5 text-xl" aria-hidden="true">⚠️</span>
          <div>
            <p class="text-sm font-semibold text-white">Precipitation data unavailable</p>
            <p class="mt-0.5 text-xs text-red-200">{{ precipStore.error }}</p>
          </div>
        </div>
      </template>
    </div>
  </div>
  </div>
</template>
