<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
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

const zoom = ref(7)
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
const currentFrame = computed<RadarFrame | null>(() => frames.value[currentFrameIndex.value] ?? null)

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
  return isCurrentFrameNowcast.value ? `${timeStr} (forecast)` : timeStr
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

/** Handle tap/drag on the scrubber bar to navigate frames */
function onScrubStart(event: PointerEvent): void {
  stopAnimation()
  const bar = event.currentTarget as HTMLElement
  bar.setPointerCapture(event.pointerId)

  function updateFromPointer(e: PointerEvent) {
    const rect = bar.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const ratio = x / rect.width
    currentFrameIndex.value = Math.round(ratio * (frames.value.length - 1))
  }

  updateFromPointer(event) // Handle initial tap

  function onMove(e: PointerEvent) {
    updateFromPointer(e)
  }

  function onUp() {
    bar.removeEventListener('pointermove', onMove)
    bar.removeEventListener('pointerup', onUp)
  }

  bar.addEventListener('pointermove', onMove)
  bar.addEventListener('pointerup', onUp)
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

// Escape key handler
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isOpen.value) {
    closeOverlay()
  }
}

// Watch isOpen to: lock body scroll, invalidate Leaflet map size, manage key listener
watch(isOpen, async (open) => {
  if (open) {
    document.body.classList.add('overflow-hidden')
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    // Give the transition a frame to render the map container before invalidating
    setTimeout(() => {
      const mapInstance = (lmapRef.value as unknown as { leafletObject?: L.Map } | null)?.leafletObject
      mapInstance?.invalidateSize()
    }, 150)
  } else {
    document.body.classList.remove('overflow-hidden')
    document.removeEventListener('keydown', onKeydown)
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
  document.body.classList.remove('overflow-hidden')
  document.removeEventListener('keydown', onKeydown)
})

// Stop animation when user changes location (map re-centers)
watch(mapCenter, () => {
  // No need to reload frames — radar is global
})

defineExpose({ openOverlay, nowcastStartIndex, isCurrentFrameNowcast })
</script>

<template>
  <!-- ── Full-screen overlay (teleported to <body>) ──────────────────────── -->
  <Teleport to="body">
    <Transition name="radar-overlay">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex flex-col bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="Rain Radar"
      >
        <!-- Top bar -->
        <div class="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
          <div class="flex items-center gap-2">
            <span class="text-lg" aria-hidden="true">🌧️</span>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-white/80">Rain Radar</h2>
          </div>
          <!-- Time label -->
          <span
            class="text-xs font-medium"
            :class="isCurrentFrameNowcast ? 'text-amber-400' : 'text-blue-200/80'"
          >
            {{ currentTimeLabel || '—' }}
          </span>
          <!-- Close button — min 44px tap target -->
          <button
            class="flex size-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white active:bg-white/20"
            aria-label="Close Rain Radar"
            @click="closeOverlay"
          >
            <svg
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Map area (flex-1 so it fills all remaining space) -->
        <div class="relative flex-1 overflow-hidden">

          <!-- Loading state -->
          <div
            v-if="loading"
            class="flex h-full items-center justify-center"
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
            class="flex h-full items-center justify-center px-6"
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
        <div class="shrink-0 border-t border-white/10 bg-black/30 px-5 py-4 backdrop-blur-sm">
          <!-- Timeline scrubber bar -->
          <div class="mb-3">
            <!-- Frame counter + color-coded time label -->
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs text-blue-200/60">
                {{ currentFrameIndex + 1 }}/{{ frameCount }}
              </span>
              <span
                class="text-xs font-medium"
                :class="isCurrentFrameNowcast ? 'text-amber-400' : 'text-blue-200/80'"
              >
                {{ currentTimeLabel || '—' }}
              </span>
            </div>

            <!-- Scrubber segments -->
            <div
              class="relative flex h-2 items-stretch gap-px rounded-full overflow-hidden cursor-pointer"
              role="slider"
              :aria-valuemin="0"
              :aria-valuemax="frameCount - 1"
              :aria-valuenow="currentFrameIndex"
              aria-label="Radar timeline scrubber"
              @pointerdown="onScrubStart"
            >
              <div
                v-for="(frame, i) in frames"
                :key="frame.time"
                class="flex-1 transition-opacity duration-150"
                :class="[
                  i < nowcastStartIndex ? 'bg-blue-400' : 'bg-amber-400',
                  i === currentFrameIndex ? 'opacity-100' : 'opacity-30',
                  i <= currentFrameIndex ? 'opacity-60' : '',
                ]"
              />
              <!-- "Now" divider marker — positioned at the nowcast boundary -->
              <div
                v-if="nowcastStartIndex > 0 && nowcastStartIndex < frames.length"
                class="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                :style="{ left: `${(nowcastStartIndex / frameCount) * 100}%` }"
              >
                <span class="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-medium text-white/70 whitespace-nowrap">now</span>
              </div>
            </div>
          </div>

          <!-- Playback buttons -->
          <div class="flex items-center justify-center gap-4">
            <!-- Step back — 44px min tap target -->
            <button
              class="flex size-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/25 active:bg-white/30 disabled:opacity-30"
              :disabled="currentFrameIndex === 0 || frames.length === 0"
              aria-label="Previous frame"
              @click="stepBack"
            >
              <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>

            <!-- Play / Pause — 48px to make it the obvious CTA -->
            <button
              class="flex size-12 items-center justify-center rounded-full bg-blue-500/70 text-white shadow-lg transition hover:bg-blue-500/90 active:bg-blue-500 disabled:opacity-40"
              :aria-label="isPlaying ? 'Pause animation' : 'Play animation'"
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
              :disabled="currentFrameIndex === frameCount - 1 || frames.length === 0"
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
    </Transition>
  </Teleport>
</template>

<style scoped>
.radar-overlay-enter-active,
.radar-overlay-leave-active {
  transition: opacity 0.25s ease;
}

.radar-overlay-enter-from,
.radar-overlay-leave-to {
  opacity: 0;
}
</style>
