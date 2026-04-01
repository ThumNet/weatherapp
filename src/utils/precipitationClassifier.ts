/**
 * Centralised precipitation classification utility.
 *
 * Both the precipitation store and the commute recommendation engine need to
 * decide what counts as "light", "moderate", or "heavy" rain. Keeping the
 * thresholds here avoids the values being duplicated across the codebase and
 * ensures consistent behaviour everywhere.
 */

import type { CommuteConditionRating } from '@/types/commute'

// ---------------------------------------------------------------------------
// Thresholds (mm/h)
// ---------------------------------------------------------------------------

/**
 * Minimum rate considered measurable rain (light drizzle).
 * Below this value precipitation is treated as dry / trace.
 *
 * This is the same value used by the precipitation store (`RAIN_THRESHOLD_MM_PER_HOUR`)
 * and by Open-Meteo's `precipitation_hours` count (≥ 0.1 mm threshold).
 */
export const RAIN_THRESHOLD_MM_PER_HOUR = 0.1

/**
 * Rate at which rain becomes heavy enough to downgrade a commute from
 * "marginal" to "poor". Corresponds roughly to moderate-to-heavy rain
 * on the Buienradar / KNMI scale (~2.5 mm/h is the WMO heavy-rain boundary).
 */
export const HEAVY_RAIN_THRESHOLD_MM_PER_HOUR = 2.5

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classifies a precipitation rate (mm/h) into a {@link CommuteConditionRating}.
 *
 * | Rate (mm/h)              | Rating       |
 * |--------------------------|--------------|
 * | < 0.1                    | `'good'`     |
 * | ≥ 0.1 and < 2.5          | `'marginal'` |
 * | ≥ 2.5                    | `'poor'`     |
 *
 * @param mmPerHour - Precipitation rate in mm per hour.
 * @returns A {@link CommuteConditionRating} suitable for display and scoring.
 */
export function classifyPrecipitation(mmPerHour: number): CommuteConditionRating {
  if (mmPerHour >= HEAVY_RAIN_THRESHOLD_MM_PER_HOUR) return 'poor'
  if (mmPerHour >= RAIN_THRESHOLD_MM_PER_HOUR) return 'marginal'
  return 'good'
}

/**
 * Returns `true` when the rate is at or above the heavy-rain threshold.
 *
 * Convenience predicate for guards that only care about the worst band
 * without needing the full classification string.
 *
 * @param mmPerHour - Precipitation rate in mm per hour.
 */
export function isHeavyRain(mmPerHour: number): boolean {
  return mmPerHour >= HEAVY_RAIN_THRESHOLD_MM_PER_HOUR
}

/**
 * Returns `true` when the rate is at or above the measurable-rain threshold.
 *
 * Mirrors the logic in the precipitation store's `isRainExpected` getter so
 * that callers outside the store can apply the same check without importing
 * the store.
 *
 * @param mmPerHour - Precipitation rate in mm per hour.
 */
export function isMeasurableRain(mmPerHour: number): boolean {
  return mmPerHour >= RAIN_THRESHOLD_MM_PER_HOUR
}
