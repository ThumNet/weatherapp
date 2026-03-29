<script setup lang="ts">
import { computed } from 'vue'
import { usePrecipitationStore } from '@/stores/precipitation'

const store = usePrecipitationStore()

/**
 * Bar height as a percentage of the card's inner height (4–100 %).
 * We clamp the minimum to 4 % so zero-rain bars are still visible as a thin
 * line rather than disappearing entirely.
 */
function barHeightPercent(mmPerHour: number): number {
  const max = store.maxIntensity
  if (max <= 0) return 4
  return Math.max(4, (mmPerHour / max) * 100)
}

/** Show every Nth label to avoid crowding (Buienradar gives 24 × 5-min entries) */
const labelInterval = computed<number>(() => {
  const count = store.entries.length
  if (count <= 12) return 2
  if (count <= 20) return 4
  return 6
})

const alertStyle = computed<'rain' | 'soon' | 'clear'>(() => {
  const mins = store.minutesUntilRain
  if (mins === null) return 'clear'
  if (mins === 0) return 'rain'
  return 'soon'
})
</script>

<template>
  <!-- Loading skeleton -->
  <div
    v-if="store.loading && store.entries.length === 0"
    class="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-md dark:bg-white/5"
    aria-busy="true"
    aria-label="Loading precipitation data"
  >
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

  <!-- Main card -->
  <div
    v-else-if="store.entries.length > 0"
    class="w-full max-w-md rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 via-white/10 to-white/5 p-5 shadow-xl backdrop-blur-md dark:from-slate-700/30 dark:via-slate-800/20 dark:to-slate-900/10"
  >
    <!-- Alert banner -->
    <div
      class="mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-inner transition-colors"
      :class="{
        'bg-blue-500/70 text-white': alertStyle === 'rain',
        'bg-yellow-400/80 text-yellow-900': alertStyle === 'soon',
        'bg-green-500/60 text-white': alertStyle === 'clear',
      }"
    >
      <!-- Icon -->
      <span class="text-xl leading-none">
        {{ alertStyle === 'clear' ? '☀️' : '🌧️' }}
      </span>

      <!-- Message -->
      <span v-if="alertStyle === 'rain'">Rain is falling now</span>
      <span v-else-if="alertStyle === 'soon'">
        Rain in {{ store.minutesUntilRain }} minute{{
          store.minutesUntilRain === 1 ? '' : 's'
        }}
      </span>
      <span v-else>No rain expected for the next 2 hours</span>

      <!-- Refreshing spinner overlay -->
      <svg
        v-if="store.loading"
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
    </div>

    <!-- Bar chart -->
    <div class="relative">
      <!-- Bars -->
      <div class="flex h-20 items-end gap-px">
        <div
          v-for="(entry, idx) in store.entries"
          :key="entry.time"
          class="relative flex-1 rounded-t transition-all duration-300"
          :class="
            entry.mmPerHour > 0
              ? 'bg-blue-400/80 dark:bg-blue-400/70'
              : 'bg-white/15 dark:bg-white/10'
          "
          :style="{ height: `${barHeightPercent(entry.mmPerHour)}%` }"
          :title="`${entry.time} — ${entry.mmPerHour > 0 ? entry.mmPerHour.toFixed(2) + ' mm/h' : 'dry'}`"
          :aria-label="`${entry.time}: ${entry.mmPerHour.toFixed(2)} mm/h`"
        >
          <!-- Highlight the first rainy bar -->
          <div
            v-if="idx === store.minutesUntilRain! / 5 && store.isRainExpected"
            class="absolute inset-x-0 -top-1 mx-auto h-1 w-1 rounded-full bg-yellow-300"
          />
        </div>
      </div>

      <!-- Time axis labels -->
      <div class="mt-1 flex items-start gap-px">
        <div
          v-for="(entry, idx) in store.entries"
          :key="entry.time + '-label'"
          class="flex-1 truncate text-center"
        >
          <span
            v-if="idx % labelInterval === 0"
            class="text-[10px] leading-tight text-slate-600 dark:text-blue-200/60"
          >
            {{ entry.time }}
          </span>
        </div>
      </div>
    </div>

    <!-- Error notice (non-blocking) -->
    <p v-if="store.error" class="mt-3 text-center text-xs text-yellow-300/80">
      ⚠️ {{ store.error }}
    </p>
  </div>

  <!-- Error state (no data at all) -->
  <div
    v-else-if="store.error"
    class="w-full max-w-md rounded-2xl border border-red-400/30 bg-red-500/20 p-5 shadow-xl backdrop-blur-md"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold text-white">Precipitation data unavailable</p>
        <p class="mt-1 text-sm text-red-200">{{ store.error }}</p>
      </div>
    </div>
  </div>
</template>
