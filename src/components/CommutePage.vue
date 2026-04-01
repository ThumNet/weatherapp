<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCommuteStore } from '@/stores/commute'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import LocationSearch from '@/components/LocationSearch.vue'
import CommuteRadarMap from '@/components/CommuteRadarMap.vue'
import type { CitySearchResult } from '@/types/weather'
import type { CommuteEndpoint } from '@/types/commute'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const commuteStore = useCommuteStore()
const { isOnline } = useOnlineStatus()

// ── Local editing flags ────────────────────────────────────────────────────
const isEditingHome = ref(false)
const isEditingWork = ref(false)

// ── Endpoint helpers ───────────────────────────────────────────────────────
function handleHomeSelect(city: CitySearchResult): void {
  const endpoint: CommuteEndpoint = {
    name: city.name,
    position: { lat: city.latitude, lon: city.longitude },
  }
  commuteStore.setHome(endpoint)
  commuteStore.clearRoute()
  isEditingHome.value = false
}

function handleWorkSelect(city: CitySearchResult): void {
  const endpoint: CommuteEndpoint = {
    name: city.name,
    position: { lat: city.latitude, lon: city.longitude },
  }
  commuteStore.setWork(endpoint)
  commuteStore.clearRoute()
  isEditingWork.value = false
}

// ── Route / recommendation actions ─────────────────────────────────────────
async function fetchRoute(): Promise<void> {
  await commuteStore.fetchRoute()
}

async function evaluate(): Promise<void> {
  await commuteStore.evaluateRecommendation()
}

// ── Derived display helpers ────────────────────────────────────────────────
const canFetchRoute = computed(
  () => commuteStore.home !== null && commuteStore.work !== null,
)

const canEvaluate = computed(() => commuteStore.route !== null)

const routeSummary = computed(() => {
  const dist = commuteStore.route?.distanceMetres
  const dur = commuteStore.routeDurationMinutes
  if (dist == null && dur == null) return null
  const parts: string[] = []
  if (dist != null) parts.push(`${(dist / 1000).toFixed(1)} km`)
  if (dur != null) parts.push(`~${dur} min`)
  return parts.join(' · ')
})

const routeLastFetchedLabel = computed(() => {
  const d = commuteStore.routeLastFetched
  if (!d) return null
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
})

const recommendation = computed(() => commuteStore.recommendation)

/** Maps action → { emoji, label, colour classes } */
const actionDisplay = computed(() => {
  const action = recommendation.value?.action
  if (action === 'go')
    return {
      emoji: '🚴',
      label: 'Bike now',
      bg: 'bg-emerald-500/20 dark:bg-emerald-500/30',
      border: 'border-emerald-400/50',
      text: 'text-emerald-700 dark:text-emerald-300',
    }
  if (action === 'wait')
    return {
      emoji: '⏳',
      label: 'Wait a bit',
      bg: 'bg-amber-500/20 dark:bg-amber-500/30',
      border: 'border-amber-400/50',
      text: 'text-amber-700 dark:text-amber-300',
    }
  if (action === 'avoid')
    return {
      emoji: '🌧️',
      label: "Don't bike",
      bg: 'bg-red-500/20 dark:bg-red-500/30',
      border: 'border-red-400/50',
      text: 'text-red-700 dark:text-red-300',
    }
  return null
})

const bestDepartureLabel = computed(() => {
  const dep = recommendation.value?.bestDeparture
  if (!dep) return null
  return dep.departureTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
})

const generatedAtLabel = computed(() => {
  const iso = recommendation.value?.generatedAt
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
})

// ── Map panel ──────────────────────────────────────────────────────────────
/** Show the route-over-radar map whenever a route has been fetched. */
const showMap = computed(() => commuteStore.route !== null)
</script>

<template>
  <!-- Full-screen overlay, same z-layer as RadarMap (z-50) -->
  <div
    class="fixed inset-0 z-50 flex flex-col bg-sky-50 dark:bg-[#0f2027] overflow-y-auto"
    role="dialog"
    aria-modal="true"
    aria-label="Bike commute"
  >
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="sticky top-0 z-10 bg-sky-100/90 dark:bg-[#0f2027]/90 backdrop-blur-md border-b border-slate-300/50 dark:border-white/10">
      <div class="mx-auto w-full max-w-lg px-4 md:max-w-2xl py-3 flex items-center gap-3">
        <span class="text-xl" aria-hidden="true">🚴</span>
        <h1 class="flex-1 text-base font-semibold text-slate-800 dark:text-white">
          Bike Commute
        </h1>
        <button
          class="flex size-9 items-center justify-center rounded-full text-slate-500 dark:text-blue-200/70 transition-colors hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white"
          aria-label="Close commute page"
          @click="emit('close')"
        >
          <svg
            class="size-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- ── Offline banner (sticky, inside header) ──────────────────────── -->
      <div
        v-if="!isOnline"
        class="w-full bg-amber-500/15 border-t border-amber-400/30 px-4 py-2 flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <span class="text-sm" aria-hidden="true">📵</span>
        <p class="text-xs font-medium text-amber-700 dark:text-amber-300">
          You're offline. Route and precipitation data may be from cache.
        </p>
      </div>
    </header>

    <!-- ── Body ──────────────────────────────────────────────────────────── -->
    <div class="mx-auto w-full max-w-lg px-4 md:max-w-2xl py-6 flex flex-col gap-5">

      <!-- ── Endpoints card ────────────────────────────────────────────── -->
      <section
        class="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-3"
        aria-label="Commute endpoints"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-blue-300/70">
          Route endpoints
        </h2>

        <!-- Home endpoint -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="text-base" aria-hidden="true">🏠</span>
            <span class="text-sm font-medium text-slate-700 dark:text-blue-100">Home</span>
            <button
              class="ml-auto text-xs text-blue-600 dark:text-blue-300 hover:underline"
              :aria-label="commuteStore.home ? 'Change home location' : 'Set home location'"
              @click="isEditingHome = !isEditingHome; isEditingWork = false"
            >
              {{ commuteStore.home ? 'Change' : 'Set location' }}
            </button>
            <button
              v-if="commuteStore.home"
              class="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
              aria-label="Clear home location"
              @click="commuteStore.clearHome(); commuteStore.clearRoute()"
            >
              Clear
            </button>
          </div>

          <Transition name="fade">
            <LocationSearch
              v-if="isEditingHome"
              placeholder="Search home location…"
              :on-select="handleHomeSelect"
              @cancel="isEditingHome = false"
            />
          </Transition>

          <p
            v-if="commuteStore.home && !isEditingHome"
            class="text-sm text-slate-600 dark:text-blue-200 pl-7"
          >
            {{ commuteStore.home.name }}
          </p>
          <p
            v-else-if="!commuteStore.home && !isEditingHome"
            class="text-sm text-slate-400 dark:text-slate-500 italic pl-7"
          >
            Not set
          </p>
        </div>

        <div class="border-t border-slate-200/60 dark:border-white/10" />

        <!-- Work endpoint -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="text-base" aria-hidden="true">🏢</span>
            <span class="text-sm font-medium text-slate-700 dark:text-blue-100">Work</span>
            <button
              class="ml-auto text-xs text-blue-600 dark:text-blue-300 hover:underline"
              :aria-label="commuteStore.work ? 'Change work location' : 'Set work location'"
              @click="isEditingWork = !isEditingWork; isEditingHome = false"
            >
              {{ commuteStore.work ? 'Change' : 'Set location' }}
            </button>
            <button
              v-if="commuteStore.work"
              class="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
              aria-label="Clear work location"
              @click="commuteStore.clearWork(); commuteStore.clearRoute()"
            >
              Clear
            </button>
          </div>

          <Transition name="fade">
            <LocationSearch
              v-if="isEditingWork"
              placeholder="Search work location…"
              :on-select="handleWorkSelect"
              @cancel="isEditingWork = false"
            />
          </Transition>

          <p
            v-if="commuteStore.work && !isEditingWork"
            class="text-sm text-slate-600 dark:text-blue-200 pl-7"
          >
            {{ commuteStore.work.name }}
          </p>
          <p
            v-else-if="!commuteStore.work && !isEditingWork"
            class="text-sm text-slate-400 dark:text-slate-500 italic pl-7"
          >
            Not set
          </p>
        </div>
      </section>

      <!-- ── Route card ─────────────────────────────────────────────────── -->
      <section
        class="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-3"
        aria-label="Route"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-blue-300/70">
          Cycling route
        </h2>

        <!-- Route data when loaded -->
        <template v-if="commuteStore.route">
          <div class="flex items-center gap-3">
            <span class="text-base" aria-hidden="true">🗺️</span>
            <div class="flex-1">
              <p class="text-sm font-medium text-slate-700 dark:text-blue-100">
                {{ commuteStore.route.name }}
              </p>
              <p v-if="routeSummary" class="text-xs text-slate-500 dark:text-blue-300/70 mt-0.5">
                {{ routeSummary }}
              </p>
              <!-- Last-fetched timestamp -->
              <p v-if="routeLastFetchedLabel" class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Fetched at {{ routeLastFetchedLabel }}
              </p>
            </div>
            <button
              class="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
              aria-label="Clear route"
              @click="commuteStore.clearRoute()"
            >
              Clear
            </button>
          </div>

          <!-- Stale route warning -->
          <div
            v-if="commuteStore.isRouteStale"
            class="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2"
            role="status"
          >
            <span class="text-sm mt-0.5" aria-hidden="true">⚠️</span>
            <p class="text-xs text-amber-700 dark:text-amber-300 leading-snug">
              This route was fetched more than 24 hours ago. Re-fetch to confirm it's still current.
            </p>
          </div>
        </template>

        <!-- No route yet -->
        <p v-else class="text-sm text-slate-400 dark:text-slate-500 italic">
          No route fetched yet.
        </p>

        <!-- Route error -->
        <div
          v-if="commuteStore.routeError"
          class="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2"
          role="alert"
        >
          <span class="text-sm mt-0.5" aria-hidden="true">{{ isOnline ? '❌' : '📵' }}</span>
          <p class="text-xs text-red-600 dark:text-red-400 leading-snug">
            <template v-if="!isOnline">Offline — </template>{{ commuteStore.routeError }}
          </p>
        </div>

        <!-- Fetch route button -->
        <button
          :disabled="!canFetchRoute || commuteStore.routeLoading"
          class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :class="
            canFetchRoute
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-400'
              : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
          "
          @click="fetchRoute"
        >
          <svg
            v-if="commuteStore.routeLoading"
            class="size-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{{ commuteStore.routeLoading ? 'Fetching route…' : (commuteStore.route ? 'Re-fetch route' : 'Fetch route') }}</span>
        </button>

        <p v-if="!canFetchRoute" class="text-xs text-slate-400 dark:text-slate-500 text-center">
          Set both home and work locations first.
        </p>
      </section>

      <!-- ── Route map (visible once a route is loaded) ──────────────────── -->
      <Transition name="fade">
        <section
          v-if="showMap"
          aria-label="Route radar map"
        >
          <CommuteRadarMap />
        </section>
      </Transition>

      <!-- ── Recommendation card ─────────────────────────────────────────── -->
      <section
        class="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 flex flex-col gap-3"
        aria-label="Commute recommendation"
      >
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-blue-300/70">
          Recommendation
        </h2>

        <!-- Result -->
        <template v-if="recommendation">
          <!-- Action badge -->
          <div
            v-if="actionDisplay"
            class="flex items-center gap-3 rounded-xl border p-3"
            :class="[actionDisplay.bg, actionDisplay.border]"
            role="status"
          >
            <span class="text-2xl leading-none" aria-hidden="true">{{ actionDisplay.emoji }}</span>
            <span class="text-lg font-bold" :class="actionDisplay.text">
              {{ actionDisplay.label }}
            </span>
          </div>

          <!-- Best departure (only meaningful for 'wait') -->
          <div
            v-if="recommendation.action === 'wait' && bestDepartureLabel"
            class="flex items-center gap-2 text-sm text-slate-600 dark:text-blue-200"
          >
            <span aria-hidden="true">⏰</span>
            <span>Best departure: <strong>{{ bestDepartureLabel }}</strong></span>
          </div>

          <!-- Explanation text -->
          <p class="text-sm text-slate-600 dark:text-blue-200 leading-relaxed">
            {{ recommendation.explanation }}
          </p>

          <!-- Stale recommendation warning -->
          <div
            v-if="commuteStore.isRecommendationStale"
            class="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2"
            role="status"
          >
            <span class="text-sm mt-0.5" aria-hidden="true">⚠️</span>
            <p class="text-xs text-amber-700 dark:text-amber-300 leading-snug">
              This recommendation is over 30 minutes old. Re-evaluate for current conditions.
            </p>
          </div>

          <!-- Generated-at footnote -->
          <p v-if="generatedAtLabel" class="text-xs text-slate-400 dark:text-slate-500">
            Evaluated at {{ generatedAtLabel }}
          </p>
        </template>

        <!-- Not yet evaluated -->
        <p v-else-if="!commuteStore.recommendationLoading" class="text-sm text-slate-400 dark:text-slate-500 italic">
          No recommendation yet.
          <template v-if="!canEvaluate"> Fetch a route first.</template>
        </p>

        <!-- Recommendation error -->
        <div
          v-if="commuteStore.recommendationError"
          class="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2"
          role="alert"
        >
          <span class="text-sm mt-0.5" aria-hidden="true">{{ isOnline ? '❌' : '📵' }}</span>
          <p class="text-xs text-red-600 dark:text-red-400 leading-snug">
            <template v-if="!isOnline">Offline — </template>{{ commuteStore.recommendationError }}
          </p>
        </div>

        <!-- Evaluate button -->
        <button
          :disabled="!canEvaluate || commuteStore.recommendationLoading"
          class="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :class="
            canEvaluate
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-400'
              : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
          "
          @click="evaluate"
        >
          <svg
            v-if="commuteStore.recommendationLoading"
            class="size-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>
            {{
              commuteStore.recommendationLoading
                ? 'Evaluating…'
                : recommendation
                ? 'Re-evaluate'
                : 'Check commute conditions'
            }}
          </span>
        </button>
      </section>

      <!-- ── Reset all ──────────────────────────────────────────────────── -->
      <button
        class="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 self-center py-1"
        @click="commuteStore.clearAll()"
      >
        Reset all commute data
      </button>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
