<script setup lang="ts">
/**
 * WeatherIconDemo
 *
 * Development-only showcase of all weather icon variants available in the
 * icon system. Rendered at the bottom of App.vue only when
 * `import.meta.env.DEV` is true — stripped from production builds entirely.
 */
import WeatherIcon from '@/components/WeatherIcon.vue'
import type { WeatherIntensity } from '@/utils/weatherCodes'

interface IconEntry {
  /** WMO code to pass to WeatherIcon */
  code: number
  /** Human-readable label shown under the icon */
  label: string
  /** Optional intensity override */
  intensity?: WeatherIntensity
}

interface IconGroup {
  title: string
  icons: IconEntry[]
}

const groups: IconGroup[] = [
  {
    title: 'Sky conditions',
    icons: [
      { code: 0,  label: 'Clear sky' },
      { code: 1,  label: 'Mainly clear' },
      { code: 2,  label: 'Partly cloudy' },
      { code: 3,  label: 'Overcast' },
      { code: 45, label: 'Fog' },
      { code: 48, label: 'Icy fog' },
    ],
  },
  {
    title: 'Drizzle — light → moderate → heavy',
    icons: [
      { code: 51, label: 'Drizzle',  intensity: 'light' },
      { code: 53, label: 'Drizzle',  intensity: 'moderate' },
      { code: 55, label: 'Drizzle',  intensity: 'heavy' },
    ],
  },
  {
    title: 'Rain — light → moderate → heavy',
    icons: [
      { code: 61, label: 'Rain',  intensity: 'light' },
      { code: 63, label: 'Rain',  intensity: 'moderate' },
      { code: 65, label: 'Rain',  intensity: 'heavy' },
    ],
  },
  {
    title: 'Freezing precipitation',
    icons: [
      { code: 56, label: 'Freezing drizzle (light)' },
      { code: 57, label: 'Freezing drizzle (heavy)' },
      { code: 66, label: 'Freezing rain (light)' },
      { code: 67, label: 'Freezing rain (heavy)' },
    ],
  },
  {
    title: 'Rain showers — light → moderate → heavy',
    icons: [
      { code: 80, label: 'Showers',  intensity: 'light' },
      { code: 81, label: 'Showers',  intensity: 'moderate' },
      { code: 82, label: 'Showers',  intensity: 'heavy' },
    ],
  },
  {
    title: 'Snow — light → moderate → heavy',
    icons: [
      { code: 71, label: 'Snow',  intensity: 'light' },
      { code: 73, label: 'Snow',  intensity: 'moderate' },
      { code: 75, label: 'Snow',  intensity: 'heavy' },
      { code: 77, label: 'Snow grains' },
    ],
  },
  {
    title: 'Snow showers — light → heavy',
    icons: [
      { code: 85, label: 'Snow showers',  intensity: 'light' },
      { code: 86, label: 'Snow showers',  intensity: 'heavy' },
    ],
  },
  {
    title: 'Thunderstorms',
    icons: [
      { code: 95, label: 'Thunderstorm' },
      { code: 96, label: 'Thunder + hail' },
      { code: 99, label: 'Thunder + heavy hail' },
    ],
  },
  {
    title: 'Intensity cross-reference — WMO code 63 (Rain)',
    icons: [
      { code: 63, label: 'No hint' },
      { code: 63, label: 'Light',    intensity: 'light' },
      { code: 63, label: 'Moderate', intensity: 'moderate' },
      { code: 63, label: 'Heavy',    intensity: 'heavy' },
    ],
  },
]
</script>

<template>
  <section
    class="mt-2 rounded-2xl border border-dashed border-amber-400/60 bg-amber-50/60 px-4 py-5 dark:border-amber-400/30 dark:bg-amber-900/10"
    aria-label="Weather icon showcase (dev only)"
  >
    <!-- Header -->
    <div class="mb-4 flex items-center gap-2">
      <span class="rounded bg-amber-400 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">
        DEV
      </span>
      <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Weather icon showcase
      </h2>
      <span class="text-xs text-slate-500 dark:text-slate-400">(not shown in production)</span>
    </div>

    <!-- Groups -->
    <div class="flex flex-col gap-6">
      <div
        v-for="group in groups"
        :key="group.title"
      >
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ group.title }}
        </p>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="(entry, idx) in group.icons"
            :key="idx"
            class="flex flex-col items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2.5 shadow-sm dark:bg-white/5"
          >
            <WeatherIcon
              :code="entry.code"
              :intensity="entry.intensity"
              :size="40"
              :label="entry.label"
            />
            <span class="max-w-[80px] text-center text-[10px] leading-tight text-slate-600 dark:text-slate-300">
              {{ entry.label }}
            </span>
            <span
              v-if="entry.intensity"
              class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            >
              {{ entry.intensity }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
