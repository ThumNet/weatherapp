<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import { useLocationStore } from '@/stores/location'
import { fetchRadarFrames, buildRadarTileUrl, formatFrameTime } from '@/services/rainviewerService'
import type { RadarFrame } from '@/services/rainviewerService'

// ---------------------------------------------------------------------------
// Fix Leaflet default marker icons broken by bundlers
// ---------------------------------------------------------------------------
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

// ---------------------------------------------------------------------------
// Store & reactive state
// ---------------------------------------------------------------------------
const locationStore = useLocationStore()

const mapCenter = computed<[number, number]>(() => [
  locationStore.latitude,
  locationStore.longitude,
])

const zoom = ref(8)

// Radar frames state
const radarHost = ref('')
const frames = ref<RadarFrame[]>([])
const currentFrameIndex = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const isPlaying = ref(false)
const animationTimer = ref<ReturnType<typeof setInterval> | null>(null)

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------
const currentFrame = computed<RadarFrame | null>(() => frames.value[currentFrameIndex.value] ?? null)

const currentTileUrl = computed<string>(() => {
  if (!currentFrame.value || !radarHost.value) return ''
  return buildRadarTileUrl(radarHost.value, currentFrame.value.path)
})

const currentTimeLabel = computed<string>(() => {
  if (!currentFrame.value) return ''
  const isNowcast = currentFrameIndex.value >= frames.value.findIndex(
    (_, i) => i > 0 && frames.value[i].time > frames.value[i - 1].time + 600,
  )
  const timeStr = formatFrameTime(currentFrame.value.time)
  // Mark nowcast frames (future) with an indicator
  const nowcastStart = frames.value.findIndex((f) => {
    const prevIdx = frames.value.indexOf(f) - 1
    return prevIdx >= 0 && f.time - frames.value[prevIdx].time > 600
  })
  const label = isNowcast && nowcastStart !== -1 && currentFrameIndex.value >= nowcastStart
    ? `${timeStr} (forecast)`
    : timeStr
  return label
})

const frameCount = computed(() => frames.value.length)

// ---------------------------------------------------------------------------
// Load radar frames
// ---------------------------------------------------------------------------
async function loadFrames(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchRadarFrames()
    radarHost.value = result.host
    frames.value = result.frames
    // Start at the latest past frame (last item before nowcast, or last overall)
    currentFrameIndex.value = Math.max(0, result.frames.length - 1)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load radar data'
  } finally {
    loading.value = false
  }
}

// ---------------------------------------------------------------------------
// Animation controls
// ---------------------------------------------------------------------------
function stopAnimation(): void {
  if (animationTimer.value !== null) {
    clearInterval(animationTimer.value)
    animationTimer.value = null
  }
  isPlaying.value = false
}

function startAnimation(): void {
  if (frames.value.length === 0) return
  isPlaying.value = true
  animationTimer.value = setInterval(() => {
    currentFrameIndex.value = (currentFrameIndex.value + 1) % frames.value.length
  }, 500)
}

function togglePlay(): void {
  if (isPlaying.value) {
    stopAnimation()
  } else {
    // Start from beginning if at the end
    if (currentFrameIndex.value >= frames.value.length - 1) {
      currentFrameIndex.value = 0
    }
    startAnimation()
  }
}

function stepBack(): void {
  stopAnimation()
  currentFrameIndex.value = Math.max(0, currentFrameIndex.value - 1)
}

function stepForward(): void {
  stopAnimation()
  currentFrameIndex.value = Math.min(frames.value.length - 1, currentFrameIndex.value + 1)
}

function onSliderInput(event: Event): void {
  stopAnimation()
  currentFrameIndex.value = parseInt((event.target as HTMLInputElement).value, 10)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(() => {
  void loadFrames()
})

onUnmounted(() => {
  stopAnimation()
})

// Stop animation when user changes location (map re-centers)
watch(mapCenter, () => {
  // No need to reload frames — radar is global
})
</script>

<template>
  <div
    class="w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md dark:bg-white/5"
  >
    <!-- Card header -->
    <div class="flex items-center justify-between px-5 pb-2 pt-4">
      <div class="flex items-center gap-2">
        <span class="text-lg" aria-hidden="true">🌧️</span>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-white/80">Rain Radar</h2>
      </div>
      <!-- Time label -->
      <span class="text-xs font-medium text-blue-200/80">
        {{ currentTimeLabel || '—' }}
      </span>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="flex h-72 items-center justify-center"
      aria-busy="true"
      aria-label="Loading radar map"
    >
      <div class="flex flex-col items-center gap-3 text-blue-200/70">
        <svg
          class="size-8 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span class="text-sm">Loading radar…</span>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error && frames.length === 0"
      class="flex h-72 items-center justify-center px-6"
      role="alert"
    >
      <div class="text-center text-sm text-yellow-300">
        <span class="mb-1 block text-2xl">⚠️</span>
        {{ error }}
        <button
          class="mt-3 block w-full rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/20"
          @click="loadFrames"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Map -->
    <div v-else class="relative">
      <!-- Leaflet map -->
      <div class="h-72 w-full">
        <LMap
          :zoom="zoom"
          :center="mapCenter"
          :use-global-leaflet="false"
          style="height: 100%; width: 100%"
        >
          <!-- OpenStreetMap base layer -->
          <LTileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            :options="{ maxZoom: 18 }"
          />

          <!-- Rain radar overlay -->
          <LTileLayer
            v-if="currentTileUrl"
            :key="currentTileUrl"
            :url="currentTileUrl"
            :options="{ opacity: 0.7, maxZoom: 18 }"
            attribution="RainViewer"
          />

          <!-- User location marker -->
          <LMarker :lat-lng="mapCenter" />
        </LMap>
      </div>

      <!-- Animation controls overlay -->
      <div class="border-t border-white/10 bg-black/20 px-4 py-3 backdrop-blur-sm">
        <!-- Time scrubber — taller touch target area -->
        <div class="mb-3 flex items-center gap-3">
          <span class="shrink-0 text-xs text-blue-200/60">
            {{ currentFrameIndex + 1 }}/{{ frameCount }}
          </span>
          <div class="flex flex-1 items-center py-2">
            <input
              type="range"
              :min="0"
              :max="frameCount - 1"
              :value="currentFrameIndex"
              class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-blue-400"
              aria-label="Radar timeline"
              @input="onSliderInput"
            />
          </div>
        </div>

        <!-- Playback buttons -->
        <div class="flex items-center justify-center gap-4">
          <!-- Step back — 44px min tap target -->
          <button
            class="flex size-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/25 active:bg-white/30 disabled:opacity-30"
            :disabled="currentFrameIndex === 0"
            aria-label="Previous frame"
            @click="stepBack"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <!-- Play / Pause — 48px to make it the obvious CTA -->
          <button
            class="flex size-12 items-center justify-center rounded-full bg-blue-500/70 text-white shadow-lg transition hover:bg-blue-500/90 active:bg-blue-500"
            :aria-label="isPlaying ? 'Pause animation' : 'Play animation'"
            @click="togglePlay"
          >
            <!-- Play icon -->
            <svg
              v-if="!isPlaying"
              class="size-6 translate-x-0.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            <!-- Pause icon -->
            <svg
              v-else
              class="size-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <!-- Step forward — 44px min tap target -->
          <button
            class="flex size-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/25 active:bg-white/30 disabled:opacity-30"
            :disabled="currentFrameIndex === frameCount - 1"
            aria-label="Next frame"
            @click="stepForward"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 18l8.5-6L6 6v12zm2.5-6 6-4.35v8.69L8.5 12zM16 6h2v12h-2z" />
            </svg>
          </button>
        </div>

        <!-- Attribution note -->
        <p class="mt-2 text-center text-[10px] text-blue-200/40">
          Radar data by RainViewer
        </p>
      </div>
    </div>
  </div>
</template>
