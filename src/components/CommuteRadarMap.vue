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
 * Rendering strategy — declarative vue-leaflet components only:
 *  All route geometry (polyline, circle markers, endpoint markers) is rendered
 *  declaratively via <LPolyline>, <LCircleMarker> and <LMarker> children of
 *  <LMap>. This guarantees they share the EXACT same Leaflet module instance
 *  as the map itself (injected via vue-leaflet's provide/inject tree), avoiding
 *  the invisible-layer bug caused by having two Leaflet module instances when
 *  using imperative L.polyline() calls with :use-global-leaflet="false".
 *
 *  Prop style: all styling (color, weight, opacity, pane, etc.) is passed as
 *  individual top-level props on <LPolyline> / <LCircleMarker>, NOT bundled
 *  into the :options bag. This matches vue-leaflet's documented API and avoids
 *  edge-cases in how the options object is merged at mount time.
 *
 *  Custom pane: a "routePane" (z-index 450) is created in onMapReady, above
 *  the radar tile overlay, ensuring the route is always visible on top.
 */
import 'leaflet/dist/leaflet.css'
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { LMap, LTileLayer, LPolyline, LCircleMarker, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
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

/**
 * Stores the raw Leaflet map instance once `@ready` fires.
 */
const mapInstance = ref<L.Map | null>(null)

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
 * Used both for the LPolyline component and the hasRoute flag.
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

// ─── Derived display data for declarative marker rendering ──────────────────

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
 * Checkpoints to render as circle markers.
 * When a recommendation is available, uses scored checkpoints (colour-coded).
 * Otherwise, falls back to the plain route checkpoints in neutral blue.
 */
interface CheckpointMarker {
  key: string
  lat: number
  lon: number
  radius: number
  color: string
  fillOpacity: number
  weight: number
  label: string
  mmPerHour: number | null
  rating: string
}

const checkpointMarkers = computed<CheckpointMarker[]>(() => {
  const scores = allCheckpointScores.value
  if (scores.length > 0) {
    return scores.map((cs, i) => {
      const colour = ratingColour(cs.rating)
      const ring = cs.isRisky ? 3 : 2
      const radius = cs.isRisky ? 9 : 6
      return {
        key: `score-${i}`,
        lat: cs.checkpoint.position.lat,
        lon: cs.checkpoint.position.lon,
        radius,
        color: colour,
        fillOpacity: cs.isRisky ? 0.9 : 0.6,
        weight: ring,
        label: cs.checkpoint.label,
        mmPerHour: cs.mmPerHour,
        rating: cs.rating,
      }
    })
  }

  // No recommendation — fall back to plain route checkpoints
  const checkpoints = commuteStore.route?.checkpoints ?? []
  return checkpoints.map((cp, i) => ({
    key: `cp-${i}`,
    lat: cp.position.lat,
    lon: cp.position.lon,
    radius: 5,
    color: '#38bdf8',
    fillOpacity: 0.5,
    weight: 2,
    label: cp.label,
    mmPerHour: null,
    rating: 'good',
  }))
})

/** DivIcon HTML for endpoint markers */
function endpointIconHtml(emoji: string, title: string): string {
  return `<div title="${title}" style="
    display:flex;align-items:center;justify-content:center;
    width:36px;height:36px;border-radius:50%;
    background:rgba(15,32,39,0.9);
    border:2.5px solid rgba(255,255,255,0.5);
    font-size:18px;line-height:1;
    box-shadow:0 2px 8px rgba(0,0,0,0.6);
  ">${emoji}</div>`
}

const homeEndpointIcon = computed(() =>
  L.divIcon({
    className: '',
    html: endpointIconHtml('🏠', commuteStore.home?.name ?? 'Home'),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  }),
)

const workEndpointIcon = computed(() =>
  L.divIcon({
    className: '',
    html: endpointIconHtml('🏢', commuteStore.work?.name ?? 'Work'),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  }),
)

// ─── Map bounds management ──────────────────────────────────────────────────

function getLeafletMap(): L.Map | null {
  if (mapInstance.value) return mapInstance.value
  return (lmapRef.value as unknown as { leafletObject?: L.Map } | null)?.leafletObject ?? null
}

function fitToBounds(map: L.Map): void {
  const bounds = commuteStore.routeBounds
  if (!bounds) return

  // Guard: skip if bounds span is zero (degenerate geometry)
  if (bounds.north === bounds.south || bounds.east === bounds.west) return

  map.invalidateSize({ animate: false })

  // Use a plain nested-array instead of L.latLngBounds() so that this call is
  // safe even if the statically-imported 'leaflet' CJS module is a different
  // runtime instance from the ESM one used by vue-leaflet's LMap internally.
  // Leaflet's fitBounds() normalises [[lat,lon],[lat,lon]] arrays directly.
  map.fitBounds(
    [[bounds.south, bounds.west], [bounds.north, bounds.east]],
    { padding: [40, 40], maxZoom: 14 },
  )
}

// Phase-2 timer handle — cleared on unmount to prevent memory leaks
let phase2Timer: ReturnType<typeof setTimeout> | null = null

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
 *
 * Route geometry is rendered DECLARATIVELY via <LPolyline> / <LCircleMarker>
 * children, so they are automatically present in the map by the time this
 * callback fires.  All we need to do here is:
 *  1. Create a dedicated "routePane" above the radar overlay so the polyline
 *     is always visible regardless of tile-layer stacking order.
 *  2. Fit the view to the route bounds.
 *
 * Two-phase fit strategy handles the CommutePage fade-in transition:
 *  Phase 1 (immediate): invalidateSize + fitBounds.
 *  Phase 2 (400 ms):   repeat invalidateSize + fitBounds after the 200 ms
 *                       CSS opacity transition has fully completed.
 */
async function onMapReady(leafletMap: L.Map): Promise<void> {
  mapInstance.value = leafletMap

  // Create a dedicated pane that sits above tilePane (200), overlayPane (400),
  // and the radar tile overlay — ensuring the route polyline is always on top.
  if (!leafletMap.getPane('routePane')) {
    const pane = leafletMap.createPane('routePane')
    pane.style.zIndex = '450'
    // Panes need pointer-events:none so the map stays interactive
    pane.style.pointerEvents = 'none'
  }

  await nextTick()

  // Phase 1 — fit immediately
  fitToBounds(leafletMap)

  // Phase 2 — re-fit after CSS fade-in transition (200 ms) completes
  phase2Timer = setTimeout(() => {
    phase2Timer = null
    const map = getLeafletMap()
    if (!map) return
    fitToBounds(map)
  }, 400)
}

// ─── Watch: re-fit when route or recommendation changes ────────────────────

watch(
  () => commuteStore.route,
  async () => {
    await nextTick()
    const map = getLeafletMap()
    if (!map) return
    fitToBounds(map)
  },
)

watch(
  () => commuteStore.recommendation,
  async () => {
    await nextTick()
    // No bounds change needed for recommendation updates — just let Vue
    // re-render the declarative checkpoint markers reactively.
  },
)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

void loadFrames()

onUnmounted(() => {
  stopAnimation()
  if (phase2Timer !== null) {
    clearTimeout(phase2Timer)
    phase2Timer = null
  }
  mapInstance.value = null
})

/**
 * Human-readable label for a condition rating used inside popups.
 */
function ratingLabel(rating: string): string {
  if (rating === 'poor') return 'Poor — heavy rain'
  if (rating === 'marginal') return 'Marginal — light rain'
  return 'Clear'
}

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
    <div class="relative" style="height: 360px">

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

      <!-- Leaflet map — all route layers rendered declaratively as children -->
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

        <!-- ── Route polyline (declarative — same Leaflet instance as LMap) ── -->
        <!--
          Uses individual top-level props (color, weight, opacity, etc.) rather
          than the :options bag — this is the vue-leaflet documented approach and
          avoids any ambiguity in how the options object is merged at mount time.

          Both polylines go into the custom 'routePane' (z-index 450) which is
          created in onMapReady above.  This guarantees they always render above
          the radar tile overlay (tilePane z-index 200) and overlayPane (400).
        -->
        <template v-if="hasRoute">
          <!-- Dark outline for contrast on light map tiles -->
          <LPolyline
            :key="`route-outline-${routeLatLngs.length}`"
            :lat-lngs="routeLatLngs"
            pane="routePane"
            color="#0f172a"
            :weight="12"
            :opacity="0.6"
            line-cap="round"
            line-join="round"
          />
          <!-- Bright cyan route line on top -->
          <LPolyline
            :key="`route-fill-${routeLatLngs.length}`"
            :lat-lngs="routeLatLngs"
            pane="routePane"
            color="#0ea5e9"
            :weight="7"
            :opacity="1"
            line-cap="round"
            line-join="round"
          />

          <!-- ── Checkpoint circle markers ───────────────────────────────── -->
          <LCircleMarker
            v-for="cm in checkpointMarkers"
            :key="cm.key"
            :lat-lng="[cm.lat, cm.lon]"
            pane="routePane"
            :radius="cm.radius"
            :color="cm.color"
            :fill-color="cm.color"
            :fill-opacity="cm.fillOpacity"
            :weight="cm.weight"
            :opacity="1"
          >
            <LPopup>
              <div style="min-width: 120px; font-size: 13px; line-height: 1.5">
                <strong>{{ cm.label }}</strong><br />
                <span v-if="cm.mmPerHour !== null">
                  {{ cm.mmPerHour.toFixed(1) }} mm/h &mdash; {{ ratingLabel(cm.rating) }}
                </span>
                <span v-else style="color: #94a3b8">No rain data</span>
              </div>
            </LPopup>
          </LCircleMarker>

          <!-- ── Start marker (🏠) ───────────────────────────────────────── -->
          <LMarker
            v-if="commuteStore.route?.origin"
            :lat-lng="[commuteStore.route.origin.lat, commuteStore.route.origin.lon]"
            :icon="homeEndpointIcon"
            :z-index-offset="200"
          />

          <!-- ── End marker (🏢) ─────────────────────────────────────────── -->
          <LMarker
            v-if="commuteStore.route?.destination"
            :lat-lng="[commuteStore.route.destination.lat, commuteStore.route.destination.lon]"
            :icon="workEndpointIcon"
            :z-index-offset="200"
          />
        </template>
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
