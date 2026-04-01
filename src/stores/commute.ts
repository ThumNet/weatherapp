import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CommuteEndpoint, CyclingRoute, RouteBounds, CommuteRecommendationResult } from '@/types/commute'
import { fetchCyclingRoute } from '@/services/routingService'
import { evaluateCommuteRecommendation } from '@/services/commuteRecommendationService'
import { fetchPrecipitationForecast } from '@/services/buienradarService'

/**
 * How long (in ms) a cached route is considered fresh.
 * After this threshold, the UI flags it as stale and prompts a re-fetch.
 * Matches the Workbox OSRM cache TTL (24 h).
 */
const ROUTE_STALE_MS = 24 * 60 * 60 * 1000

/**
 * How long (in ms) a recommendation is considered fresh.
 * Buienradar nowcasts cover ~2 hours ahead in 5-minute steps, so anything
 * older than 30 minutes may already be describing a past window.
 */
const RECOMMENDATION_STALE_MS = 30 * 60 * 1000

const STORAGE_KEY = 'dutch-weather:commute'

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface PersistedCommute {
  home: CommuteEndpoint | null
  work: CommuteEndpoint | null
  route: CyclingRoute | null
  routeLastFetched: string | null // ISO string
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function isValidEndpoint(value: unknown): value is CommuteEndpoint {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v['name'] !== 'string') return false
  const pos = v['position']
  if (pos === null || typeof pos !== 'object') return false
  const p = pos as Record<string, unknown>
  return typeof p['lat'] === 'number' && typeof p['lon'] === 'number'
}

function isValidRoute(value: unknown): value is CyclingRoute {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    v['origin'] !== null &&
    typeof v['origin'] === 'object' &&
    v['destination'] !== null &&
    typeof v['destination'] === 'object'
  )
}

function loadFromStorage(): PersistedCommute {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { home: null, work: null, route: null, routeLastFetched: null }
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== 'object')
      return { home: null, work: null, route: null, routeLastFetched: null }
    const p = parsed as Record<string, unknown>
    return {
      home: isValidEndpoint(p['home']) ? p['home'] : null,
      work: isValidEndpoint(p['work']) ? p['work'] : null,
      route: isValidRoute(p['route']) ? (p['route'] as CyclingRoute) : null,
      routeLastFetched: typeof p['routeLastFetched'] === 'string' ? p['routeLastFetched'] : null,
    }
  } catch {
    return { home: null, work: null, route: null, routeLastFetched: null }
  }
}

function saveToStorage(data: PersistedCommute): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Silently fail if localStorage is unavailable (e.g. private browsing with full storage block)
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCommuteStore = defineStore('commute', () => {
  const persisted = loadFromStorage()

  const home = ref<CommuteEndpoint | null>(persisted.home)
  const work = ref<CommuteEndpoint | null>(persisted.work)

  // --- route state ---

  const route = ref<CyclingRoute | null>(persisted.route)
  const routeLoading = ref(false)
  const routeError = ref<string | null>(null)
  const routeLastFetched = ref<Date | null>(
    persisted.routeLastFetched ? new Date(persisted.routeLastFetched) : null,
  )

  // --- computed selectors ---

  /**
   * Axis-aligned bounding box enclosing the current route geometry.
   * `null` when no route is loaded or the route has no geometry.
   */
  const routeBounds = computed<RouteBounds | null>(() => {
    const geometry = route.value?.geometry
    if (!geometry || geometry.length === 0) return null

    let north = -Infinity
    let south = Infinity
    let east = -Infinity
    let west = Infinity

    for (const point of geometry) {
      if (point.lat > north) north = point.lat
      if (point.lat < south) south = point.lat
      if (point.lon > east) east = point.lon
      if (point.lon < west) west = point.lon
    }

    return { north, south, east, west }
  })

  /**
   * Duration of the stored route in whole minutes.
   * `null` when no route is loaded or duration is not yet resolved.
   */
  const routeDurationMinutes = computed<number | null>(() => {
    const secs = route.value?.durationSeconds
    if (secs == null) return null
    return Math.round(secs / 60)
  })

  /**
   * `true` when a route is loaded but its `routeLastFetched` timestamp is
   * older than `ROUTE_STALE_MS` (24 h). Road networks change rarely, but a
   * route fetched yesterday should be re-confirmed before relying on it.
   * `false` when no route is stored.
   */
  const isRouteStale = computed<boolean>(() => {
    if (!route.value || !routeLastFetched.value) return false
    return Date.now() - routeLastFetched.value.getTime() > ROUTE_STALE_MS
  })

  /**
   * `true` when a recommendation exists but its `generatedAt` timestamp is
   * older than `RECOMMENDATION_STALE_MS` (30 min).
   * Buienradar nowcasts only look 2 hours ahead in 5-min steps — an
   * evaluation from >30 min ago may be describing conditions that have
   * already passed.
   * `false` when no recommendation is stored.
   */
  const isRecommendationStale = computed<boolean>(() => {
    const iso = recommendation.value?.generatedAt
    if (!iso) return false
    return Date.now() - new Date(iso).getTime() > RECOMMENDATION_STALE_MS
  })

  // --- recommendation state ---

  const recommendation = ref<CommuteRecommendationResult | null>(null)
  const recommendationLoading = ref(false)
  const recommendationError = ref<string | null>(null)

  // --- internal helpers ---

  function persist(): void {
    saveToStorage({
      home: home.value,
      work: work.value,
      route: route.value,
      routeLastFetched: routeLastFetched.value?.toISOString() ?? null,
    })
  }

  // --- endpoint actions ---

  function setHome(endpoint: CommuteEndpoint): void {
    home.value = endpoint
    persist()
  }

  function setWork(endpoint: CommuteEndpoint): void {
    work.value = endpoint
    persist()
  }

  function clearHome(): void {
    home.value = null
    persist()
  }

  function clearWork(): void {
    work.value = null
    persist()
  }

  function clearAll(): void {
    home.value = null
    work.value = null
    route.value = null
    routeLastFetched.value = null
    routeError.value = null
    recommendation.value = null
    recommendationError.value = null
    persist()
  }

  // --- route actions ---

  /**
   * Fetches the cycling route between the currently saved home and work
   * endpoints and stores the result in `route`.
   *
   * No-ops silently when either endpoint is not yet configured.
   * Sets `routeLoading` while in-flight and `routeError` on failure.
   */
  async function fetchRoute(): Promise<void> {
    if (home.value === null || work.value === null) return

    routeLoading.value = true
    routeError.value = null

    try {
      const result = await fetchCyclingRoute(
        'home-work',
        `${home.value.name} → ${work.value.name}`,
        home.value.position,
        work.value.position,
      )
      route.value = result
      routeLastFetched.value = new Date()
      persist()
    } catch (err) {
      routeError.value =
        err instanceof Error ? err.message : 'Failed to fetch cycling route. Please try again.'
      // Keep the previous route visible while showing the error
    } finally {
      routeLoading.value = false
    }
  }

  /**
   * Clears the stored route geometry and resets related state.
   * Useful when endpoints change and the old route is no longer valid.
   */
  function clearRoute(): void {
    route.value = null
    routeLastFetched.value = null
    routeError.value = null
    recommendation.value = null
    recommendationError.value = null
    persist()
  }

  // --- recommendation actions ---

  /**
   * Evaluates bike commute conditions for the saved route, scoring every
   * departure slot from now to now + 2 hours (5-minute steps).
   *
   * Fetches live Buienradar precipitation data for each checkpoint position.
   * Sets `recommendation` on success and `recommendationError` on failure.
   * No-ops silently when no route is stored.
   */
  async function evaluateRecommendation(now: Date = new Date()): Promise<void> {
    if (route.value === null) return

    recommendationLoading.value = true
    recommendationError.value = null

    try {
      const result = await evaluateCommuteRecommendation(
        route.value,
        fetchPrecipitationForecast,
        now,
      )
      recommendation.value = result
    } catch (err) {
      recommendationError.value =
        err instanceof Error
          ? err.message
          : 'Failed to evaluate commute recommendation. Please try again.'
    } finally {
      recommendationLoading.value = false
    }
  }

  // --- derived helpers (non-reactive, call as needed) ---

  /** Returns true when both home and work endpoints have been configured. */
  function isConfigured(): boolean {
    return home.value !== null && work.value !== null
  }

  return {
    // endpoint state
    home,
    work,
    // route state
    route,
    routeLoading,
    routeError,
    routeLastFetched,
    // computed selectors
    routeBounds,
    routeDurationMinutes,
    isRouteStale,
    isRecommendationStale,
    // endpoint actions
    setHome,
    setWork,
    clearHome,
    clearWork,
    clearAll,
    // route actions
    fetchRoute,
    clearRoute,
    // recommendation state
    recommendation,
    recommendationLoading,
    recommendationError,
    // recommendation actions
    evaluateRecommendation,
    // helpers
    isConfigured,
  }
})
