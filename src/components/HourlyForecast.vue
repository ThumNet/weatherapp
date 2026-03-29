<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Chart } from 'vue-chartjs'
import { useWeatherStore } from '@/stores/weather'
import { getWeatherIcon } from '@/utils/weatherCodes'

// Register all required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const weatherStore = useWeatherStore()

const forecast = computed(() => weatherStore.hourlyForecast)
const loading = computed(() => weatherStore.loading)
const error = computed(() => weatherStore.error)

/** Format an ISO time string like "2024-01-15T14:00" → "14:00" */
function formatHour(isoTime: string): string {
  const parts = isoTime.split('T')
  return parts[1]?.slice(0, 5) ?? isoTime
}

/** Show a weather icon every 3 hours to avoid crowding */
const iconLabels = computed(() => {
  if (!forecast.value) return []
  return forecast.value.time.map((_, i) => {
    if (i % 3 === 0) return getWeatherIcon(forecast.value!.weatherCode[i] ?? 0)
    return ''
  })
})

const labels = computed(() => forecast.value?.time.map(formatHour) ?? [])

// ---------------------------------------------------------------------------
// Chart data & options
// ---------------------------------------------------------------------------

const chartData = computed<ChartData<'bar' | 'line'>>(() => ({
  labels: labels.value,
  datasets: [
    {
      type: 'line' as const,
      label: 'Temperature (°C)',
      data: forecast.value?.temperature ?? [],
      borderColor: 'rgba(96, 165, 250, 1)',      // blue-400
      backgroundColor: 'rgba(96, 165, 250, 0.15)',
      pointBackgroundColor: 'rgba(96, 165, 250, 1)',
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      yAxisID: 'yTemp',
      order: 1,
    },
    {
      type: 'bar' as const,
      label: 'Precipitation (mm)',
      data: forecast.value?.precipitation ?? [],
      backgroundColor: 'rgba(147, 197, 253, 0.5)',  // blue-300 / 50%
      borderColor: 'rgba(147, 197, 253, 0.8)',
      borderWidth: 1,
      borderRadius: 3,
      yAxisID: 'yPrecip',
      order: 2,
    },
  ],
}))

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: 'rgba(255,255,255,0.75)',
        font: { size: 11 },
        boxWidth: 12,
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      titleColor: 'rgba(255,255,255,0.9)',
      bodyColor: 'rgba(255,255,255,0.75)',
      borderColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        afterTitle(items) {
          const idx = items[0]?.dataIndex ?? 0
          const icon = iconLabels.value[idx]
          return icon ? icon : ''
        },
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: 'rgba(255,255,255,0.65)',
        font: { size: 11 },
        maxRotation: 0,
      },
      grid: {
        color: 'rgba(255,255,255,0.08)',
      },
      border: { color: 'rgba(255,255,255,0.1)' },
    },
    yTemp: {
      type: 'linear',
      position: 'left',
      ticks: {
        color: 'rgba(255,255,255,0.65)',
        font: { size: 11 },
        callback: (value) => `${value}°`,
      },
      grid: {
        color: 'rgba(255,255,255,0.08)',
      },
      border: { color: 'rgba(255,255,255,0.1)' },
    },
    yPrecip: {
      type: 'linear',
      position: 'right',
      min: 0,
      ticks: {
        color: 'rgba(147,197,253,0.65)',
        font: { size: 11 },
        callback: (value) => `${value}mm`,
      },
      grid: {
        drawOnChartArea: false,
      },
      border: { color: 'rgba(255,255,255,0.1)' },
    },
  },
}))
</script>

<template>
  <div>
  <!-- -------------------------------------------------------------------- -->
  <!-- Loading skeleton                                                        -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-if="loading && !forecast"
    class="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md"
    aria-busy="true"
    aria-label="Loading hourly forecast"
  >
    <div class="p-5">
      <div class="mb-4 h-4 w-36 animate-pulse rounded-lg bg-white/20" />
      <!-- Icon row skeleton -->
      <div class="mb-3 flex justify-between gap-2 px-1">
        <div v-for="n in 8" :key="n" class="h-6 w-6 animate-pulse rounded-full bg-white/20" />
      </div>
      <div class="h-52 animate-pulse rounded-xl bg-white/20" />
    </div>
  </div>

  <!-- -------------------------------------------------------------------- -->
  <!-- Error state                                                             -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-else-if="error && !forecast"
    class="w-full max-w-md overflow-hidden rounded-3xl border border-red-400/30 bg-red-500/20 p-6 shadow-2xl backdrop-blur-md"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-2xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="font-semibold text-white">Could not load hourly forecast</p>
        <p class="mt-1 text-sm text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- -------------------------------------------------------------------- -->
  <!-- Forecast card                                                           -->
  <!-- -------------------------------------------------------------------- -->
  <div
    v-else-if="forecast"
    class="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/20 via-white/10 to-white/5 shadow-2xl backdrop-blur-md transition-all duration-500 dark:from-slate-700/40 dark:via-slate-800/30 dark:to-slate-900/20"
  >
    <!-- Subtle loading bar when refreshing -->
    <div
      v-if="loading"
      class="h-0.5 w-full animate-pulse bg-gradient-to-r from-transparent via-white/60 to-transparent"
    />

    <div class="p-5">
      <!-- Section title -->
      <h2 class="mb-1 text-sm font-semibold uppercase tracking-widest text-white/60">
        24-Hour Forecast
      </h2>

      <!-- Weather icons row (every 3 hours) -->
      <div class="mb-3 flex justify-between px-1" aria-hidden="true">
        <template v-for="(icon, i) in iconLabels" :key="i">
          <span
            v-if="icon"
            class="flex-1 text-center text-lg leading-none"
            :title="labels[i]"
          >{{ icon }}</span>
        </template>
      </div>

      <!-- Horizontally scrollable chart wrapper -->
      <div class="overflow-x-auto">
        <!-- min-w ensures 24 bars are readable on mobile; chart fills available width otherwise -->
        <div class="relative h-52 min-w-[480px]">
          <Chart
            type="bar"
            :data="(chartData as any)"
            :options="(chartOptions as any)"
          />
        </div>
      </div>

      <!-- Precip probability legend row -->
      <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
        <div
          v-for="(prob, i) in forecast.precipitationProbability"
          :key="i"
          class="flex min-w-[2.5rem] flex-col items-center gap-0.5"
        >
          <span class="text-[10px] leading-none text-blue-200">{{ prob }}%</span>
          <span class="text-[10px] leading-none text-white/40">{{ labels[i] }}</span>
        </div>
      </div>

      <!-- Inline error when refresh fails but old data is shown -->
      <p v-if="error" class="mt-3 text-center text-xs text-yellow-300" role="alert">
        ⚠️ Refresh failed — showing last known data
      </p>
    </div>
  </div>
  </div>
</template>
