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
// These intentionally match the app's weather icon language: soft filled
// shapes, no hard outline iconography, and the same night-sky palette.
//
// Palette used:
//   - Moon light: #93C5FD (blue-300)
//   - Moon bright: #E2E8F0 (slate-200)
//   - Shadow: #334155 (slate-700)
//   - Craters: #CBD5E1 (slate-300)

const MOON_ICONS: Record<string, string> = {
  'New Moon': `
    <circle cx="32" cy="32" r="18" fill="#334155"/>
    <circle cx="32" cy="32" r="18" fill="url(#moon-shadow-glow)" opacity="0.25"/>
    <path d="M22 48 Q32 43 42 48" stroke="#475569" stroke-width="1.6" stroke-linecap="round" opacity="0.45"/>
    <circle cx="47" cy="18" r="1.6" fill="#E2E8F0" opacity="0.8"/>
    <circle cx="16" cy="22" r="1.2" fill="#E2E8F0" opacity="0.55"/>
    <circle cx="50" cy="42" r="1" fill="#E2E8F0" opacity="0.45"/>
    <defs>
      <radialGradient id="moon-shadow-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(30 26) rotate(50) scale(22)">
        <stop stop-color="#64748B"/>
        <stop offset="1" stop-color="#334155" stop-opacity="0"/>
      </radialGradient>
    </defs>`,

  'Waxing Crescent': `
    <circle cx="32" cy="32" r="18" fill="#334155"/>
    <path d="M32 14 C42 18 46 25 46 32 C46 39 42 46 32 50 C38 44 40 38 40 32 C40 26 38 20 32 14 Z" fill="#93C5FD"/>
    <path d="M35 18 C42 22 45 27 45 32 C45 37 42 42 35 46 C39 41 40.5 37 40.5 32 C40.5 27 39 23 35 18 Z" fill="#E2E8F0" opacity="0.55"/>
    <circle cx="37.5" cy="27.5" r="1.5" fill="#CBD5E1" opacity="0.18"/>
    <circle cx="39.5" cy="36" r="1" fill="#CBD5E1" opacity="0.16"/>
    <circle cx="47" cy="18" r="1.6" fill="#E2E8F0" opacity="0.8"/>
    <circle cx="16" cy="22" r="1.2" fill="#E2E8F0" opacity="0.55"/>
    <path d="M14 44l0.8 1.8L16.6 46l-1.8 0.8-0.8 1.8-0.8-1.8L11.4 46l1.8-0.2Z" fill="#E2E8F0" opacity="0.45"/>`,

  'First Quarter': `
    <circle cx="32" cy="32" r="18" fill="#334155"/>
    <path d="M32 14 A18 18 0 0 1 32 50 Z" fill="#93C5FD"/>
    <path d="M32 18 A14 14 0 0 1 32 46 Z" fill="#E2E8F0" opacity="0.38"/>
    <circle cx="37.5" cy="26.5" r="2" fill="#CBD5E1" opacity="0.24"/>
    <circle cx="39.5" cy="36.5" r="1.2" fill="#CBD5E1" opacity="0.18"/>`,

  'Waxing Gibbous': `
    <circle cx="32" cy="32" r="18" fill="#93C5FD"/>
    <path d="M32 14 C24 18 20 25 20 32 C20 39 24 46 32 50 C26 44 26 38 26 32 C26 26 26 20 32 14 Z" fill="#334155"/>
    <path d="M35 16 C42 20 45 26 45 32 C45 38 42 44 35 48" stroke="#E2E8F0" stroke-width="1.3" stroke-linecap="round" opacity="0.28"/>
    <circle cx="38" cy="26" r="2.1" fill="#E2E8F0" opacity="0.35"/>
    <circle cx="40.5" cy="34.5" r="1.4" fill="#E2E8F0" opacity="0.28"/>
    <circle cx="33.5" cy="39" r="1.8" fill="#CBD5E1" opacity="0.22"/>`,

  'Full Moon': `
    <circle cx="32" cy="32" r="18" fill="#93C5FD"/>
    <circle cx="32" cy="32" r="18" fill="url(#moon-full-glow)" opacity="0.25"/>
    <path d="M20 24 Q32 18 44 24" stroke="#E2E8F0" stroke-width="1.2" stroke-linecap="round" opacity="0.22"/>
    <circle cx="27" cy="28" r="2.3" fill="#CBD5E1" opacity="0.45"/>
    <circle cx="38" cy="35" r="2.8" fill="#CBD5E1" opacity="0.35"/>
    <circle cx="31" cy="39" r="1.7" fill="#CBD5E1" opacity="0.25"/>
    <circle cx="35" cy="23.5" r="1.2" fill="#E2E8F0" opacity="0.28"/>
    <circle cx="24.5" cy="34.5" r="1.1" fill="#E2E8F0" opacity="0.18"/>
    <defs>
      <radialGradient id="moon-full-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(28 24) rotate(50) scale(22)">
        <stop stop-color="#E2E8F0"/>
        <stop offset="1" stop-color="#93C5FD" stop-opacity="0"/>
      </radialGradient>
    </defs>`,

  'Waning Gibbous': `
    <circle cx="32" cy="32" r="18" fill="#93C5FD"/>
    <path d="M32 14 C40 18 44 25 44 32 C44 39 40 46 32 50 C38 44 38 38 38 32 C38 26 38 20 32 14 Z" fill="#334155"/>
    <path d="M29 16 C22 20 19 26 19 32 C19 38 22 44 29 48" stroke="#E2E8F0" stroke-width="1.3" stroke-linecap="round" opacity="0.28"/>
    <circle cx="26" cy="26" r="2.1" fill="#E2E8F0" opacity="0.35"/>
    <circle cx="23.5" cy="34.5" r="1.4" fill="#E2E8F0" opacity="0.28"/>
    <circle cx="30.5" cy="39" r="1.8" fill="#CBD5E1" opacity="0.22"/>`,

  'Last Quarter': `
    <circle cx="32" cy="32" r="18" fill="#334155"/>
    <path d="M32 14 A18 18 0 0 0 32 50 Z" fill="#93C5FD"/>
    <path d="M32 18 A14 14 0 0 0 32 46 Z" fill="#E2E8F0" opacity="0.38"/>
    <circle cx="26.5" cy="26.5" r="2" fill="#CBD5E1" opacity="0.24"/>
    <circle cx="24.5" cy="36.5" r="1.2" fill="#CBD5E1" opacity="0.18"/>`,

  'Waning Crescent': `
    <circle cx="32" cy="32" r="18" fill="#334155"/>
    <path d="M32 14 C22 18 18 25 18 32 C18 39 22 46 32 50 C26 44 24 38 24 32 C24 26 26 20 32 14 Z" fill="#93C5FD"/>
    <path d="M29 18 C22 22 19 27 19 32 C19 37 22 42 29 46 C25 41 23.5 37 23.5 32 C23.5 27 25 23 29 18 Z" fill="#E2E8F0" opacity="0.55"/>
    <circle cx="26.5" cy="27.5" r="1.5" fill="#CBD5E1" opacity="0.18"/>
    <circle cx="24.5" cy="36" r="1" fill="#CBD5E1" opacity="0.16"/>
    <circle cx="47" cy="18" r="1.6" fill="#E2E8F0" opacity="0.8"/>
    <circle cx="16" cy="22" r="1.2" fill="#E2E8F0" opacity="0.55"/>
    <path d="M50 44l0.8 1.8L53.6 46l-1.8 0.8-0.8 1.8-0.8-1.8L47.4 46l1.8-0.2Z" fill="#E2E8F0" opacity="0.45"/>`,
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
