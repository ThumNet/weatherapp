<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useGeolocation } from '@/composables/useGeolocation'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { useLocationStore } from '@/stores/location'
import { useWeatherStore } from '@/stores/weather'
import { usePrecipitationStore } from '@/stores/precipitation'
import { useLanguageStore } from '@/stores/language'
import { useThemeStore } from '@/stores/theme'
import { reverseGeocode } from '@/services/weatherService'
import LocationSearch from '@/components/LocationSearch.vue'
import CurrentWeather from '@/components/CurrentWeather.vue'
import CommuteWidget from '@/components/CommuteWidget.vue'
import HourlyForecast from '@/components/HourlyForecast.vue'
import DailyForecast from '@/components/DailyForecast.vue'
import RadarMap from '@/components/RadarMap.vue'
import WeatherIconDemo from '@/components/WeatherIconDemo.vue'
import WindmillIcon from '@/components/WindmillIcon.vue'

const isDev = import.meta.env.DEV

const locationStore = useLocationStore()
const weatherStore = useWeatherStore()
const precipitationStore = usePrecipitationStore()
const languageStore = useLanguageStore()
const themeStore = useThemeStore()
const { needRefresh, updateServiceWorker } = useRegisterSW()
const { requestPosition, loading: geoLoading, error: geoError } = useGeolocation()
const { isOnline } = useOnlineStatus()

const radarRef = ref<InstanceType<typeof RadarMap> | null>(null)

function openRadar(): void {
  radarRef.value?.openOverlay()
}

// ── Theme toggle — cycles dark → light → system → dark ──────────────────────
const THEME_CYCLE = ['dark', 'light', 'system'] as const
function cycleTheme(): void {
  const idx = THEME_CYCLE.indexOf(themeStore.theme)
  themeStore.setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
}
const themeLabel = computed(() => {
  if (themeStore.theme === 'dark') return languageStore.t('theme.darkToLight')
  if (themeStore.theme === 'light') return languageStore.t('theme.lightToSystem')
  return languageStore.t('theme.systemToDark')
})

const languageLabel = computed(() =>
  languageStore.language === 'nl'
    ? languageStore.t('app.switchLanguage', { language: languageStore.t('app.languageEnglish') })
    : languageStore.t('app.switchLanguage', { language: languageStore.t('app.languageDutch') }),
)

// ── Stale data auto-refresh ──────────────────────────────────────────────────
const STALE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

function isDataStale(): boolean {
  const last = weatherStore.lastUpdated
  if (!last) return true
  return Date.now() - last.getTime() > STALE_THRESHOLD_MS
}

function refreshIfStale(): void {
  if (isDataStale()) {
    void refreshAll()
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    refreshIfStale()
    if (updateServiceWorker) { void updateServiceWorker(true) }
  }
}

// ── Refresh all data for the current location ───────────────────────────────
async function refreshAll(): Promise<void> {
  const lat = locationStore.latitude
  const lon = locationStore.longitude
  await Promise.allSettled([
    weatherStore.fetchWeather(lat, lon),
    precipitationStore.fetchPrecipitation(lat, lon),
  ])
}

// ── Pull-to-refresh ──────────────────────────────────────────────────────────
const { isPulling, isRefreshing, pullProgress } = usePullToRefresh({ onRefresh: refreshAll })

// ── Last-updated timestamp (weather store is authoritative) ──────────────────
const lastUpdatedLabel = computed<string | null>(() => {
  const d = weatherStore.lastUpdated
  if (!d) return null
  return d.toLocaleTimeString(languageStore.locale, { hour: '2-digit', minute: '2-digit' })
})

const isLoading = computed(() => weatherStore.loading || precipitationStore.loading)

const isEditingLocation = ref(false)
const isMenuOpen = ref(false)

onMounted(async () => {
  // Register visibility-change handler to auto-refresh stale data when the
  // user returns to the tab after 30+ minutes away.
  document.addEventListener('visibilitychange', onVisibilityChange)

  // Fetch weather + precipitation for the initial/persisted location immediately
  void weatherStore.fetchWeather(locationStore.latitude, locationStore.longitude)
  void precipitationStore.fetchPrecipitation(locationStore.latitude, locationStore.longitude)

  const position = await requestPosition()

  if (position) {
    // Got a real GPS fix — update coordinates and re-fetch weather + precipitation
    locationStore.updateLocation(position.lat, position.lon)
    void weatherStore.fetchWeather(position.lat, position.lon)
    void precipitationStore.fetchPrecipitation(position.lat, position.lon)
    try {
      const name = await reverseGeocode(position.lat, position.lon)
      locationStore.updateCityName(name)
    } catch {
      // Reverse geocoding failed — keep whatever city name is in the store
    }
  }
  // On failure the store already holds Amsterdam (or last persisted location)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

// Re-fetch weather + precipitation whenever the location changes (e.g. user picks a city)
watch([() => locationStore.latitude, () => locationStore.longitude], ([lat, lon]) => {
  void weatherStore.fetchWeather(lat, lon)
  void precipitationStore.fetchPrecipitation(lat, lon)
})
</script>

<template>
  <div
    class="min-h-dvh bg-white text-storm-water-800 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50"
  >
    <!-- Pull-to-refresh indicator -->
    <Transition name="ptr">
      <div
        v-if="isPulling || isRefreshing"
        class="flex items-center justify-center py-3 text-sm text-storm-water-700 dark:text-sea-mist-200"
        :style="{ opacity: isRefreshing ? 1 : pullProgress }"
      >
        <svg
          class="mr-2 size-5"
          :class="{ 'animate-spin': isRefreshing }"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
          />
        </svg>
        {{
          isRefreshing ? languageStore.t('app.refreshing') : languageStore.t('app.releaseToRefresh')
        }}
      </div>
    </Transition>

    <!-- Offline banner -->
    <Transition name="slide-down">
      <div
        v-if="!isOnline"
        class="flex items-center justify-center gap-2 border-b border-white/30 bg-gradient-to-r from-[#c7924b]/90 via-[#d6aa70]/90 to-[#c68a46]/90 px-4 py-1.5 pt-safe text-center text-sm font-medium text-[#2f2316] backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <svg
          class="size-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        {{ languageStore.t('app.offline') }}
        <template v-if="lastUpdatedLabel"
          >· {{ languageStore.t('app.lastUpdated', { time: lastUpdatedLabel }) }}</template
        >
      </div>
    </Transition>

    <!-- Update available banner -->
    <Transition name="slide-down">
      <div
        v-if="needRefresh"
        class="flex items-center justify-between gap-2 border-b border-white/30 bg-dutch-orange px-4 py-2 pt-safe text-sm font-medium text-white backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-center gap-2">
          <svg
            class="size-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          {{ languageStore.t('app.updateAvailable') || 'New version available' }}
        </div>
        <button
          @click="updateServiceWorker()"
          class="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
        >
          {{ languageStore.t('app.updateNow') || 'Refresh' }}
        </button>
      </div>
    </Transition>

    <!-- Compact header bar — sticky, full-width, with inner centering -->
    <header
      class="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <div class="mx-auto w-full max-w-lg px-4 pt-safe md:max-w-2xl">
        <!-- Header row -->
        <div class="grid grid-cols-[1fr_auto_1fr] items-center py-1.5">
          <!-- Left: Logo -->
          <div class="flex items-center justify-start">
            <span
              class="group flex shrink-0 items-center justify-center pl-2 text-dutch-orange"
              aria-hidden="true"
            >
              <WindmillIcon class="size-16" />
            </span>
          </div>

          <!-- Center: Location -->
          <div class="relative flex min-w-0 items-center justify-center gap-2">
            <template v-if="isEditingLocation">
              <div class="absolute z-50 w-[280px]">
                <LocationSearch
                  @select="isEditingLocation = false"
                  @cancel="isEditingLocation = false"
                />
              </div>
            </template>
            <template v-else-if="geoLoading">
              <svg
                class="size-4 animate-spin text-storm-water-700 dark:text-sea-mist-200"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                :aria-label="languageStore.t('app.detectingLocation')"
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
              <span class="text-sm text-storm-water-700 dark:text-sea-mist-200">{{
                languageStore.t('app.detecting')
              }}</span>
            </template>
            <template v-else>
              <button
                class="group flex min-w-0 flex-col items-center justify-center transition-colors"
                :aria-label="languageStore.t('app.changeLocation')"
                @click="isEditingLocation = !isEditingLocation"
              >
                <span
                  class="block text-[10px] uppercase tracking-[0.24em] text-storm-water-500 transition-colors group-hover:text-dutch-orange dark:text-sea-mist-300/70 dark:group-hover:text-dutch-orange"
                  >{{ languageStore.t('app.forecast') }}</span
                >
                <span
                  class="flex items-center gap-1 truncate text-base font-semibold leading-tight text-storm-water-800 transition-colors group-hover:text-dutch-orange dark:text-dune-foam dark:group-hover:text-dutch-orange"
                >
                  <span class="truncate">{{ locationStore.cityName }}</span>
                  <svg
                    class="size-3.5 opacity-40 transition-opacity group-hover:opacity-100"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </span>
              </button>
            </template>
          </div>

          <!-- Right side: hamburger menu or close search -->
          <div class="relative z-50 flex flex-col items-end justify-center">
            <template v-if="isEditingLocation">
              <button
                class="flex size-10 items-center justify-center text-storm-water-800 transition-colors hover:text-dutch-orange dark:text-slate-50 dark:hover:text-dutch-orange"
                @click="isEditingLocation = false"
                aria-label="Cancel search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </template>
            <template v-else>
              <button
                class="flex size-10 items-center justify-center text-storm-water-800 transition-colors hover:text-dutch-orange dark:text-slate-50 dark:hover:text-dutch-orange"
                @click="isMenuOpen = !isMenuOpen"
                aria-label="Menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <Transition name="fade">
                <div
                  v-if="isMenuOpen"
                  class="absolute right-0 top-full mt-1 flex min-w-[120px] flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-950"
                >
                  <button
                    class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-storm-water-700 transition-colors hover:bg-slate-100 hover:text-dutch-orange dark:text-sea-mist-200 dark:hover:bg-slate-800 dark:hover:text-dutch-orange"
                    :title="languageLabel"
                    @click="languageStore.toggleLanguage(); isMenuOpen = false"
                  >
                    <span class="text-xs uppercase tracking-wider">{{
                      languageStore.language
                    }}</span>
                    <span>{{ languageStore.language === 'nl' ? 'English' : 'Nederlands' }}</span>
                  </button>

                  <button
                    class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-storm-water-700 transition-colors hover:bg-slate-100 hover:text-dutch-orange dark:text-sea-mist-200 dark:hover:bg-slate-800 dark:hover:text-dutch-orange"
                    :title="themeLabel"
                    @click="cycleTheme(); isMenuOpen = false"
                  >
                    <svg
                      v-if="themeStore.theme === 'dark'"
                      class="size-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path
                        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                      />
                    </svg>
                    <svg
                      v-else-if="themeStore.theme === 'light'"
                      class="size-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3c0 5 4 9 9 9 .27 0 .53-.01.79-.05Z" />
                    </svg>
                    <svg
                      v-else
                      class="size-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.52 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 19.4 9c0 .66.39 1.26 1 1.5H21a2 2 0 1 1 0 4h-.09c-.61.24-1.01.84-1.51 1.5Z"
                      />
                    </svg>
                    <span class="capitalize">{{ themeStore.theme }}</span>
                  </button>

                  <button
                    class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-storm-water-700 transition-colors hover:bg-slate-100 hover:text-dutch-orange disabled:opacity-40 dark:text-sea-mist-200 dark:hover:bg-slate-800 dark:hover:text-dutch-orange"
                    :disabled="isLoading"
                    :title="
                      isLoading
                        ? languageStore.t('app.refreshing')
                        : languageStore.t('app.refreshWeatherData')
                    "
                    @click="refreshAll(); isMenuOpen = false"
                  >
                    <svg
                      class="size-4 shrink-0"
                      :class="{ 'animate-spin': isLoading }"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>{{ languageStore.t('app.refreshWeatherData') || 'Refresh' }}</span>
                  </button>
                </div>
              </Transition>

              <Transition name="fade">
                <span
                  v-if="isOnline && lastUpdatedLabel && !isMenuOpen"
                  class="pointer-events-none absolute -bottom-3 right-1 whitespace-nowrap text-[9px] text-storm-water-300/70 dark:text-sea-mist-300/30"
                >
                  {{ languageStore.t('app.lastUpdated', { time: lastUpdatedLabel }) }}
                </span>
              </Transition>
            </template>
          </div>
        </div>

        <!-- Geolocation error notice -->
        <Transition name="fade">
          <p v-if="geoError" class="mt-3 text-xs text-[#7a5422] dark:text-[#e7c48b]">
            {{ geoError }}
          </p>
        </Transition>
      </div>
    </header>

    <!-- Page shell: centred column, mobile-first -->
    <div class="mx-auto w-full max-w-lg px-4 md:max-w-2xl">
      <!-- Main content: each component fills the column width -->
      <main class="mt-7 flex flex-col gap-6 pb-safe md:mt-8 md:gap-7">
        <Transition name="content-fade" appear>
          <CurrentWeather @open-radar="openRadar" />
        </Transition>
        <RadarMap ref="radarRef" />
        <Transition name="content-fade" appear>
          <CommuteWidget />
        </Transition>
        <Transition name="content-fade" appear>
          <HourlyForecast />
        </Transition>
        <Transition name="content-fade" appear>
          <DailyForecast />
        </Transition>
        <WeatherIconDemo v-if="isDev" />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── Offline / pull-to-refresh banner ──────────────────────────────────── */
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
  max-height: 120px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ── Pull-to-refresh spinner ───────────────────────────────────────────── */
.ptr-enter-active,
.ptr-leave-active {
  transition: opacity 0.2s ease;
}

.ptr-enter-from,
.ptr-leave-to {
  opacity: 0;
}

/* ── Subtle fade for inline notices ───────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Content sections fade + slide up on appear ───────────────────────── */
.content-fade-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.content-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
</style>
