<script setup lang="ts">
import { computed } from 'vue'
import { useLanguageStore } from '@/stores/language'
import { useWeatherStore } from '@/stores/weather'
import { usePrecipitationStore } from '@/stores/precipitation'
import { getWeatherDescription, degreesToCompass } from '@/utils/weatherCodes'
import type { WeatherIntensity } from '@/utils/weatherCodes'
import { useMoonPhase } from '@/composables/useMoonPhase'
import WeatherIcon from '@/components/WeatherIcon.vue'

defineEmits<{ (e: 'open-radar'): void }>()

const weatherStore = useWeatherStore()
const precipStore = usePrecipitationStore()
const languageStore = useLanguageStore()
const moonPhase = useMoonPhase()

const weather = computed(() => weatherStore.currentWeather)
const daily = computed(() => weatherStore.dailyForecast)
const loading = computed(() => weatherStore.loading)
const error = computed(() => weatherStore.error)

/** Format an ISO datetime string (e.g. "2026-04-02T06:14") to "HH:MM" */
function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(languageStore.locale, { hour: '2-digit', minute: '2-digit', hour12: false })
}

const todaySunrise = computed<string | null>(() =>
  daily.value?.sunrise?.[0] ? formatTime(daily.value.sunrise[0]) : null,
)
const todaySunset = computed<string | null>(() =>
  daily.value?.sunset?.[0] ? formatTime(daily.value.sunset[0]) : null,
)

const temperature = computed(() =>
  weather.value !== null ? Math.round(weather.value.temperature) : null,
)
const feelsLike = computed(() =>
  weather.value !== null ? Math.round(weather.value.apparentTemperature) : null,
)
const windCompass = computed(() =>
  weather.value !== null ? degreesToCompass(weather.value.windDirection) : '',
)
const todayMaxTemp = computed(() =>
  daily.value?.temperatureMax?.[0] != null ? Math.round(daily.value.temperatureMax[0]) : null,
)
const todayMinTemp = computed(() =>
  daily.value?.temperatureMin?.[0] != null ? Math.round(daily.value.temperatureMin[0]) : null,
)
const todayPrecipProb = computed(() => daily.value?.precipitationProbabilityMax?.[0] ?? null)
const todayPrecipHours = computed(() => daily.value?.precipitationHours?.[0] ?? null)
const todayPrecipSum = computed(() => daily.value?.precipitationSum?.[0] ?? null)
const todayCondition = computed(() =>
  weather.value !== null ? getWeatherDescription(weather.value.weatherCode, languageStore.t) : '',
)

const humidityRainDetail = computed(() => {
  const precip = todayPrecipSum.value
  if (precip == null) return ''
  if (precip < 0.1) return languageStore.t('current.noRainExpected')
  if (precip < 1) return languageStore.t('current.mmExpected', { value: precip.toFixed(1) })
  return languageStore.t('current.mmExpected', { value: Math.round(precip * 10) / 10 })
})

const windSummary = computed(() => {
  const speed = weather.value?.windSpeed
  if (speed == null) return ''
  const tone = speed < 8
    ? languageStore.t('current.calm')
    : speed < 18
      ? languageStore.t('current.lightBreeze')
      : speed < 28
        ? languageStore.t('current.breezy')
        : languageStore.t('current.windy')
  return `${tone} ${windCompass.value}`
})

const rainSummary = computed(() => {
  const mins = precipStore.minutesUntilRain
  if (mins === null) {
    if ((todayPrecipProb.value ?? 0) >= 45) return languageStore.t('current.showersLater')
    return languageStore.t('current.mostlyDryToday')
  }
  if (mins === 0) return `${rainIntensityLabel.value} ${languageStore.t('current.now')}`
  return languageStore.t('current.inMinutes', { label: rainIntensityLabel.value, minutes: mins })
})

const todayOutlook = computed(() => {
  const condition = todayCondition.value
  const precipProb = todayPrecipProb.value ?? 0
  const precipHours = todayPrecipHours.value ?? 0
  const max = todayMaxTemp.value
  const min = todayMinTemp.value
  const wind = windSummary.value.toLowerCase()

  let rainPhrase = languageStore.t('current.stayingMostlyDry')
  if (precipProb >= 70 && precipHours >= 4) rainPhrase = languageStore.t('current.rainLikelyMuchOfDay')
  else if (precipProb >= 55) rainPhrase = languageStore.t('current.showersLikelyLater')
  else if (precipProb >= 30) rainPhrase = languageStore.t('current.slightChanceOfRainLater')

  let rangePhrase = ''
  if (max !== null && min !== null) rangePhrase = languageStore.t('current.highLow', { max, min })
  else if (max !== null) rangePhrase = languageStore.t('current.highNear', { max })

  return `${condition}, ${wind}, ${rainPhrase}. ${rangePhrase}`.replace(/\s+/g, ' ').trim()
})

// ── Current-hour icon intensity ──────────────────────────────────────────────

/**
 * Intensity hint for the hero WeatherIcon derived from the current-hour
 * precipitation value (mm/h). Uses the same rate-based thresholds as the
 * hourly forecast view so the two are visually consistent.
 *
 * Thresholds (mm/h):
 *   dry:      0
 *   drizzle:  > 0  to < 0.5  → 'light'  (routes to drizzle-light SVG via WMO code)
 *   light:    0.5  to  2.5   → 'light'
 *   moderate: 2.6  to  7.6   → 'moderate'
 *   heavy:    > 7.6          → 'heavy'
 *
 * Falls back to `undefined` when:
 *   - no weather data is loaded yet
 *   - `precipitation` is null (older persisted cache shape without this field)
 *   - precipitation is 0 (dry — no intensity override needed)
 */
const currentWeatherIntensity = computed<WeatherIntensity | undefined>(() => {
  const precip = weather.value?.precipitation ?? null
  if (precip === null || precip === 0) return undefined
  if (precip > 7.6) return 'heavy'
  if (precip >= 0.5) return 'moderate'
  return 'light' // covers drizzle (> 0 to < 0.5) and light (0.5 to 2.5, handled above)
})

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
  if (mmPerHour <= 0) return 'bg-storm-water-200/50 dark:bg-white/10'
  if (mmPerHour < 0.5) return 'bg-[#adc2cf]/80 dark:bg-[#8ea8b7]/55'   // drizzle
  if (mmPerHour <= 2.5) return 'bg-[#7e9eb1]/85 dark:bg-[#6b8a9d]/75'  // light
  if (mmPerHour <= 7.6) return 'bg-storm-water-600/85 dark:bg-storm-water-500/80'  // moderate
  return 'bg-[#d19a5f]/90 dark:bg-[#c88a47]/85'                        // heavy
}

/** Describes the intensity of the first upcoming rain */
const rainIntensityLabel = computed<string>(() => {
  const idx = precipStore.entries.findIndex((e) => e.mmPerHour >= 0.1)
  if (idx === -1) return ''
  const mm = precipStore.entries[idx].mmPerHour
  if (mm < 0.5) return languageStore.t('current.lightDrizzle')
  if (mm <= 2.5) return languageStore.t('current.lightRain')
  if (mm <= 7.6) return languageStore.t('current.moderateRain')
  return languageStore.t('current.heavyRain')
})

function precipitationIntensityLabel(mmPerHour: number): string {
  if (mmPerHour <= 0) return languageStore.t('current.dry')
  if (mmPerHour < 0.5) return languageStore.t('current.drizzle')
  if (mmPerHour <= 2.5) return languageStore.t('current.light')
  if (mmPerHour <= 7.6) return languageStore.t('current.moderate')
  return languageStore.t('current.heavy')
}

/** WMO code to show in the rain alert icon (clear-sky or current weather code) */
const rainAlertCode = computed<number>(() => {
  const idx = precipStore.entries.findIndex((e) => e.mmPerHour >= 0.1)
  if (idx === -1) return 0 // clear sky
  return weather.value?.weatherCode ?? 63 // fallback to plain rain
})

/** Intensity hint for the rain alert icon */
const rainAlertIntensity = computed<'light' | 'moderate' | 'heavy' | undefined>(() => {
  const idx = precipStore.entries.findIndex((e) => e.mmPerHour >= 0.1)
  if (idx === -1) return undefined
  const mm = precipStore.entries[idx].mmPerHour
  if (mm < 0.5) return 'light'    // drizzle (> 0 to < 0.5 mm/h)
  if (mm <= 2.5) return 'light'   // light (0.5 to 2.5 mm/h)
  if (mm <= 7.6) return 'moderate' // moderate (2.6 to 7.6 mm/h)
  return 'heavy'                    // heavy (> 7.6 mm/h)
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
  const thresholds = [0.5, 2.5, 7.6]
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
    class="w-full max-w-md"
    aria-busy="true"
    :aria-label="languageStore.t('current.loading')"
  >
    <div class="py-6">
      <!-- Temperature skeleton -->
      <div class="mb-4 flex items-end justify-between">
        <div class="h-20 w-36 animate-pulse rounded-xl bg-slate-200 dark:bg-white/20" />
        <div class="h-12 w-12 animate-pulse rounded-full bg-slate-200 dark:bg-white/20" />
      </div>
      <!-- Description skeleton -->
      <div class="mb-6 h-5 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-white/20" />
      <!-- Stats row skeleton -->
      <div class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-white/20" />
      </div>

      <!-- Divider skeleton -->
      <div class="my-4 h-px w-full animate-pulse rounded bg-slate-100 dark:bg-white/10" />

      <!-- Precipitation skeleton -->
      <div class="mb-3 h-8 animate-pulse rounded-lg bg-slate-200 dark:bg-white/20" />
      <div class="flex items-end gap-0.5">
        <div
          v-for="n in 24"
          :key="n"
          class="h-16 flex-1 animate-pulse rounded-t bg-slate-100 dark:bg-white/10"
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
    class="w-full border border-[#a96f61]/30 bg-[#b97a6a]/18 py-6 dark:border-[#dca293]/20 dark:bg-[#7d4c42]/18"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold">{{ languageStore.t('current.error') }}</p>
        <p class="mt-1 text-sm text-red-600 dark:text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- ------------------------------------------------------------------ -->
  <!-- Weather card                                                          -->
  <!-- ------------------------------------------------------------------ -->
  <div
    v-else-if="weather"
    class="relative w-full transition-all duration-500"
  >
    <!-- Subtle loading bar when refreshing -->
    <div
      v-if="loading"
      class="absolute left-0 top-0 z-10 h-0.5 w-full animate-pulse bg-dutch-orange"
    />

    <div class="relative z-10 py-6">
      <!-- Hero overview -->
      <div class="mb-8 grid gap-6 px-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-10 sm:px-6">
        <div class="min-w-0 sm:self-center">
          <div class="flex items-start gap-1 leading-none">
            <span data-display="true" class="font-display text-[4.5rem] font-medium tracking-[-0.05em] text-dutch-orange sm:text-[4.75rem]">
              {{ temperature }}
            </span>
            <span class="mt-2.5 text-[1.7rem] font-normal text-storm-water-500 dark:text-sea-mist-200/80">°C</span>
          </div>
        </div>

        <div class="min-w-0 sm:self-center">
          <p class="max-w-md text-[10px] text-center uppercase leading-relaxed tracking-[0.15em] text-storm-water-500 dark:text-sea-mist-300/70">
            {{ todayOutlook }}
          </p>
        </div>

        <WeatherIcon
          :code="weather.weatherCode"
          :intensity="currentWeatherIntensity"
          :is-day="weather.isDay"
          :size="78"
          class="shrink-0 self-center justify-self-start transition-all duration-300 sm:justify-self-end"
        />
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-2 border-y border-slate-200 dark:border-slate-800">
        <!-- Feels like -->
        <div
          class="flex flex-col items-center justify-center gap-1 border-b border-r border-slate-200 bg-white px-2 py-5 text-center dark:border-slate-800 dark:bg-slate-950"
        >
          <svg class="size-5 text-storm-water-500 dark:text-sea-mist-300/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z"/>
          </svg>
          <span class="text-xs font-medium uppercase tracking-[0.18em] text-storm-water-500 dark:text-sea-mist-300/65">{{ languageStore.t('current.feelsLike') }}</span>
          <span class="text-[15px] font-semibold text-storm-water-800 dark:text-dune-foam">{{ feelsLike }}°C</span>
          <span
            v-if="todayMaxTemp !== null && todayMinTemp !== null"
            class="text-[11px] text-storm-water-500 dark:text-sea-mist-300/65"
          >
            H {{ todayMaxTemp }}° / L {{ todayMinTemp }}°
          </span>
        </div>

        <!-- Humidity -->
        <div
          class="flex flex-col items-center justify-center gap-1 border-b border-slate-200 bg-white px-2 py-5 text-center dark:border-slate-800 dark:bg-slate-950"
        >
          <svg class="size-5 text-storm-water-500 dark:text-sea-mist-300/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0Z"/>
          </svg>
          <span class="text-xs font-medium uppercase tracking-[0.18em] text-storm-water-500 dark:text-sea-mist-300/65">{{ languageStore.t('current.humidity') }}</span>
          <span class="text-[15px] font-semibold text-storm-water-800 dark:text-dune-foam">{{ weather.humidity }}%</span>
          <span
            v-if="humidityRainDetail"
            class="text-[11px] text-storm-water-500 dark:text-sea-mist-300/65"
          >
            {{ humidityRainDetail }}
          </span>
        </div>

        <!-- Wind -->
        <div
          class="flex flex-col items-center justify-center gap-1 border-r border-slate-200 bg-white px-2 py-5 text-center dark:border-slate-800 dark:bg-slate-950"
        >
          <svg class="size-5 text-storm-water-500 dark:text-sea-mist-300/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
          </svg>
          <span class="text-xs font-medium uppercase tracking-[0.18em] text-storm-water-500 dark:text-sea-mist-300/65">{{ languageStore.t('current.wind') }}</span>
          <span class="text-[15px] font-semibold text-storm-water-800 dark:text-dune-foam">
            {{ Math.round(weather.windSpeed) }}
            <span class="text-xs font-normal text-storm-water-500 dark:text-sea-mist-300/70">km/h</span>
            {{ windCompass }}
          </span>
        </div>

        <!-- Moon phase -->
        <div
          class="flex flex-col items-center justify-center gap-1 bg-white px-2 py-5 text-center dark:bg-slate-950"
        >
          <svg class="size-5 shrink-0" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" v-html="moonPhase.phaseIcon" />
          <span class="text-xs font-medium uppercase tracking-[0.18em] text-storm-water-500 dark:text-sea-mist-300/65">{{ languageStore.t('current.moon') }}</span>
          <span class="text-[15px] font-semibold leading-tight text-storm-water-800 dark:text-dune-foam">{{ languageStore.t(`moon.${moonPhase.phaseKey}`) }}</span>
        </div>
      </div>

      <!-- Sunrise / Sunset tile -->
      <div
        v-if="todaySunrise || todaySunset"
        class="grid grid-cols-2 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      >
        <!-- Sunrise -->
        <div class="flex items-center justify-center gap-2 border-r border-slate-200 px-2 py-5 dark:border-slate-800">
          <!-- Sunrise icon: sun rising above horizon line -->
          <svg class="size-5 shrink-0 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M20 12h2M18.66 4.93l-1.41 1.41"/>
            <path d="M5 17a7 7 0 0 1 14 0"/>
            <line x1="2" y1="20" x2="22" y2="20"/>
          </svg>
          <div class="text-center">
             <p class="text-xs font-medium uppercase tracking-[0.18em] text-storm-water-500 dark:text-sea-mist-300/65">{{ languageStore.t('current.sunrise') }}</p>
            <p class="text-[15px] font-semibold text-storm-water-800 dark:text-dune-foam">{{ todaySunrise }}</p>
          </div>
        </div>

        <!-- Sunset -->
        <div class="flex items-center justify-center gap-2 px-2 py-5">
          <!-- Sunset icon: sun setting below horizon line -->
          <svg class="size-5 shrink-0 text-orange-500 dark:text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 10v2M4.93 4.93l1.41 1.41M2 12h2M20 12h2M18.66 4.93l-1.41 1.41"/>
            <path d="M5 17a7 7 0 0 1 14 0"/>
            <line x1="2" y1="20" x2="22" y2="20"/>
            <path d="M12 6l-1.5 2h3L12 6z" fill="currentColor" stroke="none"/>
          </svg>
          <div class="text-center">
             <p class="text-xs font-medium uppercase tracking-[0.18em] text-storm-water-500 dark:text-sea-mist-300/65">{{ languageStore.t('current.sunset') }}</p>
            <p class="text-[15px] font-semibold text-storm-water-800 dark:text-dune-foam">{{ todaySunset }}</p>
          </div>
        </div>
      </div>

      <!-- Inline error when a refresh fails (but old weather data is still shown) -->
      <p v-if="error" class="mt-3 text-center text-xs text-[#7a5422] dark:text-[#e7c48b]" role="alert">
        ⚠️ {{ languageStore.t('common.refreshFailed') }}
      </p>

      <!-- ---------------------------------------------------------------- -->
      <!-- Precipitation section                                              -->
      <!-- ---------------------------------------------------------------- -->
      <hr class="my-5 hidden border-t border-slate-200 dark:border-slate-800" />

      <!-- Precipitation loading skeleton (weather card already visible) -->
      <template v-if="precipStore.loading && precipStore.entries.length === 0">
        <div
          class="mb-3 h-8 animate-pulse rounded-lg bg-slate-200 dark:bg-white/20"
          aria-busy="true"
          :aria-label="languageStore.t('current.loadingPrecipitation')"
        />
        <div class="flex items-end gap-0.5">
          <div
            v-for="n in 24"
            :key="n"
            class="h-16 flex-1 animate-pulse rounded-t bg-slate-100 dark:bg-white/10"
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
                <div class="border-t border-dashed border-slate-200 dark:border-slate-800" />
              </div>

              <!-- Bar columns -->
              <div class="flex h-full items-end gap-px">
              <div
                v-for="(entry, idx) in precipStore.entries"
                :key="entry.time"
                 class="relative flex-1 rounded-t transition-all duration-300"
                :class="barColorClass(entry.mmPerHour)"
                :style="{ height: `${barHeightPercent(entry.mmPerHour)}%` }"
                :title="entry.mmPerHour > 0
                  ? languageStore.t('current.barTitle', { time: entry.time, amount: entry.mmPerHour.toFixed(2), intensity: precipitationIntensityLabel(entry.mmPerHour) })
                  : languageStore.t('current.barTitleDry', { time: entry.time })"
                :aria-label="languageStore.t('current.barAria', { time: entry.time, amount: entry.mmPerHour.toFixed(2) })"
              >
                <div
                  v-if="idx === precipStore.minutesUntilRain! / 5 && precipStore.isRainExpected"
                  class="absolute inset-x-0 -top-1 mx-auto h-1 w-1 rounded-full bg-dutch-orange"
                />
              </div>
            </div>
            </div>

            <!-- Scale labels (right side) -->
            <div class="relative w-8 shrink-0">
              <span
                v-for="line in gridLines"
                :key="'label-' + line.mmPerHour"
                 class="pointer-events-none absolute right-0 -translate-y-1/2 text-[9px] leading-none text-storm-water-400 dark:text-sea-mist-300/35"
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
                class="text-[10px] leading-tight text-storm-water-600 dark:text-sea-mist-200/60"
              >
                {{ entry.time }}
              </span>
            </div>
            <span class="shrink-0 pl-1 text-[9px] leading-tight text-storm-water-400 dark:text-sea-mist-300/35">mm/u</span>
          </div>
        </div>

        <!-- Alert banner — tappable button to open radar -->
        <button
          class="mt-8 flex w-full items-center gap-3 border-y bg-white px-4 py-4 text-sm font-semibold transition-colors dark:bg-slate-950"
          :class="{
            'border-dutch-orange text-dutch-orange': alertStyle === 'rain' || alertStyle === 'soon',
            'border-slate-200 text-storm-water-800 dark:border-slate-800 dark:text-dune-foam': alertStyle === 'clear',
          }"
          @click="$emit('open-radar')"
        >
          <!-- Icon -->
          <WeatherIcon
            :code="rainAlertCode"
            :intensity="rainAlertIntensity"
            :size="24"
          />

          <!-- Message -->
          <span v-if="alertStyle === 'rain'">{{ languageStore.t('current.fallingNow', { label: rainIntensityLabel }) }}</span>
          <span v-else-if="alertStyle === 'soon'">
            {{ languageStore.t('current.rainInMinutes', { label: rainIntensityLabel, minutes: precipStore.minutesUntilRain! }) }}
          </span>
          <span v-else>{{ languageStore.t('current.noRainNext2Hours') }}</span>

          <!-- Refreshing spinner -->
          <svg
            v-if="precipStore.loading"
            class="ml-auto size-4 animate-spin opacity-60"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            :aria-label="languageStore.t('app.refreshing')"
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
        <p v-if="precipStore.error" class="mt-3 text-center text-xs text-[#7a5422]/90 dark:text-[#e7c48b]/85">
          ⚠️ {{ precipStore.error }}
        </p>
      </template>

      <!-- Precipitation error (no data at all) -->
      <template v-else-if="precipStore.error">
        <div class="flex items-start gap-3 rounded-xl bg-red-500/20 px-4 py-3" role="alert">
          <span class="mt-0.5 text-xl" aria-hidden="true">⚠️</span>
          <div>
             <p class="text-sm font-semibold">{{ languageStore.t('current.precipitationUnavailable') }}</p>
            <p class="mt-0.5 text-xs text-red-600 dark:text-red-200">{{ precipStore.error }}</p>
          </div>
        </div>
      </template>
    </div>
  </div>
  </div>
</template>
