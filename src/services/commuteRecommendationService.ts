/**
 * Commute recommendation engine.
 *
 * Given a resolved CyclingRoute and a precipitation forecast fetcher, the
 * engine evaluates departure slots across the next 2 hours (in 5-minute steps)
 * and recommends whether to leave now, wait for a better window, or avoid
 * cycling entirely.
 *
 * ## How it works
 *
 * 1. **Checkpoint derivation** – The route's checkpoints are used as-is.  For
 *    routes whose `durationSeconds` is longer than the Buienradar 2-hour
 *    horizon (7200 s) additional intermediate checkpoints are injected so that
 *    every 30-minute segment of the ride has at least one checkpoint to score.
 *
 * 2. **Time projection** – For each departure slot D and each checkpoint C at
 *    fractional position f along the route, the projected wall-clock arrival at
 *    C is:  D + f × durationSeconds.
 *
 * 3. **Precipitation sampling** – The Buienradar forecast is a list of (time,
 *    mmPerHour) tuples at 5-minute intervals for the next ~2 hours.  For each
 *    checkpoint arrival time, the engine looks up all forecast entries within a
 *    ±10-minute window and takes the **maximum** reading.  A missing window (no
 *    forecast data in range) returns 0 mm/h.
 *
 * 4. **Scoring** – Each checkpoint score is classified via
 *    `classifyPrecipitation()`.  A numeric penalty is computed per departure
 *    slot:
 *      penalty = Σ  weight(rating) × mmPerHour  for each checkpoint
 *    where  weight('good')=0, weight('marginal')=1, weight('poor')=4.
 *    This biases the engine strongly against heavy-rain windows.
 *
 * 5. **Decision** – The departure slot with the lowest penalty is the
 *    "best departure".  The action is then:
 *      - `'go'`    if the immediate departure (now) has the best or equal
 *                  penalty AND its overall rating is not 'poor'
 *      - `'wait'`  if a later slot has a meaningfully lower penalty (> 2 pts
 *                  improvement) and the best slot's overall rating is not 'poor'
 *      - `'avoid'` if every slot in the 2-hour window has at least one 'poor'
 *                  checkpoint rating
 *
 * ## Constraints / assumptions
 *
 * - Buienradar data covers NL only and up to ~2 hours ahead.  The engine
 *   cannot score departure times whose route ends beyond the forecast horizon;
 *   those checkpoints fall back to 0 mm/h (optimistic).
 * - Checkpoint labels come from the routing service ("Start", "Waypoint N",
 *   "Destination").  The engine does not rename them.
 * - The forecast fetch function is injected so the engine stays pure and
 *   testable.  The store wires in `fetchPrecipitationForecast` from
 *   `buienradarService`.
 */

import type { CyclingRoute, RouteCheckpoint, CheckpointScore, DepartureOption, CommuteRecommendationResult } from '@/types/commute'
import type { PrecipitationEntry } from '@/types/weather'
import { classifyPrecipitation } from '@/utils/precipitationClassifier'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Step between evaluated departure slots, in minutes */
const DEPARTURE_STEP_MINUTES = 5

/** Total window of departure slots to evaluate, in minutes */
const EVALUATION_WINDOW_MINUTES = 120

/** Buffer around a checkpoint arrival time when sampling precipitation, in minutes */
const CHECKPOINT_BUFFER_MINUTES = 10

/** Threshold penalty improvement (in penalty points) before recommending 'wait' over 'go' */
const WAIT_IMPROVEMENT_THRESHOLD = 2

/** Target maximum segment duration between checkpoints for longer routes, in seconds */
const MAX_SEGMENT_DURATION_SECONDS = 30 * 60 // 30 minutes

/** Penalty weights per rating — used for numeric scoring */
const RATING_PENALTY_WEIGHT: Record<string, number> = {
  good: 0,
  marginal: 1,
  poor: 4,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parses a Buienradar "HH:MM" time label into minutes-since-midnight using
 * the supplied reference Date to resolve the calendar date.
 *
 * We map the raw Buienradar time strings onto absolute minutes-since-midnight
 * values so we can compare them against projected arrival times.
 */
function buienradarTimeToDate(timeLabel: string, referenceDate: Date): Date {
  const [hStr, mStr] = timeLabel.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return new Date(NaN)

  // Build a Date in local time on the same calendar day as `referenceDate`.
  const result = new Date(referenceDate)
  result.setHours(h, m, 0, 0)

  // If the resulting time is more than 3 hours before the reference, the
  // forecast has wrapped past midnight — add a day.
  if (result.getTime() < referenceDate.getTime() - 3 * 60 * 60 * 1000) {
    result.setDate(result.getDate() + 1)
  }

  return result
}

/**
 * Samples the maximum precipitation within ±CHECKPOINT_BUFFER_MINUTES of
 * `targetTime` from the supplied forecast entries.
 *
 * Returns 0 if no entries fall within the window (optimistic — no data means
 * no known rain).
 */
function sampleMaxPrecipitation(
  entries: PrecipitationEntry[],
  targetTime: Date,
  referenceDate: Date,
): number {
  const bufferMs = CHECKPOINT_BUFFER_MINUTES * 60 * 1000
  const targetMs = targetTime.getTime()

  let maxMmPerHour = 0
  for (const entry of entries) {
    const entryDate = buienradarTimeToDate(entry.time, referenceDate)
    if (isNaN(entryDate.getTime())) continue
    const diffMs = Math.abs(entryDate.getTime() - targetMs)
    if (diffMs <= bufferMs) {
      if (entry.mmPerHour > maxMmPerHour) maxMmPerHour = entry.mmPerHour
    }
  }
  return maxMmPerHour
}

/**
 * Derives the list of checkpoints to score, injecting additional midpoints
 * when the route duration exceeds the threshold so that long routes always
 * have sufficient coverage within the Buienradar horizon.
 *
 * The returned list always includes Start (fraction 0) and Destination
 * (fraction 1).  For routes whose geometry already has checkpoints, those are
 * used.  Injected extra checkpoints are named "Waypoint N" with a position
 * interpolated along the geometry array.
 */
function resolveCheckpointsWithFractions(
  route: CyclingRoute,
): Array<{ checkpoint: RouteCheckpoint; fraction: number }> {
  const durationSecs = route.durationSeconds ?? 0

  // Start from the route's own checkpoints when available.
  if (route.checkpoints && route.checkpoints.length >= 2) {
    const base = route.checkpoints.map((cp, i) => ({
      checkpoint: cp,
      fraction: route.checkpoints!.length > 1 ? i / (route.checkpoints!.length - 1) : 0,
    }))

    // For routes longer than MAX_SEGMENT_DURATION_SECONDS, inject midpoints
    // between consecutive checkpoints whose projected travel time gap exceeds
    // the threshold.
    if (durationSecs <= MAX_SEGMENT_DURATION_SECONDS) return base

    const expanded: Array<{ checkpoint: RouteCheckpoint; fraction: number }> = []
    let injectedCount = 0

    for (let i = 0; i < base.length; i++) {
      expanded.push(base[i])
      if (i < base.length - 1) {
        const segmentDuration = (base[i + 1].fraction - base[i].fraction) * durationSecs
        if (segmentDuration > MAX_SEGMENT_DURATION_SECONDS) {
          // Inject a midpoint
          const midFraction = (base[i].fraction + base[i + 1].fraction) / 2
          const midPosition = interpolatePosition(route, midFraction)
          injectedCount++
          expanded.push({
            checkpoint: {
              label: `Segment ${injectedCount}`,
              position: midPosition,
            },
            fraction: midFraction,
          })
        }
      }
    }

    return expanded
  }

  // Fallback: derive standard checkpoints (start / quarter / mid / three-quarter / finish)
  // directly from the geometry when no checkpoints are stored.
  const fractions =
    durationSecs > MAX_SEGMENT_DURATION_SECONDS
      ? [0, 0.2, 0.4, 0.6, 0.8, 1.0] // extra density for long rides
      : [0, 0.25, 0.5, 0.75, 1.0]

  const labels: Record<number, string> = {
    0: 'Start',
    0.25: 'Quarter',
    0.5: 'Midpoint',
    0.75: 'Three-quarter',
    1.0: 'Destination',
    0.2: 'Waypoint 1',
    0.4: 'Waypoint 2',
    0.6: 'Waypoint 3',
    0.8: 'Waypoint 4',
  }

  return fractions.map((f) => ({
    checkpoint: {
      label: labels[f] ?? `Waypoint (${Math.round(f * 100)}%)`,
      position: interpolatePosition(route, f),
    },
    fraction: f,
  }))
}

/**
 * Interpolates a position along the route geometry at fractional distance `f`
 * (0 = origin, 1 = destination).
 *
 * Falls back to a direct lerp between origin and destination when no geometry
 * is available.
 */
function interpolatePosition(route: CyclingRoute, f: number): { lat: number; lon: number } {
  const geometry = route.geometry
  if (!geometry || geometry.length === 0) {
    return {
      lat: route.origin.lat + (route.destination.lat - route.origin.lat) * f,
      lon: route.origin.lon + (route.destination.lon - route.origin.lon) * f,
    }
  }
  const idx = Math.min(Math.floor(f * (geometry.length - 1)), geometry.length - 2)
  const localF = f * (geometry.length - 1) - idx
  const a = geometry[idx]
  const b = geometry[idx + 1]
  return {
    lat: a.lat + (b.lat - a.lat) * localF,
    lon: a.lon + (b.lon - a.lon) * localF,
  }
}

/**
 * Computes the worst `CommuteConditionRating` across an array of checkpoint
 * scores. Returns 'good' for an empty array.
 */
function worstRating(scores: CheckpointScore[]): 'good' | 'marginal' | 'poor' {
  let worst: 'good' | 'marginal' | 'poor' = 'good'
  for (const s of scores) {
    if (s.rating === 'poor') return 'poor'
    if (s.rating === 'marginal') worst = 'marginal'
  }
  return worst
}

/**
 * Computes a numeric penalty for a set of checkpoint scores.
 *
 * Penalty = Σ  weight(rating) × mmPerHour
 * This makes a single heavy-rain checkpoint (≥ 2.5 mm/h) contribute
 * significantly more than multiple marginal checkpoints.
 */
function computePenalty(scores: CheckpointScore[]): number {
  return scores.reduce((acc, s) => {
    const weight = RATING_PENALTY_WEIGHT[s.rating] ?? 0
    return acc + weight * s.mmPerHour
  }, 0)
}

// ---------------------------------------------------------------------------
// Public forecast-fetcher type
// ---------------------------------------------------------------------------

/**
 * Function signature for a Buienradar-style forecast fetcher.
 * Injected by the caller so the engine stays pure.
 */
export type PrecipitationFetcher = (lat: number, lon: number) => Promise<PrecipitationEntry[]>

// ---------------------------------------------------------------------------
// Per-checkpoint scoring
// ---------------------------------------------------------------------------

/**
 * Scores a single checkpoint for a given departure time using the provided
 * pre-fetched forecast entries.
 */
function scoreCheckpoint(
  cp: RouteCheckpoint,
  fraction: number,
  departureTime: Date,
  durationSeconds: number,
  forecastEntries: PrecipitationEntry[],
  referenceDate: Date,
): CheckpointScore {
  const travelOffsetMs = fraction * durationSeconds * 1000
  const projectedArrival = new Date(departureTime.getTime() + travelOffsetMs)

  const mmPerHour = sampleMaxPrecipitation(forecastEntries, projectedArrival, referenceDate)
  const rating = classifyPrecipitation(mmPerHour)

  return {
    checkpoint: cp,
    routeFraction: fraction,
    projectedArrival,
    mmPerHour,
    rating,
    isRisky: rating !== 'good',
  }
}

// ---------------------------------------------------------------------------
// Single departure slot evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a single departure slot, scoring all checkpoints and computing
 * the aggregate penalty.
 */
function evaluateDeparture(
  departureTime: Date,
  checkpointsWithFractions: Array<{ checkpoint: RouteCheckpoint; fraction: number }>,
  durationSeconds: number,
  forecastEntries: PrecipitationEntry[],
  referenceDate: Date,
): DepartureOption {
  const checkpointScores = checkpointsWithFractions.map(({ checkpoint, fraction }) =>
    scoreCheckpoint(
      checkpoint,
      fraction,
      departureTime,
      durationSeconds,
      forecastEntries,
      referenceDate,
    ),
  )

  const overallRating = worstRating(checkpointScores)
  const penaltyScore = computePenalty(checkpointScores)
  const riskyCheckpoints = checkpointScores.filter((s) => s.isRisky)

  return {
    departureTime,
    checkpointScores,
    overallRating,
    penaltyScore,
    riskyCheckpoints,
  }
}

// ---------------------------------------------------------------------------
// Explanation builder
// ---------------------------------------------------------------------------

/**
 * Produces a human-readable explanation string for the recommendation result.
 */
function buildExplanation(
  action: 'go' | 'wait' | 'avoid',
  bestDeparture: DepartureOption,
  nowDeparture: DepartureOption,
): string {
  const formatTime = (d: Date): string =>
    d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

  const riskyLabels = (departure: DepartureOption): string => {
    const labels = departure.riskyCheckpoints.map((s) => s.checkpoint.label)
    if (labels.length === 0) return ''
    if (labels.length === 1) return labels[0]
    return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  }

  if (action === 'go') {
    if (nowDeparture.riskyCheckpoints.length === 0) {
      return 'Conditions look clear along the entire route. Good time to leave!'
    }
    const labels = riskyLabels(nowDeparture)
    const rating = nowDeparture.overallRating
    return `Conditions are ${rating} near ${labels}, but this is the best window in the next 2 hours.`
  }

  if (action === 'wait') {
    const betterAt = formatTime(bestDeparture.departureTime)
    if (bestDeparture.riskyCheckpoints.length === 0) {
      return `Conditions improve around ${betterAt}. Consider waiting for a drier window.`
    }
    const labels = riskyLabels(bestDeparture)
    return `Conditions improve around ${betterAt}, though some rain is still expected near ${labels}.`
  }

  // avoid
  const worstLabels = riskyLabels(bestDeparture)
  if (worstLabels) {
    return `Heavy rain is expected along the route (near ${worstLabels}) for the next 2 hours. Consider an alternative.`
  }
  return 'Difficult conditions expected along the entire route for the next 2 hours. Consider an alternative.'
}

// ---------------------------------------------------------------------------
// Main engine entry-point
// ---------------------------------------------------------------------------

/**
 * Evaluates bike commute conditions for the given route across all departure
 * slots from `now` to `now + 2 hours` (in 5-minute steps).
 *
 * **This function makes one Buienradar API request per unique checkpoint
 * position.**  For a 5-checkpoint route that is 3 distinct lat/lon pairs,
 * that is 3 network requests.  Callers should guard against calling this
 * function too frequently.
 *
 * @param route      A fully-resolved CyclingRoute (with geometry + checkpoints)
 * @param fetchFn    Injected precipitation-fetcher (usually fetchPrecipitationForecast)
 * @param now        Reference "current time" — defaults to `new Date()`
 * @returns          A CommuteRecommendationResult
 */
export async function evaluateCommuteRecommendation(
  route: CyclingRoute,
  fetchFn: PrecipitationFetcher,
  now: Date = new Date(),
): Promise<CommuteRecommendationResult> {
  const durationSeconds = route.durationSeconds ?? 0

  // 1. Resolve checkpoints (with fractions) —————————————————————————————————
  const checkpointsWithFractions = resolveCheckpointsWithFractions(route)

  // 2. Fetch precipitation forecasts for every unique checkpoint position ————
  //    We deduplicate by rounded lat/lon (3 decimal places ≈ 111 m precision)
  //    to avoid redundant requests for nearby checkpoints.
  const forecastCache = new Map<string, PrecipitationEntry[]>()

  async function getForecastForPosition(lat: number, lon: number): Promise<PrecipitationEntry[]> {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
    if (forecastCache.has(key)) return forecastCache.get(key)!
    try {
      const entries = await fetchFn(lat, lon)
      forecastCache.set(key, entries)
      return entries
    } catch {
      // On fetch failure, return empty — engine will treat as 0 mm/h
      forecastCache.set(key, [])
      return []
    }
  }

  // Pre-fetch all forecasts in parallel
  await Promise.all(
    checkpointsWithFractions.map(({ checkpoint }) =>
      getForecastForPosition(checkpoint.position.lat, checkpoint.position.lon),
    ),
  )

  // 3. Build departure slots ——————————————————————————————————————————————————
  const departureTimes: Date[] = []
  const totalSlots = EVALUATION_WINDOW_MINUTES / DEPARTURE_STEP_MINUTES + 1 // inclusive of t+120
  for (let i = 0; i < totalSlots; i++) {
    departureTimes.push(new Date(now.getTime() + i * DEPARTURE_STEP_MINUTES * 60 * 1000))
  }

  // 4. Score all departure slots ——————————————————————————————————————————————
  const allDepartures: DepartureOption[] = departureTimes.map((departureTime) => {
    // For each checkpoint, look up the cached forecast for its position
    const checkpointScores = checkpointsWithFractions.map(({ checkpoint, fraction }) => {
      const key = `${checkpoint.position.lat.toFixed(3)},${checkpoint.position.lon.toFixed(3)}`
      const forecastEntries = forecastCache.get(key) ?? []
      return scoreCheckpoint(
        checkpoint,
        fraction,
        departureTime,
        durationSeconds,
        forecastEntries,
        now,
      )
    })

    const overallRating = worstRating(checkpointScores)
    const penaltyScore = computePenalty(checkpointScores)
    const riskyCheckpoints = checkpointScores.filter((s) => s.isRisky)

    return {
      departureTime,
      checkpointScores,
      overallRating,
      penaltyScore,
      riskyCheckpoints,
    }
  })

  // 5. Find best departure —————————————————————————————————————————————————
  const bestDeparture = allDepartures.reduce((best, current) =>
    current.penaltyScore < best.penaltyScore ? current : best,
  )

  const nowDeparture = allDepartures[0] // departure right now

  // 6. Determine action ————————————————————————————————————————————————————
  //
  //  'avoid'  – best slot still has at least one 'poor' checkpoint
  //  'go'     – nowDeparture is the best (or tied best) and is not 'poor'
  //  'wait'   – a later slot is meaningfully better than now (>threshold gap)
  //
  let action: 'go' | 'wait' | 'avoid'

  if (bestDeparture.overallRating === 'poor') {
    action = 'avoid'
  } else {
    const improvementOverNow = nowDeparture.penaltyScore - bestDeparture.penaltyScore
    if (
      bestDeparture.departureTime.getTime() === nowDeparture.departureTime.getTime() ||
      improvementOverNow <= WAIT_IMPROVEMENT_THRESHOLD
    ) {
      action = 'go'
    } else {
      action = 'wait'
    }
  }

  // 7. Build explanation ——————————————————————————————————————————————————
  const explanation = buildExplanation(action, bestDeparture, nowDeparture)

  return {
    action,
    bestDeparture,
    allDepartures,
    explanation,
    generatedAt: now.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------
export { resolveCheckpointsWithFractions, sampleMaxPrecipitation, evaluateDeparture }
