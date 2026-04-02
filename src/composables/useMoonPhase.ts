/**
 * useMoonPhase
 *
 * Computes the current moon phase from the current date using the
 * Julian Day Number method. No external API is required.
 *
 * The synodic month (new moon → new moon) is ~29.53059 days.
 * Phase is expressed as a value 0–1 (0 = new moon, 0.5 = full moon).
 *
 * Returns:
 *  - phaseFraction: 0–1 value representing where we are in the lunar cycle
 *  - phaseName:     Human-readable phase label
 *  - phaseIcon:     SVG markup for the moon phase icon
 */

export interface MoonPhaseInfo {
  phaseFraction: number
  phaseName: string
  phaseIcon: string
}

/** Synodic month in days */
const SYNODIC_MONTH = 29.53059

/**
 * Compute the moon phase fraction (0–1) for a given date.
 * Uses the Julian Day Number approach relative to a known new moon.
 * Reference new moon: 2000-01-06 18:14 UTC (JDN 2451550.259)
 */
export function getMoonPhaseFraction(date: Date = new Date()): number {
  // Julian Day Number
  const jd =
    date.getTime() / 86400000 + 2440587.5
  const daysSinceNew = (jd - 2451550.259) % SYNODIC_MONTH
  const fraction = (daysSinceNew < 0 ? daysSinceNew + SYNODIC_MONTH : daysSinceNew) / SYNODIC_MONTH
  return fraction
}

/**
 * Map a phase fraction to a human-readable name.
 * Uses 8 named phases covering the full cycle.
 */
export function getMoonPhaseName(fraction: number): string {
  const p = fraction
  if (p < 0.0625 || p >= 0.9375) return 'New Moon'
  if (p < 0.1875) return 'Waxing Crescent'
  if (p < 0.3125) return 'First Quarter'
  if (p < 0.4375) return 'Waxing Gibbous'
  if (p < 0.5625) return 'Full Moon'
  if (p < 0.6875) return 'Waning Gibbous'
  if (p < 0.8125) return 'Last Quarter'
  return 'Waning Crescent'
}

// ---------------------------------------------------------------------------
// SVG moon phase icons (viewBox 0 0 64 64)
// ---------------------------------------------------------------------------
// All icons use a dark-circle base (#1E293B, slate-800) with a light disc
// (#E2E8F0, slate-200) to show the illuminated portion. Works in both
// light and dark mode.

const MOON_ICONS: Record<string, string> = {
  'New Moon': `
    <circle cx="32" cy="32" r="22" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>`,

  'Waxing Crescent': `
    <circle cx="32" cy="32" r="22" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <path d="M32 10 Q50 18 50 32 Q50 46 32 54 Q42 46 42 32 Q42 18 32 10 Z" fill="#E2E8F0"/>`,

  'First Quarter': `
    <circle cx="32" cy="32" r="22" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <path d="M32 10 Q54 10 54 32 Q54 54 32 54 Z" fill="#E2E8F0"/>`,

  'Waxing Gibbous': `
    <circle cx="32" cy="32" r="22" fill="#E2E8F0"/>
    <path d="M32 10 Q14 18 14 32 Q14 46 32 54 Q22 46 22 32 Q22 18 32 10 Z" fill="#1E293B"/>`,

  'Full Moon': `
    <circle cx="32" cy="32" r="22" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1"/>
    <circle cx="26" cy="28" r="3" fill="#CBD5E1" opacity="0.5"/>
    <circle cx="38" cy="36" r="4" fill="#CBD5E1" opacity="0.4"/>
    <circle cx="30" cy="38" r="2" fill="#CBD5E1" opacity="0.35"/>`,

  'Waning Gibbous': `
    <circle cx="32" cy="32" r="22" fill="#E2E8F0"/>
    <path d="M32 10 Q50 18 50 32 Q50 46 32 54 Q42 46 42 32 Q42 18 32 10 Z" fill="#1E293B"/>`,

  'Last Quarter': `
    <circle cx="32" cy="32" r="22" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <path d="M32 10 Q10 10 10 32 Q10 54 32 54 Z" fill="#E2E8F0"/>`,

  'Waning Crescent': `
    <circle cx="32" cy="32" r="22" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
    <path d="M32 10 Q14 18 14 32 Q14 46 32 54 Q22 46 22 32 Q22 18 32 10 Z" fill="#E2E8F0"/>`,
}

export function getMoonPhaseIcon(phaseName: string): string {
  return MOON_ICONS[phaseName] ?? MOON_ICONS['New Moon']!
}

export function useMoonPhase(date?: Date): MoonPhaseInfo {
  const phaseFraction = getMoonPhaseFraction(date)
  const phaseName = getMoonPhaseName(phaseFraction)
  const phaseIcon = getMoonPhaseIcon(phaseName)
  return { phaseFraction, phaseName, phaseIcon }
}
