<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useCommuteStore } from '@/stores/commute'
import { useLanguageStore } from '@/stores/language'
import { fetchBikeRoute, calculateBearing, calculateHeadwind } from '@/services/routingService'
import { fetchCurrentWeather } from '@/services/weatherService'
import type { RouteFeature } from '@/services/routingService'
import CommuteLocationSearch from './CommuteLocationSearch.vue'
import CommuteMapRenderer from './CommuteMapRenderer.vue'
import FullScreenModal from './FullScreenModal.vue'
import WidgetContainer from '@/components/WidgetContainer.vue'
import WidgetHeader from '@/components/WidgetHeader.vue'
import WidgetError from '@/components/WidgetError.vue'
import type { CitySearchResult } from '@/types/weather'
import type { CurrentWeather } from '@/types/weather'

const commuteStore = useCommuteStore()
const languageStore = useLanguageStore()
const isOpen = ref(false)
const isReversed = ref(false)

const route = ref<RouteFeature | null>(null)
const headwindComponent = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const midWeather = ref<CurrentWeather | null>(null)
const overallBearing = ref<number>(0)

async function calculateCommute() {
  if (!commuteStore.home || !commuteStore.work) {
    route.value = null
    headwindComponent.value = null
    midWeather.value = null
    return
  }

  loading.value = true
  error.value = null
  try {
    const origin = isReversed.value ? commuteStore.work : commuteStore.home
    const destination = isReversed.value ? commuteStore.home : commuteStore.work

    const routeData = await fetchBikeRoute(origin, destination)
    if (routeData) {
      route.value = routeData

      overallBearing.value = calculateBearing(
        origin.lat,
        origin.lon,
        destination.lat,
        destination.lon,
      )

      const midLat = (origin.lat + destination.lat) / 2
      const midLon = (origin.lon + destination.lon) / 2
      const weather = await fetchCurrentWeather(midLat, midLon)
      midWeather.value = weather

      const headwind = calculateHeadwind(
        weather.windSpeed,
        weather.windDirection,
        overallBearing.value,
      )
      headwindComponent.value = headwind
    } else {
      error.value = languageStore.t('commute.errorNoRoute')
    }
  } catch (err) {
    error.value = languageStore.t('commute.errorFetching')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (commuteStore.home && commuteStore.work) {
    void calculateCommute()
  }
})

watch(
  () => [commuteStore.home, commuteStore.work, isReversed.value],
  () => {
    void calculateCommute()
  },
  { deep: true },
)

function toggleDirection() {
  isReversed.value = !isReversed.value
}

const headwindMsg = computed(() => {
  if (headwindComponent.value === null) return ''
  const speed = Math.abs(headwindComponent.value).toFixed(1)
  if (headwindComponent.value > 5) return languageStore.t('commute.strongHeadwind', { speed })
  if (headwindComponent.value > 0) return languageStore.t('commute.lightHeadwind', { speed })
  if (headwindComponent.value < -5) return languageStore.t('commute.strongTailwind', { speed })
  return languageStore.t('commute.lightTailwind', { speed })
})

const onSelectHome = (c: AddressSearchResult) => {
  const address = c.subtitle || c.name
  commuteStore.setHome(c.latitude, c.longitude, address)
}

const onSelectWork = (c: AddressSearchResult) => {
  const address = c.subtitle || c.name
  commuteStore.setWork(c.latitude, c.longitude, address)
}
</script>

<template>
  <WidgetContainer>
    <WidgetHeader :title="languageStore.t('commute.title')">
      <button
        @click="isOpen = true"
        class="text-[11px] font-semibold uppercase tracking-wider text-dutch-orange hover:underline"
      >
        {{
          commuteStore.home && commuteStore.work
            ? languageStore.t('commute.viewMap')
            : languageStore.t('commute.setUp')
        }}
      </button>
    </WidgetHeader>

    <div
      v-if="loading"
      class="h-16 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-white/20"
    />

    <WidgetError
      v-else-if="error"
      :title="languageStore.t('commute.errorFetching')"
      :error="error"
    />

    <div
      v-if="loading"
      class="h-16 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-white/20"
    />

    <div
      v-else-if="error"
      class="bg-[#b97a6a]/18 dark:bg-[#7d4c42]/18 w-full border border-[#a96f61]/30 p-5 dark:border-[#dca293]/20"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <span class="mt-0.5 text-xl" aria-hidden="true">⚠️</span>
        <div>
          <p class="text-sm font-semibold">{{ languageStore.t('commute.errorFetching') }}</p>
          <p class="mt-1 text-xs text-red-600 dark:text-red-200">{{ error }}</p>
        </div>
      </div>
    </div>

    <div
      v-else-if="commuteStore.home && commuteStore.work && route"
      class="flex min-h-[52px] items-center justify-between"
    >
      <div class="flex flex-col">
        <span class="text-base font-semibold text-storm-water-800 dark:text-dune-foam">
          {{ (route.distance / 1000).toFixed(1) }} {{ languageStore.t('commute.km') }}
        </span>
        <span class="text-xs text-storm-water-400 dark:text-sea-mist-300/55">
          ~{{ Math.round(route.duration / 60) }} {{ languageStore.t('commute.min') }}
        </span>
      </div>

      <div class="flex flex-col items-end gap-0.5 text-right">
        <div
          class="text-sm font-medium"
          :class="{
            'text-red-600 dark:text-red-400': headwindComponent !== null && headwindComponent > 0,
            'text-green-600 dark:text-green-400':
              headwindComponent !== null && headwindComponent <= 0,
          }"
        >
          {{ headwindMsg }}
        </div>
        <button
          @click.stop="toggleDirection"
          class="group mt-0.5 flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.1em] text-storm-water-500 transition-colors hover:text-dutch-orange dark:text-sea-mist-300/70 dark:hover:text-dutch-orange"
          aria-label="Swap direction"
        >
          <span>{{
            isReversed
              ? languageStore.t('commute.workToHome')
              : languageStore.t('commute.homeToWork')
          }}</span>
          <svg
            class="size-3.5 transition-transform group-hover:scale-110"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M7 10v12" />
            <path d="M15 14v-12" />
            <path d="M3 14l4 4 4-4" />
            <path d="M19 10l-4-4-4 4" />
          </svg>
        </button>
      </div>
    </div>

    <div v-else class="py-2 text-sm text-storm-water-500 dark:text-sea-mist-300/80">
      {{ languageStore.t('commute.setupPrompt') }}
    </div>
  </WidgetContainer>

  <FullScreenModal
    :is-open="isOpen"
    :title="languageStore.t('commute.dialogSubtitle')"
    :subtitle="languageStore.t('commute.dialogTitle')"
    @close="isOpen = false"
  >
    <div class="flex flex-1 flex-col gap-4 overflow-auto p-4">
      <div class="shrink-0 space-y-4">
        <div>
          <label
            class="mb-1.5 ml-1 block text-[10px] font-semibold uppercase tracking-wider text-storm-water-500 dark:text-sea-mist-300"
            >{{ languageStore.t('commute.home') }}</label
          >
          <div
            v-if="commuteStore.home"
            class="flex items-center justify-between rounded-full border border-slate-200 bg-slate-50 px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              class="mr-2 line-clamp-1 text-sm font-medium text-storm-water-800 dark:text-dune-foam"
              >{{ commuteStore.home.name }}</span
            >
            <button
              @click="commuteStore.clearHome()"
              class="shrink-0 text-storm-water-400 transition-colors hover:text-red-500 dark:text-sea-mist-300/70 dark:hover:text-red-400"
              aria-label="Clear"
            >
              <svg
                class="size-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <CommuteLocationSearch v-else @select="onSelectHome" />
        </div>

        <div>
          <label
            class="mb-1.5 ml-1 block text-[10px] font-semibold uppercase tracking-wider text-storm-water-500 dark:text-sea-mist-300"
            >{{ languageStore.t('commute.work') }}</label
          >
          <div
            v-if="commuteStore.work"
            class="flex items-center justify-between rounded-full border border-slate-200 bg-slate-50 px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              class="mr-2 line-clamp-1 text-sm font-medium text-storm-water-800 dark:text-dune-foam"
              >{{ commuteStore.work.name }}</span
            >
            <button
              @click="commuteStore.clearWork()"
              class="shrink-0 text-storm-water-400 transition-colors hover:text-red-500 dark:text-sea-mist-300/70 dark:hover:text-red-400"
              aria-label="Clear"
            >
              <svg
                class="size-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <CommuteLocationSearch v-else @select="onSelectWork" />
        </div>
      </div>

      <div
        v-if="commuteStore.home && commuteStore.work && route"
        class="flex items-center justify-between px-1"
      >
        <div class="text-sm font-semibold text-storm-water-800 dark:text-dune-foam">
          {{ (route.distance / 1000).toFixed(1) }} {{ languageStore.t('commute.km') }}
        </div>
        <button
          @click="toggleDirection"
          class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-storm-water-700 shadow-sm transition-colors hover:text-dutch-orange dark:border-slate-700 dark:bg-slate-800 dark:text-sea-mist-100 dark:hover:text-dutch-orange"
        >
          <svg
            class="size-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M7 10v12" />
            <path d="M15 14v-12" />
            <path d="M3 14l4 4 4-4" />
            <path d="M19 10l-4-4-4 4" />
          </svg>
          <span>{{
            isReversed
              ? languageStore.t('commute.workToHome')
              : languageStore.t('commute.homeToWork')
          }}</span>
        </button>
        <div class="text-sm font-medium text-storm-water-500 dark:text-sea-mist-300">
          ~{{ Math.round(route.duration / 60) }} {{ languageStore.t('commute.min') }}
        </div>
      </div>

      <div
        v-if="commuteStore.home && commuteStore.work"
        class="relative z-0 min-h-[300px] w-full flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
      >
        <CommuteMapRenderer
          v-if="route"
          :route="route"
          :origin="isReversed ? commuteStore.work : commuteStore.home"
          :destination="isReversed ? commuteStore.home : commuteStore.work"
          :weather="midWeather"
          :bearing="overallBearing"
        />
        <div v-else class="flex h-full items-center justify-center text-sm text-storm-water-500">
          <svg class="mr-2 size-5 animate-spin" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
              fill="none"
            />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {{ languageStore.t('commute.loadingMap') }}
        </div>
      </div>
    </div>
  </FullScreenModal>
</template>
