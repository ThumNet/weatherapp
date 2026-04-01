/**
 * Routing service — seam for fetching cycling route geometry and duration.
 *
 * Uses the OSRM (Open Source Routing Machine) bicycle instance hosted by
 * OpenStreetMap (`routing.openstreetmap.de/routed-bike`). No API key is
 * required; this is a public service subject to rate limits — production
 * usage should point at a self-hosted instance.
 *
 * Responsibilities of this module:
 *  - Build request URLs
 *  - Fetch and validate OSRM responses
 *  - Normalise the raw OSRM response into the app's `CyclingRoute` domain type
 *  - Derive route checkpoints from the decoded geometry
 *
 * What is intentionally NOT here (deferred to later steps):
 *  - Store / reactivity wiring
 *  - UI integration
 *  - Precipitation sampling at checkpoints
 */

import type {
  CyclingRoute,
  LatLon,
  OsrmRouteResponse,
  RouteCheckpoint,
} from '@/types/commute'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * OSRM bicycle endpoint hosted by OpenStreetMap.
 *
 * `router.project-osrm.org` only exposes the `car` profile; requesting
 * `/route/v1/bike/` or `/route/v1/bicycle/` on that host silently falls
 * back to car routing, producing unrealistically short durations (~27 min
 * for 27 km) and car-oriented geometries.
 *
 * `routing.openstreetmap.de/routed-bike` is a dedicated OSRM instance built
 * with the bicycle profile. Its URL path uses `driving` as the OSRM
 * *service* keyword (not the transport mode — that is encoded in the host).
 *
 * Swap this constant for a self-hosted URL in production without touching
 * any other code.
 */
const OSRM_BASE_URL = 'https://routing.openstreetmap.de/routed-bike'

/**
 * OSRM service path segment for the OpenStreetMap bicycle instance.
 *
 * The `routing.openstreetmap.de/routed-bike` host expects the standard OSRM
 * `driving` service name in the URL even though it routes cyclists, because
 * `driving` here refers to the OSRM internal routing service, not a car
 * transport mode.
 */
const OSRM_PROFILE = 'driving'

/**
 * Number of intermediate checkpoints to derive from the route geometry
 * (not counting the origin and destination, which are always included).
 *
 * Increasing this value gives finer-grained precipitation sampling at the
 * cost of more Buienradar requests.
 */
const DEFAULT_INTERMEDIATE_CHECKPOINT_COUNT = 3

// ---------------------------------------------------------------------------
// Polyline decoder
// ---------------------------------------------------------------------------

/**
 * Decodes a Google-style encoded polyline string into an array of {lat, lon}
 * coordinate pairs.
 *
 * OSRM uses polyline6 encoding by default (precision = 1e-6).
 * Pass `precision = 5` for the less common polyline5 variant.
 *
 * @param encoded   - Encoded polyline string from the OSRM response.
 * @param precision - Encoding precision exponent (default: 6 for polyline6).
 * @returns Array of decoded coordinate pairs.
 */
export function decodePolyline(encoded: string, precision = 6): LatLon[] {
  const factor = Math.pow(10, precision)
  const coordinates: LatLon[] = []
  let index = 0
  let lat = 0
  let lon = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    result = 0
    shift = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLon = result & 1 ? ~(result >> 1) : result >> 1
    lon += deltaLon

    coordinates.push({ lat: lat / factor, lon: lon / factor })
  }

  return coordinates
}

// ---------------------------------------------------------------------------
// Checkpoint derivation
// ---------------------------------------------------------------------------

/**
 * Derives evenly-spaced checkpoints from a decoded route geometry.
 *
 * Always includes the origin (index 0) and destination (last index).
 * `intermediateCount` additional points are interpolated between them by
 * sampling the geometry array at equal fractional intervals.
 *
 * @param geometry           - Decoded polyline as returned by `decodePolyline`.
 * @param intermediateCount  - How many intermediate checkpoints to include.
 * @returns Array of {@link RouteCheckpoint} objects.
 */
export function deriveCheckpoints(
  geometry: LatLon[],
  intermediateCount = DEFAULT_INTERMEDIATE_CHECKPOINT_COUNT,
): RouteCheckpoint[] {
  if (geometry.length === 0) return []

  const checkpoints: RouteCheckpoint[] = []

  // Always include origin
  checkpoints.push({ label: 'Start', position: geometry[0] })

  // Intermediate points sampled at equal fractions of the geometry length
  const totalSegments = geometry.length - 1
  for (let i = 1; i <= intermediateCount; i++) {
    const fraction = i / (intermediateCount + 1)
    const geomIndex = Math.round(fraction * totalSegments)
    checkpoints.push({
      label: `Waypoint ${i}`,
      position: geometry[geomIndex],
    })
  }

  // Always include destination (avoid duplicate when geometry has only 1 point)
  if (geometry.length > 1) {
    checkpoints.push({ label: 'Destination', position: geometry[geometry.length - 1] })
  }

  return checkpoints
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Builds the OSRM route request URL for a cycling trip between two points.
 *
 * @param origin      - Start coordinate.
 * @param destination - End coordinate.
 * @returns Fully-qualified OSRM request URL string.
 */
export function buildRoutingUrl(origin: LatLon, destination: LatLon): string {
  // OSRM coordinate order is lon,lat
  const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'polyline6',
    steps: 'true',
  })
  return `${OSRM_BASE_URL}/route/v1/${OSRM_PROFILE}/${coords}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches the cycling route geometry and duration between two coordinates
 * from the OSRM routing API and returns a normalised {@link CyclingRoute}.
 *
 * The returned route includes:
 * - Total distance (metres) and estimated duration (seconds)
 * - Decoded geometry as an array of {lat, lon} pairs
 * - Derived checkpoints evenly spaced along the route
 *
 * @param id          - Caller-assigned identifier for this route.
 * @param name        - Human-readable name for display in the UI.
 * @param origin      - Start coordinate.
 * @param destination - End coordinate.
 * @param intermediateCheckpoints - How many intermediate checkpoints to derive (default: 3).
 * @returns A fully-populated {@link CyclingRoute}.
 * @throws {Error} When the OSRM API returns a non-OK HTTP status or a
 *                 non-`Ok` OSRM status code.
 */
export async function fetchCyclingRoute(
  id: string,
  name: string,
  origin: LatLon,
  destination: LatLon,
  intermediateCheckpoints = DEFAULT_INTERMEDIATE_CHECKPOINT_COUNT,
): Promise<CyclingRoute> {
  const url = buildRoutingUrl(origin, destination)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Routing request failed: ${response.status} ${response.statusText}`,
    )
  }

  const data = (await response.json()) as OsrmRouteResponse

  if (data.code !== 'Ok') {
    throw new Error(`OSRM returned status "${data.code}" — route could not be computed.`)
  }

  if (data.routes.length === 0) {
    throw new Error('OSRM returned no routes for the given coordinates.')
  }

  const best = data.routes[0]
  const geometry = decodePolyline(best.geometry)
  const checkpoints = deriveCheckpoints(geometry, intermediateCheckpoints)

  // Annotate each checkpoint with its cumulative distance.
  // We use a simple proportional estimate based on geometry index position
  // rather than summing Haversine segments, which keeps the seam lightweight.
  const annotatedCheckpoints: RouteCheckpoint[] = checkpoints.map((cp) => {
    const geomIndex = geometry.findIndex(
      (g) => g.lat === cp.position.lat && g.lon === cp.position.lon,
    )
    const fraction = geometry.length > 1 ? geomIndex / (geometry.length - 1) : 0
    return {
      ...cp,
      distanceFromOriginMetres: Math.round(fraction * best.distance),
    }
  })

  return {
    id,
    name,
    origin,
    destination,
    checkpoints: annotatedCheckpoints,
    distanceMetres: best.distance,
    durationSeconds: best.duration,
    geometry,
  }
}
