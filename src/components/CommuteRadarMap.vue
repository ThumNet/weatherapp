<script setup lang="ts">
/**
 * CommuteRadarMap — cycling route rendered over the rain radar.
 *
 * Displays:
 *  - OSM base tiles + live RainViewer radar overlay (animatable)
 *  - The current cycling route as a cyan polyline
 *  - Route checkpoints as circle markers coloured by risk rating:
 *      green  = good
 *      amber  = marginal
 *      red    = poor / risky
 *  - Start (🏠) and destination (🏢) labelled markers
 *  - Map auto-fitted to route bounds when route data is present
 *
 * The component is self-contained — it reads from `useCommuteStore()` directly
 * and re-fits the map whenever the route changes.
 */
import 'leaflet/dist/leaflet.css'
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { LMap, LTileLayer } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import { useCommuteStore } from '@/stores/commute'
import { fetchRadarFrames, buildRadarTileUrl, formatFrameTime } from '@/services/rainviewerService'
import type { RadarFrame } from '@/services/rainviewerService'
import type { CheckpointScore } from '@/types/commute'

// ─── Leaflet default-icon fix (bundler breaks PNG imports) ──────────────────
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

// ─── Store ──────────────────────────────────────────────────────────────────
const commuteStore = useCommuteStore()

// ─── Map instance ref ────────────────────────────────────────────────────────
const lmapRef = ref<InstanceType<typeof LMap> | null>(null)

// ─── Radar state ─────────────────────────────────────────────────────────────
const RADAR_MAX_ZOOM = 7

const radarHost = ref('')
const frames = ref<RadarFrame[]>([])
const currentFrameIndex = ref(0)
const nowcastStartIndex = ref(0)
const radarLoading = ref(false)
const radarError = ref<string | null>(null)
const framesLoaded = ref(false)
const isPlaying = ref(false)
const animationTimer = ref<ReturnType<typeof setInterval> | null>(null)

// ─── Map centre / zoom ───────────────────────────────────────────────────────
/** Default centre: Amsterdam */
const DEFAULT_CENTER: [number, number] = [52.37, 4.9]
const DEFAULT_ZOOM = 10

const mapCenter = ref<[number, number]>(DEFAULT_CENTER)
const mapZoom = ref(DEFAULT_ZOOM)

// ─── Radar helpers ───────────────────────────────────────────────────────────
const currentFrame = computed<RadarFrame | null>(
  () => frames.value[currentFrameIndex.value] ?? null,
)

const currentTileUrl = computed<string>(() => {
  if (!currentFrame.value || !radarHost.value) return ''
  return buildRadarTileUrl(radarHost.value, currentFrame.value.path)
})

const isCurrentFrameNowcast = computed<boolean>(
  () => currentFrameIndex.value >= nowcastStartIndex.value,
)

const currentTimeLabel = computed<string>(() => {
  if (!currentFrame.value) return ''
  const t = formatFrameTime(currentFrame.value.time)
  return isCurrentFrameNowcast.value ? `${t} (forecast)` : t
})

// ─── Route geometry ──────────────────────────────────────────────────────────

/**
 * Returns the route polyline as Leaflet LatLng pairs, or an empty array.
 */
const routeLatLngs = computed<L.LatLngTuple[]>(() => {
  const geometry = commuteStore.route?.geometry
  if (!geometry || geometry.length === 0) return []
  return geometry.map((p) => [p.lat, p.lon] as L.LatLngTuple)
})

const hasRoute = computed(() => routeLatLngs.value.length > 0)

// ─── Risk checkpoints ────────────────────────────────────────────────────────

/**
 * Risky checkpoint scores from the best departure in the current recommendation.
 * These are the checkpoints where precipitation is 'marginal' or 'poor'.
 */
const riskyCheckpointScores = computed<CheckpointScore[]>(() => {
  const best = commuteStore.recommendation?.bestDeparture
  if (!best) return []
  return best.checkpointScores.filter((cs) => cs.rating !== 'good')
})

/**
 * All checkpoint scores (good + risky) from the best departure option.
 * Used to draw all checkpoint markers, colour-coded by rating.
 */
const allCheckpointScores = computed<CheckpointScore[]>(() => {
  return commuteStore.recommendation?.bestDeparture?.checkpointScores ?? []
})

// ─── Leaflet layer management (imperative, via map ref) ──────────────────────

// We use imperative Leaflet API for the polyline and checkpoint markers
// because @vue-leaflet doesn't expose LPolyline/LCircleMarker in a way that
// easily supports dynamic re-creation with popup content on older 0.x versions.

let routePolyline: L.Polyline | null = null
let checkpointLayers: L.Layer[] = []
let startMarker: L.Marker | null = null
let endMarker: L.Marker | null = null

function getLeafletMap(): L.Map | null {
  return (lmapRef.value as unknown as { leafletObject?: L.Map } | null)?.leafletObject ?? null
}

function createDivIcon(emoji: string, title: string, extraClasses = ''): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div title="${title}" class="commute-endpoint-icon ${extraClasses}" style="
      display:flex;align-items:center;justify-content:center;
      width:32px;height:32px;border-radius:50%;
      background:rgba(15,32,39,0.85);
      border:2px solid rgba(255,255,255,0.4);
      font-size:16px;line-height:1;
      box-shadow:0 2px 6px rgba(0,0,0,0.5);
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

/**
 * Colour for a checkpoint circle based on risk rating.
 * good → emerald, marginal → amber, poor → red
 */
function ratingColour(rating: string): string {
  if (rating === 'poor') return '#ef4444'
  if (rating === 'marginal') return '#f59e0b'
  return '#10b981'
}

/**
 * Redraw route polyline + checkpoint markers on the map.
 * Clears previous layers first.
 */
function redrawRouteLayers(): void {
  const map = getLeafletMap()
  if (!map) return

  // ── Remove old layers ──────────────────────────────────────────────────
  if (routePolyline) {
    routePolyline.remove()
    routePolyline = null
  }
  for (const layer of checkpointLayers) {
    layer.remove()
  }
  checkpointLayers = []
  if (startMarker) { startMarker.remove(); startMarker = null }
  if (endMarker) { endMarker.remove(); endMarker = null }

  const latlngs = routeLatLngs.value
  if (latlngs.length === 0) return

  // ── Route polyline ─────────────────────────────────────────────────────
  routePolyline = L.polyline(latlngs, {
    color: '#38bdf8',      // sky-400 — visible on dark map
    weight: 4,
    opacity: 0.92,
    lineJoin: 'round',
    lineCap: 'round',
  }).addTo(map)

  // ── Checkpoint circles ─────────────────────────────────────────────────
  // If a recommendation exists, colour each checkpoint by its risk rating.
  // Otherwise, draw all route checkpoints in neutral blue.
  const scores = allCheckpointScores.value
  const scoredPositions = new Set(
    scores.map((cs) => `${cs.checkpoint.position.lat.toFixed(5)},${cs.checkpoint.position.lon.toFixed(5)}`),
  )

  if (scores.length > 0) {
    for (const cs of scores) {
      const colour = ratingColour(cs.rating)
      const ring = cs.isRisky ? 3 : 2
      const radius = cs.isRisky ? 9 : 6

      const circle = L.circleMarker(
        [cs.checkpoint.position.lat, cs.checkpoint.position.lon],
        {
          radius,
          color: colour,
          fillColor: colour,
          fillOpacity: cs.isRisky ? 0.9 : 0.6,
          weight: ring,
          opacity: 1,
        },
      )

      const mmLabel =
        cs.mmPerHour > 0
          ? `<br><span style="color:${colour};font-weight:bold">${cs.mmPerHour.toFixed(1)} mm/h</span>`
          : ''
      const riskLabel = cs.isRisky
        ? `<span style="color:${colour};font-weight:bold">${cs.rating}</span>`
        : `<span style="color:#10b981">clear</span>`
      circle.bindPopup(
        `<div style="font-size:13px;line-height:1.5">
          <strong>${cs.checkpoint.label}</strong><br>
          ${riskLabel}${mmLabel}
        </div>`,
        { maxWidth: 180 },
      )

      circle.addTo(map)
      checkpointLayers.push(circle)
    }
  } else {
    // No recommendation yet — draw checkpoints from route.checkpoints if available
    const checkpoints = commuteStore.route?.checkpoints ?? []
    for (const cp of checkpoints) {
      const circle = L.circleMarker([cp.position.lat, cp.position.lon], {
        radius: 5,
        color: '#38bdf8',
        fillColor: '#38bdf8',
        fillOpacity: 0.5,
        weight: 2,
        opacity: 0.8,
      })
      circle.bindPopup(`<strong style="font-size:13px">${cp.label}</strong>`, { maxWidth: 160 })
      circle.addTo(map)
      checkpointLayers.push(circle)
    }
  }

  // ── Start marker (🏠) ──────────────────────────────────────────────────
  const origin = commuteStore.route?.origin
  if (origin) {
    startMarker = L.marker([origin.lat, origin.lon], {
      icon: createDivIcon('🏠', commuteStore.home?.name ?? 'Home'),
      zIndexOffset: 100,
    })
      .bindPopup(`<strong style="font-size:13px">${commuteStore.home?.name ?? 'Home'}</strong>`, { maxWidth: 180 })
      .addTo(map)
  }

  // ── End marker (🏢) ────────────────────────────────────────────────────
  const destination = commuteStore.route?.destination
  if (destination) {
    endMarker = L.marker([destination.lat, destination.lon], {
      icon: createDivIcon('🏢', commuteStore.work?.name ?? 'Work'),
      zIndexOffset: 100,
    })
      .bindPopup(`<strong style="font-size:13px">${commuteStore.work?.name ?? 'Work'}</strong>`, { maxWidth: 180 })
      .addTo(map)
  }

  // ── Fit map to route bounds ────────────────────────────────────────────
  fitToBounds(map)
}

function fitToBounds(map: L.Map): void {
  const bounds = commuteStore.routeBounds
  if (!bounds) return

  const leafletBounds = L.latLngBounds(
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  )
  map.fitBounds(leafletBounds, { padding: [32, 32], maxZoom: 14 })
}

// ─── Radar animation ─────────────────────────────────────────────────────────

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

// ─── Radar frame loading ─────────────────────────────────────────────────────

async function loadFrames(): Promise<void> {
  radarLoading.value = true
  radarError.value = null
  try {
    const result = await fetchRadarFrames()
    radarHost.value = result.host
    frames.value = result.frames
    nowcastStartIndex.value = result.nowcastStartIndex
    currentFrameIndex.value = Math.max(0, result.nowcastStartIndex - 1)
    framesLoaded.value = true
  } catch (err) {
    radarError.value = err instanceof Error ? err.message : 'Failed to load radar data'
  } finally {
    radarLoading.value = false
  }
}

// ─── Map ready callback ───────────────────────────────────────────────────────

/**
 * Called by LMap's @ready event once the Leaflet map instance is initialised.
 * At this point the map DOM is present, so we can draw overlays and fit bounds.
 */
async function onMapReady(): Promise<void> {
  await nextTick()
  // Small delay to let the container settle its final dimensions
  setTimeout(() => {
    const map = getLeafletMap()
    map?.invalidateSize()
    redrawRouteLayers()
  }, 100)
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

// Re-draw when route or recommendation changes
watch(
  () => [commuteStore.route, commuteStore.recommendation],
  async () => {
    await nextTick()
    redrawRouteLayers()
  },
  { deep: false },
)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

// Load radar frames eagerly when the component mounts
void loadFrames()

onUnmounted(() => {
  stopAnimation()
  // Clean up Leaflet layers
  if (routePolyline) routePolyline.remove()
  for (const l of checkpointLayers) l.remove()
  if (startMarker) startMarker.remove()
  if (endMarker) endMarker.remove()
})

// ─── Risk legend entries ──────────────────────────────────────────────────────

const riskyCount = computed(() => riskyCheckpointScores.value.length)
</script>

<template>
  <!--
    CommuteRadarMap — inline map panel embedded in CommutePage.
    Dark slate background, same language as RadarMap.vue.
  -->
  <div
    class="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900"
    aria-label="Route map with radar"
  >
    <!-- ── Map area ──────────────────────────────────────────────────────── -->
    <div class="relative" style="height: 340px">

      <!-- Loading state -->
      <div
        v-if="radarLoading && !framesLoaded"
        class="absolute inset-0 flex items-center justify-center bg-slate-900"
        aria-busy="true"
        aria-label="Loading radar map"
      >
        <div class="flex flex-col items-center gap-2 text-blue-200/60">
          <svg
            class="size-7 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span class="text-xs">Loading radar…</span>
        </div>
      </div>

      <!-- Leaflet map -->
      <LMap
        ref="lmapRef"
        :zoom="mapZoom"
        :center="mapCenter"
        :use-global-leaflet="false"
        style="height: 100%; width: 100%"
        @ready="onMapReady"
      >
        <!-- OpenStreetMap base layer -->
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>"
          :options="{ maxZoom: 18 }"
        />

        <!-- Rain radar overlay -->
        <LTileLayer
          v-if="currentTileUrl"
          :key="currentTileUrl"
          :url="currentTileUrl"
          :options="{ opacity: 0.65, maxNativeZoom: RADAR_MAX_ZOOM, maxZoom: 18 }"
          attribution="RainViewer"
        />
      </LMap>

      <!-- ── Radar timestamp badge ──────────────────────────────────────── -->
      <div
        v-if="framesLoaded && currentTimeLabel"
        class="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium backdrop-blur-sm"
        :class="isCurrentFrameNowcast ? 'text-amber-300' : 'text-blue-200'"
      >
        {{ currentTimeLabel }}
      </div>

      <!-- ── Risk legend (shown when recommendation exists) ────────────── -->
      <div
        v-if="allCheckpointScores.length > 0"
        class="pointer-events-none absolute right-2 top-2 flex flex-col gap-1 rounded-lg bg-black/60 px-2.5 py-2 text-[11px] backdrop-blur-sm"
      >
        <div class="flex items-center gap-1.5">
          <span class="inline-block size-2.5 rounded-full bg-emerald-500" />
          <span class="text-white/80">Clear</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-block size-2.5 rounded-full bg-amber-400" />
          <span class="text-white/80">Marginal</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-block size-2.5 rounded-full bg-red-500" />
          <span class="text-white/80">Poor</span>
        </div>
      </div>

      <!-- ── "No route" hint ───────────────────────────────────────────── -->
      <div
        v-if="!hasRoute"
        class="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center"
      >
        <span class="rounded-full bg-black/60 px-3 py-1 text-xs text-blue-200/70 backdrop-blur-sm">
          Fetch a route to see it here
        </span>
      </div>
    </div>

    <!-- ── Controls bar ──────────────────────────────────────────────────── -->
    <div class="flex shrink-0 items-center justify-between border-t border-white/10 bg-black/30 px-4 py-2.5 backdrop-blur-sm">

      <!-- Radar error (small inline) -->
      <p
        v-if="radarError"
        class="truncate text-xs text-yellow-400"
        role="alert"
      >
        ⚠ {{ radarError }}
      </p>

      <!-- Risk summary chip (left) -->
      <div
        v-else-if="riskyCount > 0"
        class="flex items-center gap-1.5 text-xs"
      >
        <span class="inline-block size-2 rounded-full bg-red-500" />
        <span class="text-red-300">{{ riskyCount }} risky checkpoint{{ riskyCount > 1 ? 's' : '' }}</span>
      </div>
      <div
        v-else-if="allCheckpointScores.length > 0"
        class="flex items-center gap-1.5 text-xs"
      >
        <span class="inline-block size-2 rounded-full bg-emerald-500" />
        <span class="text-emerald-300">Route looks clear</span>
      </div>
      <div v-else class="text-xs text-blue-200/40">
        Rain radar
      </div>

      <!-- Playback controls (right) -->
      <div class="flex items-center gap-2">
        <!-- Step back -->
        <button
          class="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 disabled:opacity-30"
          :disabled="currentFrameIndex === 0 || frames.length === 0"
          aria-label="Previous radar frame"
          @click="stepBack"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>

        <!-- Play / Pause -->
        <button
          class="flex size-9 items-center justify-center rounded-full bg-blue-500/70 text-white shadow transition hover:bg-blue-500/90 disabled:opacity-40"
          :aria-label="isPlaying ? 'Pause radar' : 'Play radar'"
          :disabled="frames.length === 0"
          @click="togglePlay"
        >
          <svg v-if="!isPlaying" class="size-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>

        <!-- Step forward -->
        <button
          class="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 disabled:opacity-30"
          :disabled="currentFrameIndex === frames.length - 1 || frames.length === 0"
          aria-label="Next radar frame"
          @click="stepForward"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 18l8.5-6L6 6v12zm2.5-6 6-4.35v8.69L8.5 12zM16 6h2v12h-2z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
