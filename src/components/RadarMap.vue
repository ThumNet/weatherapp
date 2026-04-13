<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import { useLanguageStore } from '@/stores/language'
import { useLocationStore } from '@/stores/location'
import { fetchRadarFrames, buildRadarTileUrl } from '@/services/rainviewerService'
import type { RadarFrame } from '@/services/rainviewerService'
import RadarScrubberB from '@/components/RadarScrubberB.vue'
import FullScreenModal from '@/components/FullScreenModal.vue'

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
const languageStore = useLanguageStore()

const mapCenter = computed<[number, number]>(() => [
  locationStore.latitude,
  locationStore.longitude,
])

const zoom = ref(9)
// RainViewer radar tiles only go up to zoom level 7 (for both 256 and 512px tile sizes).
// https://www.rainviewer.com/api/weather-maps-api.html
const RADAR_MAX_ZOOM = 7

// Radar frames state
const radarHost = ref('')
const frames = ref<RadarFrame[]>([])
const currentFrameIndex = ref(0)
const nowcastStartIndex = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const isPlaying = ref(false)
const animationTimer = ref<ReturnType<typeof setInterval> | null>(null)
const framesLoaded = ref(false)

// Overlay visibility
const isOpen = ref(false)

// LMap instance ref for invalidateSize
const lmapRef = ref<InstanceType<typeof LMap> | null>(null)

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------
const currentFrame = computed<RadarFrame | null>(
  () => frames.value[currentFrameIndex.value] ?? null,
)

const currentTileUrl = computed<string>(() => {
  if (!currentFrame.value || !radarHost.value) return ''
  return buildRadarTileUrl(radarHost.value, currentFrame.value.path)
})

const isCurrentFrameNowcast = computed<boolean>(() => {
  return currentFrameIndex.value >= nowcastStartIndex.value
})

const currentTimeLabel = computed<string>(() => {
  if (!currentFrame.value) return ''
  const timeStr = formatFrameTime(currentFrame.value.time)
  return isCurrentFrameNowcast.value
    ? `${timeStr} (${languageStore.t('scrubber.forecast')})`
    : timeStr
})

const frameCount = computed(() => frames.value.length)

// ---------------------------------------------------------------------------
// Load radar frames (lazy — only when overlay opens)
// ---------------------------------------------------------------------------
async function loadFrames(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await fetchRadarFrames()
    radarHost.value = result.host
    frames.value = result.frames
    nowcastStartIndex.value = result.nowcastStartIndex
    // Start at the last past frame (the "now" position), so animation plays forward into forecast
    currentFrameIndex.value = Math.max(0, result.nowcastStartIndex - 1)
    framesLoaded.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : languageStore.t('radar.loadingMap')
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

// ---------------------------------------------------------------------------
// Overlay open / close
// ---------------------------------------------------------------------------
function openOverlay(): void {
  isOpen.value = true
  if (!framesLoaded.value) {
    void loadFrames()
  }
}

function closeOverlay(): void {
  stopAnimation()
  isOpen.value = false
}

// Watch isOpen to invalidate Leaflet map size
watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    // Give the transition a frame to render the map container before invalidating
    setTimeout(() => {
      const mapInstance = (lmapRef.value as unknown as { leafletObject?: L.Map } | null)
        ?.leafletObject
      mapInstance?.invalidateSize()
    }, 150)
  }
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(() => {
  // Frames are loaded lazily on first open — nothing to do here
})

onUnmounted(() => {
  stopAnimation()
})

// Stop animation when user changes location (map re-centers)
watch(mapCenter, () => {
  // No need to reload frames — radar is global
})

defineExpose({ openOverlay, nowcastStartIndex, isCurrentFrameNowcast })
</script>

<template>
  <FullScreenModal
    :is-open="isOpen"
    :title="languageStore.t('radar.dialog')"
    :subtitle="languageStore.t('radar.livePrecipitation')"
    @close="closeOverlay"
  >
    <!-- Map area (flex-1 so it fills all remaining space) -->
    <div class="relative flex-1 overflow-hidden">
      <!-- Loading state -->
      <div
        v-if="loading"
        class="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900"
        aria-busy="true"
        :aria-label="languageStore.t('radar.loadingMap')"
      >
        <div
          class="flex flex-col items-center gap-3 text-storm-water-400 dark:text-sea-mist-200/75"
        >
          <svg
            class="size-8 animate-spin text-dutch-orange"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
          <span class="text-sm">{{ languageStore.t('radar.loading') }}</span>
        </div>
      </div>

      <!-- Error state -->
      <div
        v-else-if="error && frames.length === 0"
        class="flex h-full items-center justify-center bg-slate-50 px-6 dark:bg-slate-900"
        role="alert"
      >
        <div
          class="rounded-[1.1rem] border border-red-200 bg-red-50 px-5 py-4 text-center text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
        >
          <span class="mb-1 block text-2xl">⚠️</span>
          {{ error }}
          <button
            class="mt-3 block w-full rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-red-900/40 dark:text-red-100 dark:hover:bg-red-900/60"
            @click="loadFrames"
          >
            {{ languageStore.t('radar.retry') }}
          </button>
        </div>
      </div>

      <!-- Leaflet map -->
      <LMap
        v-else
        ref="lmapRef"
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
          :options="{ opacity: 0.7, maxNativeZoom: RADAR_MAX_ZOOM, maxZoom: 18 }"
          attribution="RainViewer"
        />

        <!-- User location marker -->
        <LMarker :lat-lng="mapCenter" />
      </LMap>
    </div>

    <!-- Animation controls -->
    <div
      class="relative z-10 shrink-0 border-t border-slate-200 bg-white px-5 py-4 pb-safe dark:border-slate-800 dark:bg-slate-950"
    >
      <!-- Timeline scrubber -->
      <div class="mb-3">
        <RadarScrubberB
          :frames="frames"
          :current-frame-index="currentFrameIndex"
          :nowcast-start-index="nowcastStartIndex"
          :frames-loaded="framesLoaded"
          @update:current-frame-index="currentFrameIndex = $event"
          @scrub-start="stopAnimation"
        />
      </div>

      <!-- Playback buttons -->
      <div class="flex items-center justify-center gap-4">
        <!-- Step back — 44px min tap target -->
        <button
          class="flex size-11 items-center justify-center text-storm-water-500 transition hover:text-dutch-orange active:text-storm-water-800 disabled:opacity-30 dark:text-sea-mist-200/70 dark:hover:text-dutch-orange dark:active:text-white"
          :disabled="currentFrameIndex === 0 || frames.length === 0"
          :aria-label="languageStore.t('radar.previousFrame')"
          @click="stepBack"
        >
          <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>

        <!-- Play / Pause — 48px to make it the obvious CTA -->
        <button
          class="flex size-12 items-center justify-center text-storm-water-800 transition hover:text-dutch-orange active:text-storm-water-900 disabled:opacity-40 dark:text-[#FF9B00] dark:hover:brightness-125 dark:active:brightness-90"
          :aria-label="
            isPlaying
              ? languageStore.t('radar.pauseAnimation')
              : languageStore.t('radar.playAnimation')
          "
          :disabled="frames.length === 0"
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
          <svg v-else class="size-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>

        <!-- Step forward — 44px min tap target -->
        <button
          class="flex size-11 items-center justify-center text-storm-water-500 transition hover:text-dutch-orange active:text-storm-water-800 disabled:opacity-30 dark:text-sea-mist-200/70 dark:hover:text-dutch-orange dark:active:text-white"
          :disabled="currentFrameIndex === frameCount - 1 || frames.length === 0"
          :aria-label="languageStore.t('radar.nextFrame')"
          @click="stepForward"
        >
          <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 18l8.5-6L6 6v12zm2.5-6 6-4.35v8.69L8.5 12zM16 6h2v12h-2z" />
          </svg>
        </button>
      </div>

      <!-- Attribution note -->
      <p
        class="mt-2 text-center text-[10px] tracking-[0.16em] text-storm-water-400 dark:text-sea-mist-300/35"
      >
        {{ languageStore.t('radar.dataBy') }}
      </p>
    </div>
  </FullScreenModal>
</template>
