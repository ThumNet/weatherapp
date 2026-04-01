// TypeScript interfaces for the bike commute recommendation feature

// ---------------------------------------------------------------------------
// Geographic primitives
// ---------------------------------------------------------------------------

/** A single latitude/longitude coordinate pair */
export interface LatLon {
  lat: number
  lon: number
}

// ---------------------------------------------------------------------------
// Commute endpoints (persisted home / work settings)
// ---------------------------------------------------------------------------

/**
 * A saved commute endpoint (home or work).
 *
 * Both fields are required when an endpoint has been set by the user.
 * The store uses `null` to represent "not yet configured".
 */
export interface CommuteEndpoint {
  /** Geographic position of this endpoint */
  position: LatLon
  /** Human-readable name shown in the UI (e.g. city or address string) */
  name: string
}

// ---------------------------------------------------------------------------
// Route geometry
// ---------------------------------------------------------------------------

/**
 * A named waypoint along a cycling route with optional distance information.
 *
 * Checkpoints are used to sample precipitation conditions at multiple points
 * along the route rather than only at the start or end.
 */
export interface RouteCheckpoint {
  /** Human-readable label shown in the UI (e.g. "Start", "Overtoom", "Destination") */
  label: string
  /** Geographic position of this checkpoint */
  position: LatLon
  /**
   * Cumulative distance from the route origin to this checkpoint, in metres.
   * Optional — may be absent before the route geometry is resolved.
   */
  distanceFromOriginMetres?: number
}

/**
 * A cycling route between two endpoints.
 *
 * Returned by the routing service after the geometry is resolved.
 * A minimal "pending" route (before the API call completes) will only have
 * origin/destination set; all other fields are optional so that partial
 * objects can be stored while loading.
 */
export interface CyclingRoute {
  /** Unique identifier for this route (caller-assigned, e.g. UUID or slug) */
  id: string
  /** Human-readable name shown in the UI */
  name: string
  /** Start of the route */
  origin: LatLon
  /** End of the route */
  destination: LatLon
  /**
   * Intermediate checkpoints including start and end.
   * Absent until the routing API resolves the geometry.
   */
  checkpoints?: RouteCheckpoint[]
  /**
   * Total route distance in metres.
   * Absent until the routing API resolves the geometry.
   */
  distanceMetres?: number
  /**
   * Estimated cycling duration in seconds (assumes a typical cycling speed
   * as returned by the routing API).
   * Absent until the routing API resolves the geometry.
   */
  durationSeconds?: number
  /**
   * Decoded polyline geometry as an array of [lat, lon] pairs.
   * Absent until the routing API resolves the geometry.
   */
  geometry?: LatLon[]
}

// ---------------------------------------------------------------------------
// Raw OSRM / routing API response shapes
// ---------------------------------------------------------------------------

/**
 * A single step within an OSRM route leg.
 * Only the fields consumed by this app are modelled here.
 */
export interface OsrmRouteStep {
  distance: number
  duration: number
  name: string
  maneuver: {
    location: [number, number] // [lon, lat]
    type: string
    modifier?: string
  }
}

/** A leg (segment between two waypoints) within an OSRM route */
export interface OsrmRouteLeg {
  distance: number
  duration: number
  steps: OsrmRouteStep[]
}

/**
 * A single route object from the OSRM route response.
 * https://project-osrm.org/docs/v5.5.1/api/#route-object
 */
export interface OsrmRoute {
  distance: number
  duration: number
  /** Encoded polyline geometry (polyline6 by default) */
  geometry: string
  legs: OsrmRouteLeg[]
}

/**
 * Top-level OSRM route response.
 * Returned by /route/v1/{profile}/{coordinates}
 */
export interface OsrmRouteResponse {
  code: string
  routes: OsrmRoute[]
  waypoints: Array<{
    name: string
    location: [number, number] // [lon, lat]
    distance: number
    hint: string
  }>
}

// ---------------------------------------------------------------------------
// Route bounds
// ---------------------------------------------------------------------------

/**
 * Axis-aligned bounding box that encloses a route's geometry.
 *
 * Useful for fitting a map view to a route without iterating over the full
 * geometry array each time the value is needed.
 */
export interface RouteBounds {
  /** Northernmost latitude */
  north: number
  /** Southernmost latitude */
  south: number
  /** Easternmost longitude */
  east: number
  /** Westernmost longitude */
  west: number
}

// ---------------------------------------------------------------------------
// Commute recommendation
// ---------------------------------------------------------------------------

/**
 * Categorical assessment of conditions for a bike commute.
 *
 * - `'good'`     – dry or very light precipitation; comfortable cycling
 * - `'marginal'` – light rain expected; consider rain gear
 * - `'poor'`     – heavy rain expected; cycling is unpleasant or unsafe
 */
export type CommuteConditionRating = 'good' | 'marginal' | 'poor'

/**
 * Per-checkpoint weather snapshot used when building a recommendation.
 *
 * Populated by sampling the Buienradar or Open-Meteo data at each
 * checkpoint position.
 */
export interface CheckpointWeatherSample {
  checkpoint: RouteCheckpoint
  /** Precipitation intensity at this checkpoint at the sampled time, in mm/h */
  mmPerHour: number
  /** Classification derived from `classifyPrecipitation()` */
  rating: CommuteConditionRating
}

/**
 * The full recommendation result for a planned bike commute.
 *
 * Produced by the commute scoring logic and consumed by the UI.
 */
export interface CommuteRecommendation {
  /** The route this recommendation applies to */
  route: CyclingRoute
  /**
   * Overall condition rating — the worst rating across all checkpoints
   * for the planned departure window.
   */
  overallRating: CommuteConditionRating
  /**
   * Per-checkpoint breakdown so the UI can highlight the worst segments.
   * Empty when no precipitation data is available.
   */
  checkpointSamples: CheckpointWeatherSample[]
  /**
   * Human-readable summary sentence for display in the UI.
   * Generated by the recommendation engine.
   */
  summary: string
  /**
   * ISO 8601 timestamp at which this recommendation was generated.
   * Used to detect stale results.
   */
  generatedAt: string
  /**
   * Planned departure time as an ISO 8601 string.
   * The recommendation is valid for this point in time.
   */
  departureTime: string
}

// ---------------------------------------------------------------------------
// Recommendation engine — departure scoring
// ---------------------------------------------------------------------------

/**
 * Weather score for a single checkpoint at a specific projected arrival time.
 *
 * The engine samples the ±10-minute window around the arrival time and takes
 * the worst reading within that window.
 */
export interface CheckpointScore {
  /** The checkpoint this score applies to */
  checkpoint: RouteCheckpoint
  /**
   * Fractional position along the route (0 = start, 1 = end).
   * Used to derive the projected arrival offset from departure.
   */
  routeFraction: number
  /** Projected wall-clock arrival at this checkpoint as a Date */
  projectedArrival: Date
  /** Highest precipitation rate (mm/h) found in the ±10-minute sample window */
  mmPerHour: number
  /** Classification of `mmPerHour` */
  rating: CommuteConditionRating
  /** Whether this checkpoint is considered risky (rating is not 'good') */
  isRisky: boolean
}

/**
 * The scored assessment of a single candidate departure time.
 *
 * The engine generates one `DepartureOption` for each departure slot it
 * evaluates (now + every 5 minutes for the next 2 hours).
 */
export interface DepartureOption {
  /** Candidate departure time */
  departureTime: Date
  /** Per-checkpoint breakdown */
  checkpointScores: CheckpointScore[]
  /** Worst rating across all checkpoints */
  overallRating: CommuteConditionRating
  /**
   * Numeric penalty score (lower = better).
   * 0 = all clear, higher = more/worse rain.
   */
  penaltyScore: number
  /** Checkpoints flagged as risky (rating != 'good') */
  riskyCheckpoints: CheckpointScore[]
}

/**
 * Top-level output of the recommendation engine for a full evaluation run.
 */
export interface CommuteRecommendationResult {
  /**
   * Action the engine recommends.
   * - `'go'`   – conditions are good for all or most of the route now
   * - `'wait'` – a better departure window exists within the next 2 hours
   * - `'avoid'` – no good window found in the next 2 hours
   */
  action: 'go' | 'wait' | 'avoid'
  /** The best-scoring departure option found by the engine */
  bestDeparture: DepartureOption
  /** All evaluated departure slots, sorted by departure time */
  allDepartures: DepartureOption[]
  /**
   * Human-readable explanation of the recommendation, referencing
   * the specific risky checkpoint(s) when applicable.
   */
  explanation: string
  /** ISO 8601 timestamp at which the result was computed */
  generatedAt: string
}
