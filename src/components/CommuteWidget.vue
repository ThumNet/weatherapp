<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useCommuteStore } from '@/stores/commute'
import { fetchBikeRoute, calculateBearing, calculateHeadwind } from '@/services/routingService'
import { fetchCurrentWeather } from '@/services/weatherService'
import type { RouteFeature } from '@/services/routingService'
import CommuteLocationSearch from './CommuteLocationSearch.vue'
import CommuteMapRenderer from './CommuteMapRenderer.vue'
import type { CitySearchResult } from '@/types/weather'
import type { CurrentWeather } from '@/types/weather'

const commuteStore = useCommuteStore()
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
        origin.lat, origin.lon,
        destination.lat, destination.lon
      )
      
      const midLat = (origin.lat + destination.lat) / 2
      const midLon = (origin.lon + destination.lon) / 2
      const weather = await fetchCurrentWeather(midLat, midLon)
      midWeather.value = weather
      
      const headwind = calculateHeadwind(weather.windSpeed, weather.windDirection, overallBearing.value)
      headwindComponent.value = headwind
    } else {
      error.value = "Could not find a route."
    }
  } catch (err) {
    error.value = "Error fetching commute data."
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (commuteStore.home && commuteStore.work) {
    void calculateCommute()
  }
})

watch(() => [commuteStore.home, commuteStore.work, isReversed.value], () => {
  void calculateCommute()
}, { deep: true })

function toggleDirection() {
  isReversed.value = !isReversed.value
}

const headwindMsg = computed(() => {
  if (headwindComponent.value === null) return ''
  if (headwindComponent.value > 5) return `Strong Headwind (${headwindComponent.value.toFixed(1)} km/h)`
  if (headwindComponent.value > 0) return `Light Headwind (${headwindComponent.value.toFixed(1)} km/h)`
  if (headwindComponent.value < -5) return `Strong Tailwind (${Math.abs(headwindComponent.value).toFixed(1)} km/h)`
  return `Light Tailwind (${Math.abs(headwindComponent.value).toFixed(1)} km/h)`
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
  <div class="relative w-full border-y border-slate-200 py-6 transition-all duration-500 dark:border-slate-800">
    <div class="px-4 sm:px-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-storm-water-500 dark:text-sea-mist-300">Bike Commute</h2>
        <button 
          @click="isOpen = true"
          class="text-[11px] font-semibold text-dutch-orange uppercase hover:underline"
        >
          {{ commuteStore.home && commuteStore.work ? 'View Map' : 'Set Up' }}
        </button>
      </div>

      <div v-if="loading" class="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-white/20" />
      <div v-else-if="error" class="text-sm text-[#8d4a3f]">{{ error }}</div>
      <div v-else-if="commuteStore.home && commuteStore.work && route" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div class="flex justify-between items-center">
          <div>
            <div class="text-lg font-semibold text-storm-water-800 dark:text-dune-foam">
              {{ (route.distance / 1000).toFixed(1) }} km
            </div>
            <div class="text-xs text-storm-water-500 dark:text-sea-mist-300/70 uppercase tracking-wider">
              ~{{ Math.round(route.duration / 60) }} min
            </div>
          </div>
          <div class="text-right">
            <div class="font-medium text-[13px] text-storm-water-800 dark:text-dune-foam" :class="{'text-red-600 dark:text-red-400': headwindComponent !== null && headwindComponent > 0, 'text-green-600 dark:text-green-400': headwindComponent !== null && headwindComponent <= 0}">
              {{ headwindMsg }}
            </div>
            <button @click.stop="toggleDirection" class="group flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-storm-water-500 hover:text-dutch-orange dark:text-sea-mist-300/70 dark:hover:text-dutch-orange mt-1 ml-auto transition-colors" aria-label="Swap direction">
              <span>{{ isReversed ? 'Work to Home' : 'Home to Work' }}</span>
              <svg class="size-3.5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 14v-12"/><path d="M3 14l4 4 4-4"/><path d="M19 10l-4-4-4 4"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div v-else class="text-sm text-storm-water-500 dark:text-sea-mist-300">
        Set up your commute to see wind conditions.
      </div>
    </div>
    
    <Teleport to="body">
      <Transition name="radar-overlay">
        <div
          v-if="isOpen"
          class="fixed inset-0 z-50 flex flex-col bg-white text-storm-water-800 dark:bg-slate-950 dark:text-slate-50"
        >
          <div class="relative z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 pt-safe dark:border-slate-800 dark:bg-slate-950">
            <div>
              <p class="text-[11px] uppercase tracking-[0.24em] text-storm-water-500 dark:text-sea-mist-300/55">Commute</p>
              <h2 class="text-lg font-semibold text-storm-water-800 dark:text-dune-foam">Bike Route</h2>
            </div>
            <button
              class="flex size-11 items-center justify-center rounded-full bg-slate-100 text-storm-water-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-sea-mist-100 dark:hover:bg-slate-700"
              @click="isOpen = false"
              aria-label="Close"
            >
              <svg class="size-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="flex-1 overflow-auto p-4 flex flex-col gap-4">
            <div class="space-y-4 shrink-0">
              <div>
                <label class="block text-[10px] font-semibold uppercase tracking-wider text-storm-water-500 dark:text-sea-mist-300 mb-1">Home</label>
                <div v-if="commuteStore.home" class="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
                  <span class="text-sm font-medium line-clamp-2 mr-2">{{ commuteStore.home.name }}</span>
                  <button @click="commuteStore.resetCommute()" class="shrink-0 text-red-500 text-xs font-semibold uppercase tracking-wider hover:underline">Clear</button>
                </div>
                <CommuteLocationSearch v-else @select="onSelectHome" />
              </div>
              
              <div>
                <label class="block text-[10px] font-semibold uppercase tracking-wider text-storm-water-500 dark:text-sea-mist-300 mb-1">Work</label>
                <div v-if="commuteStore.work" class="flex justify-between items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
                  <span class="text-sm font-medium line-clamp-2 mr-2">{{ commuteStore.work.name }}</span>
                  <button @click="commuteStore.resetCommute()" class="shrink-0 text-red-500 text-xs font-semibold uppercase tracking-wider hover:underline">Clear</button>
                </div>
                <CommuteLocationSearch v-else @select="onSelectWork" />
              </div>
            </div>
            
            <div v-if="commuteStore.home && commuteStore.work && route" class="flex items-center justify-between px-1">
              <div class="text-sm font-semibold text-storm-water-800 dark:text-dune-foam">
                {{ (route.distance / 1000).toFixed(1) }} km
              </div>
              <button @click="toggleDirection" class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-storm-water-700 shadow-sm transition-colors hover:text-dutch-orange dark:border-slate-700 dark:bg-slate-800 dark:text-sea-mist-100 dark:hover:text-dutch-orange">
                <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 14v-12"/><path d="M3 14l4 4 4-4"/><path d="M19 10l-4-4-4 4"/></svg>
                <span>{{ isReversed ? 'Work to Home' : 'Home to Work' }}</span>
              </button>
              <div class="text-sm font-medium text-storm-water-500 dark:text-sea-mist-300">
                ~{{ Math.round(route.duration / 60) }} min
              </div>
            </div>
            
            <div v-if="commuteStore.home && commuteStore.work" class="flex-1 min-h-[300px] w-full rounded-xl overflow-hidden relative z-0 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
               <CommuteMapRenderer v-if="route" :route="route" :origin="isReversed ? commuteStore.work : commuteStore.home" :destination="isReversed ? commuteStore.home : commuteStore.work" :weather="midWeather" :bearing="overallBearing" />
               <div v-else class="flex h-full items-center justify-center text-storm-water-500 text-sm">
                 <svg class="size-5 animate-spin mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                 Loading map...
               </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.radar-overlay-enter-active,
.radar-overlay-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.radar-overlay-enter-from,
.radar-overlay-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
