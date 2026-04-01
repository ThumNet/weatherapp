/**
 * WMO Weather interpretation codes (WW)
 * https://open-meteo.com/en/docs#weathervariables
 */

// ---------------------------------------------------------------------------
// Intensity variant type
// ---------------------------------------------------------------------------

/**
 * Optional precipitation / severity intensity hint.
 *
 * - `'light'`    – drizzle, light rain/snow, gentle showers
 * - `'moderate'` – typical rain/snow, normal showers
 * - `'heavy'`    – heavy rain/snow, violent showers, hail storms
 *
 * When omitted the icon is derived purely from the WMO weather code
 * (same behaviour as the legacy `getWeatherIcon` function).
 */
export type WeatherIntensity = 'light' | 'moderate' | 'heavy'

interface WeatherCodeMeta {
  description: string
  /** Emoji fallback (kept for non-SVG usage and legacy callers) */
  icon: string
  /** SVG icon key for the WeatherIcon component */
  svgKey: SvgIconKey
}

// ---------------------------------------------------------------------------
// SVG icon key union
// ---------------------------------------------------------------------------

/**
 * All SVG icon variants available in the icon system.
 *
 * Precipitation-related states have distinct variants per intensity level;
 * non-precipitation states have a single variant.
 */
export type SvgIconKey =
  | 'clear-day'
  | 'mostly-clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle-light'
  | 'drizzle-moderate'
  | 'drizzle-heavy'
  | 'rain-light'
  | 'rain-moderate'
  | 'rain-heavy'
  | 'showers-light'
  | 'showers-moderate'
  | 'showers-heavy'
  | 'freezing-drizzle-light'
  | 'freezing-drizzle-heavy'
  | 'freezing-rain-light'
  | 'freezing-rain-heavy'
  | 'snow-light'
  | 'snow-moderate'
  | 'snow-heavy'
  | 'snow-showers-light'
  | 'snow-showers-heavy'
  | 'fog-icy'
  | 'thunderstorm'
  | 'thunderstorm-hail'
  | 'thunderstorm-hail-heavy'
  | 'unknown'

// ---------------------------------------------------------------------------
// SVG path definitions (inline, viewBox 0 0 64 64)
// ---------------------------------------------------------------------------

/**
 * Inline SVG markup strings (inner content of <svg viewBox="0 0 64 64">).
 * All icons use currentColor where appropriate and work in both light/dark mode.
 *
 * Colour tokens used:
 *   - Sun:         #FBBF24 (amber-400)
 *   - Cloud body:  #CBD5E1 (slate-300) / #94A3B8 (slate-400) for shadow
 *   - Rain drops:  #60A5FA (blue-400)
 *   - Snow:        #BAE6FD (sky-200)
 *   - Lightning:   #FDE68A (amber-200)
 *   - Hail:        #E0F2FE (sky-100) with #7DD3FC border
 *   - Fog lines:   #94A3B8 (slate-400)
 *   - Freeze:      #BAE6FD (sky-200) lines / #7DD3FC (sky-300) pellet diamonds
 *   - Dark cloud:  #64748B (slate-500) — used for heavy/storm variants
 */
export const SVG_ICONS: Record<SvgIconKey, string> = {
  // ── Clear ──────────────────────────────────────────────────────────────────
  'clear-day': `
    <circle cx="32" cy="32" r="13" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="3" stroke-linecap="round">
      <line x1="32" y1="7"  x2="32" y2="13"/>
      <line x1="32" y1="51" x2="32" y2="57"/>
      <line x1="7"  y1="32" x2="13" y2="32"/>
      <line x1="51" y1="32" x2="57" y2="32"/>
      <line x1="14" y1="14" x2="18" y2="18"/>
      <line x1="46" y1="46" x2="50" y2="50"/>
      <line x1="50" y1="14" x2="46" y2="18"/>
      <line x1="18" y1="46" x2="14" y2="50"/>
    </g>`,

  // ── Mainly clear ───────────────────────────────────────────────────────────
  'mostly-clear': `
    <circle cx="26" cy="26" r="10" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="2.5" stroke-linecap="round">
      <line x1="26" y1="6"  x2="26" y2="11"/>
      <line x1="26" y1="41" x2="26" y2="46"/>
      <line x1="6"  y1="26" x2="11" y2="26"/>
      <line x1="41" y1="26" x2="46" y2="26"/>
      <line x1="12" y1="12" x2="15" y2="15"/>
      <line x1="37" y1="37" x2="40" y2="40"/>
      <line x1="40" y1="12" x2="37" y2="15"/>
      <line x1="15" y1="37" x2="12" y2="40"/>
    </g>
    <path d="M36 40 Q36 30 44 30 Q42 24 36 24 Q34 18 27 20 Q22 14 16 20 Q10 20 10 28 Q10 40 20 40 Z" fill="#CBD5E1"/>`,

  // ── Partly cloudy ──────────────────────────────────────────────────────────
  'partly-cloudy': `
    <circle cx="24" cy="22" r="10" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="2.5" stroke-linecap="round">
      <line x1="24" y1="4"  x2="24" y2="9"/>
      <line x1="4"  y1="22" x2="9"  y2="22"/>
      <line x1="10" y1="8"  x2="14" y2="12"/>
      <line x1="38" y1="8"  x2="34" y2="12"/>
    </g>
    <path d="M42 46 Q42 34 51 34 Q49 27 42 27 Q40 20 32 22 Q26 15 19 22 Q12 22 12 31 Q12 46 24 46 Z" fill="#CBD5E1"/>`,

  // ── Overcast ───────────────────────────────────────────────────────────────
  'overcast': `
    <path d="M50 44 Q50 32 58 32 Q56 24 49 24 Q47 16 38 18 Q32 10 23 18 Q15 18 15 28 Q15 44 28 44 Z" fill="#94A3B8"/>
    <path d="M44 52 Q44 42 51 42 Q49 36 43 36 Q41 29 34 31 Q29 25 22 31 Q16 31 16 39 Q16 52 27 52 Z" fill="#CBD5E1"/>`,

  // ── Fog ────────────────────────────────────────────────────────────────────
  'fog': `
    <path d="M14 20 Q22 14 32 20 Q42 14 50 20" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M14 32 Q22 26 32 32 Q42 26 50 32" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M14 44 Q22 38 32 44 Q42 38 50 44" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" fill="none"/>
    <line x1="20" y1="56" x2="44" y2="56" stroke="#CBD5E1" stroke-width="3" stroke-linecap="round"/>`,

  // ── Icy fog (WMO 48) ───────────────────────────────────────────────────────
  // Same three wavy fog lines as 'fog', but ice-crystal diamonds replace the
  // bottom baseline — shape-first differentiation readable at small sizes.
  // Diamond points: top, right, bottom, left (cx±4, cy±4 axes).
  'fog-icy': `
    <path d="M14 20 Q22 14 32 20 Q42 14 50 20" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M14 32 Q22 26 32 32 Q42 26 50 32" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M14 44 Q22 38 32 44 Q42 38 50 44" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" fill="none"/>
    <polygon points="22,52 26,56 22,60 18,56" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="1"/>
    <polygon points="32,52 36,56 32,60 28,56" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="1"/>
    <polygon points="42,52 46,56 42,60 38,56" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="1"/>`,

  // ── Drizzle ────────────────────────────────────────────────────────────────
  // Short, fine marks (length ≈5, stroke-width 1.5) — clearly lighter than rain
  'drizzle-light': `
    <path d="M46 36 Q46 24 54 24 Q52 16 45 16 Q43 8 34 10 Q28 4 21 10 Q14 10 14 20 Q14 36 28 36 Z" fill="#CBD5E1"/>
    <line x1="24" y1="44" x2="23" y2="49" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="34" y1="44" x2="33" y2="49" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>`,

  'drizzle-moderate': `
    <path d="M46 36 Q46 24 54 24 Q52 16 45 16 Q43 8 34 10 Q28 4 21 10 Q14 10 14 20 Q14 36 28 36 Z" fill="#94A3B8"/>
    <line x1="22" y1="43" x2="21" y2="48" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="32" y1="43" x2="31" y2="48" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="42" y1="43" x2="41" y2="48" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>`,

  'drizzle-heavy': `
    <path d="M46 36 Q46 24 54 24 Q52 16 45 16 Q43 8 34 10 Q28 4 21 10 Q14 10 14 20 Q14 36 28 36 Z" fill="#64748B"/>
    <line x1="20" y1="42" x2="19" y2="47" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="29" y1="42" x2="28" y2="47" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="38" y1="42" x2="37" y2="47" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="47" y1="42" x2="46" y2="47" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round"/>`,

  // ── Rain ───────────────────────────────────────────────────────────────────
  // Medium streaks (length ≈10, stroke-width 2.5) — clearly heavier than drizzle
  'rain-light': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#CBD5E1"/>
    <line x1="24" y1="42" x2="21" y2="52" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="36" y1="42" x2="33" y2="52" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>`,

  'rain-moderate': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#94A3B8"/>
    <line x1="22" y1="41" x2="19" y2="51" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="41" x2="29" y2="51" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="42" y1="41" x2="39" y2="51" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>`,

  // Long, bold streaks (length ≈15, stroke-width 3) — unmistakably heavy
  'rain-heavy': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#64748B"/>
    <line x1="19" y1="40" x2="14" y2="55" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
    <line x1="29" y1="40" x2="24" y2="55" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
    <line x1="39" y1="40" x2="34" y2="55" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
    <line x1="49" y1="40" x2="44" y2="55" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>`,

  // ── Showers (sun + cloud + drops) ─────────────────────────────────────────
  'showers-light': `
    <circle cx="20" cy="20" r="9" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="2" stroke-linecap="round">
      <line x1="20" y1="4"  x2="20" y2="8"/>
      <line x1="4"  y1="20" x2="8"  y2="20"/>
      <line x1="8"  y1="8"  x2="11" y2="11"/>
      <line x1="32" y1="8"  x2="29" y2="11"/>
    </g>
    <path d="M50 40 Q50 30 57 30 Q55 23 49 23 Q47 17 40 19 Q35 13 28 19 Q22 19 22 27 Q22 40 33 40 Z" fill="#CBD5E1"/>
    <line x1="30" y1="48" x2="28" y2="56" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="40" y1="48" x2="38" y2="56" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>`,

  'showers-moderate': `
    <circle cx="20" cy="20" r="9" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="2" stroke-linecap="round">
      <line x1="20" y1="4"  x2="20" y2="8"/>
      <line x1="4"  y1="20" x2="8"  y2="20"/>
      <line x1="8"  y1="8"  x2="11" y2="11"/>
      <line x1="32" y1="8"  x2="29" y2="11"/>
    </g>
    <path d="M50 40 Q50 30 57 30 Q55 23 49 23 Q47 17 40 19 Q35 13 28 19 Q22 19 22 27 Q22 40 33 40 Z" fill="#94A3B8"/>
    <line x1="28" y1="47" x2="26" y2="55" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="38" y1="47" x2="36" y2="55" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="48" y1="47" x2="46" y2="55" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>`,

  'showers-heavy': `
    <circle cx="20" cy="20" r="9" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="2" stroke-linecap="round">
      <line x1="20" y1="4"  x2="20" y2="8"/>
      <line x1="4"  y1="20" x2="8"  y2="20"/>
      <line x1="8"  y1="8"  x2="11" y2="11"/>
      <line x1="32" y1="8"  x2="29" y2="11"/>
    </g>
    <path d="M50 40 Q50 30 57 30 Q55 23 49 23 Q47 17 40 19 Q35 13 28 19 Q22 19 22 27 Q22 40 33 40 Z" fill="#64748B"/>
    <line x1="24" y1="46" x2="22" y2="54" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
    <line x1="32" y1="46" x2="30" y2="54" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
    <line x1="40" y1="46" x2="38" y2="54" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
    <line x1="48" y1="46" x2="46" y2="54" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>`,

  // ── Freezing drizzle (WMO 56 = light, 57 = heavy) ────────────────────────
  // Short, fine strokes in ice-blue (#BAE6FD, length ≈5, stroke-width 1.5)
  // mirror the drizzle stroke language; terminal frozen circles mark the freeze
  // modifier. Uses the drizzle cloud path to reinforce the fine-precipitation
  // read, while the ice-blue palette distinguishes it from normal drizzle.
  // Light = 2 strokes+circles, heavy = 4 strokes+circles.
  'freezing-drizzle-light': `
    <path d="M46 36 Q46 24 54 24 Q52 16 45 16 Q43 8 34 10 Q28 4 21 10 Q14 10 14 20 Q14 36 28 36 Z" fill="#CBD5E1"/>
    <line x1="24" y1="44" x2="23" y2="49" stroke="#BAE6FD" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="34" y1="44" x2="33" y2="49" stroke="#BAE6FD" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="25" cy="53" r="2" fill="#BAE6FD"/>
    <circle cx="35" cy="53" r="2" fill="#BAE6FD"/>`,

  'freezing-drizzle-heavy': `
    <path d="M46 36 Q46 24 54 24 Q52 16 45 16 Q43 8 34 10 Q28 4 21 10 Q14 10 14 20 Q14 36 28 36 Z" fill="#64748B"/>
    <line x1="18" y1="42" x2="17" y2="47" stroke="#BAE6FD" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="27" y1="42" x2="26" y2="47" stroke="#BAE6FD" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="36" y1="42" x2="35" y2="47" stroke="#BAE6FD" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="45" y1="42" x2="44" y2="47" stroke="#BAE6FD" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="19" cy="51" r="2" fill="#BAE6FD"/>
    <circle cx="28" cy="51" r="2" fill="#BAE6FD"/>
    <circle cx="37" cy="51" r="2" fill="#BAE6FD"/>
    <circle cx="46" cy="51" r="2" fill="#BAE6FD"/>`,

  // ── Freezing rain (WMO 66 = light, 67 = heavy) ───────────────────────────
  // Longer rain-style streaks in ice-blue (#BAE6FD, length ≈10, stroke-width 2.5)
  // mirror the rain stroke language; small filled circles at streak-ends signal
  // the frozen state. Ice-blue palette (vs. blue-400 for normal rain) marks the
  // freeze modifier. Distinct from snow (soft circles, no streaks) and normal
  // rain (blue-400 diagonal streaks, no terminal circles).
  // Light = 2 strokes+circles, heavy = 4 strokes+circles.
  'freezing-rain-light': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#CBD5E1"/>
    <line x1="26" y1="42" x2="22" y2="52" stroke="#BAE6FD" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="40" y1="42" x2="36" y2="52" stroke="#BAE6FD" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="24" cy="56" r="2.5" fill="#BAE6FD"/>
    <circle cx="38" cy="56" r="2.5" fill="#BAE6FD"/>`,

  'freezing-rain-heavy': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#64748B"/>
    <line x1="19" y1="40" x2="15" y2="50" stroke="#BAE6FD" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="29" y1="40" x2="25" y2="50" stroke="#BAE6FD" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="39" y1="40" x2="35" y2="50" stroke="#BAE6FD" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="49" y1="40" x2="45" y2="50" stroke="#BAE6FD" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="17" cy="54" r="2.5" fill="#BAE6FD"/>
    <circle cx="27" cy="54" r="2.5" fill="#BAE6FD"/>
    <circle cx="37" cy="54" r="2.5" fill="#BAE6FD"/>
    <circle cx="47" cy="54" r="2.5" fill="#BAE6FD"/>`,

  // ── Snow ───────────────────────────────────────────────────────────────────
  'snow-light': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#CBD5E1"/>
    <g fill="#BAE6FD">
      <circle cx="24" cy="46" r="3"/>
      <circle cx="36" cy="50" r="3"/>
    </g>`,

  'snow-moderate': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#94A3B8"/>
    <g fill="#BAE6FD">
      <circle cx="22" cy="44" r="3"/>
      <circle cx="32" cy="49" r="3"/>
      <circle cx="42" cy="44" r="3"/>
      <circle cx="28" cy="56" r="2.5"/>
      <circle cx="38" cy="56" r="2.5"/>
    </g>`,

  'snow-heavy': `
    <path d="M46 34 Q46 22 54 22 Q52 14 45 14 Q43 6 34 8 Q28 2 21 8 Q14 8 14 18 Q14 34 28 34 Z" fill="#64748B"/>
    <g fill="#BAE6FD">
      <circle cx="20" cy="43" r="3"/>
      <circle cx="30" cy="48" r="3"/>
      <circle cx="40" cy="43" r="3"/>
      <circle cx="50" cy="48" r="3"/>
      <circle cx="24" cy="56" r="3"/>
      <circle cx="36" cy="56" r="3"/>
      <circle cx="46" cy="56" r="3"/>
    </g>`,

  // ── Snow showers ───────────────────────────────────────────────────────────
  'snow-showers-light': `
    <circle cx="20" cy="20" r="9" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="2" stroke-linecap="round">
      <line x1="20" y1="4"  x2="20" y2="8"/>
      <line x1="4"  y1="20" x2="8"  y2="20"/>
      <line x1="8"  y1="8"  x2="11" y2="11"/>
      <line x1="32" y1="8"  x2="29" y2="11"/>
    </g>
    <path d="M50 40 Q50 30 57 30 Q55 23 49 23 Q47 17 40 19 Q35 13 28 19 Q22 19 22 27 Q22 40 33 40 Z" fill="#CBD5E1"/>
    <g fill="#BAE6FD">
      <circle cx="30" cy="50" r="3"/>
      <circle cx="42" cy="50" r="3"/>
    </g>`,

  'snow-showers-heavy': `
    <circle cx="20" cy="20" r="9" fill="#FBBF24"/>
    <g stroke="#FBBF24" stroke-width="2" stroke-linecap="round">
      <line x1="20" y1="4"  x2="20" y2="8"/>
      <line x1="4"  y1="20" x2="8"  y2="20"/>
      <line x1="8"  y1="8"  x2="11" y2="11"/>
      <line x1="32" y1="8"  x2="29" y2="11"/>
    </g>
    <path d="M50 40 Q50 30 57 30 Q55 23 49 23 Q47 17 40 19 Q35 13 28 19 Q22 19 22 27 Q22 40 33 40 Z" fill="#64748B"/>
    <g fill="#BAE6FD">
      <circle cx="28" cy="48" r="3"/>
      <circle cx="38" cy="48" r="3"/>
      <circle cx="48" cy="48" r="3"/>
      <circle cx="33" cy="57" r="3"/>
      <circle cx="43" cy="57" r="3"/>
    </g>`,

  // ── Thunderstorm ───────────────────────────────────────────────────────────
  'thunderstorm': `
    <path d="M46 32 Q46 20 54 20 Q52 12 45 12 Q43 4 34 6 Q28 0 21 6 Q14 6 14 16 Q14 32 28 32 Z" fill="#64748B"/>
    <polygon points="35,32 28,46 34,46 27,60 42,42 36,42" fill="#FDE68A"/>`,

  'thunderstorm-hail': `
    <path d="M46 30 Q46 18 54 18 Q52 10 45 10 Q43 2 34 4 Q28 -2 21 4 Q14 4 14 14 Q14 30 28 30 Z" fill="#64748B"/>
    <polygon points="34,30 27,43 33,43 26,56 41,39 35,39" fill="#FDE68A"/>
    <g fill="none" stroke="#7DD3FC" stroke-width="1.5">
      <circle cx="44" cy="50" r="4" fill="#E0F2FE"/>
      <circle cx="52" cy="56" r="4" fill="#E0F2FE"/>
    </g>`,

  // ── Thunderstorm with heavy hail (WMO 99) ─────────────────────────────────
  // Shape-first differentiation from normal hail (WMO 96):
  //   • Cloud spans the full width (left edge at x=10 vs x=14) for a bigger,
  //     more threatening profile.
  //   • Four hail pellets (vs two) in a 2×2 grid, with larger radii (r=5 vs r=4),
  //     so the denser pellet field is unmistakable even at small render sizes.
  'thunderstorm-hail-heavy': `
    <path d="M48 30 Q48 18 56 18 Q54 10 47 10 Q45 2 36 4 Q30 -2 22 4 Q14 4 14 14 Q14 30 28 30 Z" fill="#475569"/>
    <polygon points="34,30 27,43 33,43 26,56 41,39 35,39" fill="#FDE68A"/>
    <g fill="#E0F2FE" stroke="#7DD3FC" stroke-width="1.5">
      <circle cx="40" cy="46" r="5"/>
      <circle cx="52" cy="46" r="5"/>
      <circle cx="40" cy="58" r="5"/>
      <circle cx="52" cy="58" r="5"/>
    </g>`,

  // ── Unknown / fallback ─────────────────────────────────────────────────────
  'unknown': `
    <circle cx="32" cy="32" r="20" stroke="#94A3B8" stroke-width="3" fill="none"/>
    <text x="32" y="40" text-anchor="middle" font-size="24" fill="#94A3B8">?</text>`,
}

// ---------------------------------------------------------------------------
// WMO code → meta mapping
// ---------------------------------------------------------------------------

const CODE_MAP: Record<number, WeatherCodeMeta> = {
  0:  { description: 'Clear sky',                   icon: '☀️',     svgKey: 'clear-day' },
  1:  { description: 'Mainly clear',                icon: '🌤️',    svgKey: 'mostly-clear' },
  2:  { description: 'Partly cloudy',               icon: '⛅',     svgKey: 'partly-cloudy' },
  3:  { description: 'Overcast',                    icon: '☁️',     svgKey: 'overcast' },
  45: { description: 'Fog',                         icon: '🌫️',    svgKey: 'fog' },
  48: { description: 'Icy fog',                     icon: '🌫️',    svgKey: 'fog-icy' },
  51: { description: 'Light drizzle',               icon: '🌧️',    svgKey: 'drizzle-light' },
  53: { description: 'Drizzle',                     icon: '🌧️',    svgKey: 'drizzle-moderate' },
  55: { description: 'Heavy drizzle',               icon: '🌧️',    svgKey: 'drizzle-heavy' },
  56: { description: 'Light freezing drizzle',      icon: '🌧️❄️',  svgKey: 'freezing-drizzle-light' },
  57: { description: 'Heavy freezing drizzle',      icon: '🌧️❄️',  svgKey: 'freezing-drizzle-heavy' },
  61: { description: 'Light rain',                  icon: '🌧️',    svgKey: 'rain-light' },
  63: { description: 'Rain',                        icon: '🌧️',    svgKey: 'rain-moderate' },
  65: { description: 'Heavy rain',                  icon: '🌧️',    svgKey: 'rain-heavy' },
  66: { description: 'Light freezing rain',         icon: '🌧️❄️',  svgKey: 'freezing-rain-light' },
  67: { description: 'Heavy freezing rain',         icon: '🌧️❄️',  svgKey: 'freezing-rain-heavy' },
  71: { description: 'Light snow',                  icon: '🌨️',    svgKey: 'snow-light' },
  73: { description: 'Snow',                        icon: '🌨️',    svgKey: 'snow-moderate' },
  75: { description: 'Heavy snow',                  icon: '🌨️',    svgKey: 'snow-heavy' },
  77: { description: 'Snow grains',                 icon: '🌨️',    svgKey: 'snow-light' },
  80: { description: 'Light rain showers',          icon: '🌦️',    svgKey: 'showers-light' },
  81: { description: 'Rain showers',                icon: '🌦️',    svgKey: 'showers-moderate' },
  82: { description: 'Violent rain showers',        icon: '🌦️',    svgKey: 'showers-heavy' },
  85: { description: 'Snow showers',                icon: '🌨️',    svgKey: 'snow-showers-light' },
  86: { description: 'Heavy snow showers',          icon: '🌨️',    svgKey: 'snow-showers-heavy' },
  95: { description: 'Thunderstorm',                icon: '⛈️',    svgKey: 'thunderstorm' },
  96: { description: 'Thunderstorm with hail',      icon: '⛈️',    svgKey: 'thunderstorm-hail' },
  99: { description: 'Thunderstorm with heavy hail',icon: '⛈️',    svgKey: 'thunderstorm-hail-heavy' },
}

const FALLBACK: WeatherCodeMeta = { description: 'Unknown', icon: '🌡️', svgKey: 'unknown' }

function lookup(code: number): WeatherCodeMeta {
  return CODE_MAP[code] ?? FALLBACK
}

export function getWeatherDescription(code: number): string {
  return lookup(code).description
}

/** @deprecated Prefer getWeatherSvgIcon — emoji output kept for legacy callers */
export function getWeatherIcon(code: number): string {
  return lookup(code).icon
}

// ---------------------------------------------------------------------------
// Intensity-aware SVG icon resolver
// ---------------------------------------------------------------------------

/**
 * Groups of WMO codes that support intensity-differentiated SVG variants.
 *
 * Codes not listed here are non-intensity-differentiated (fog, icy fog, clear,
 * clouds, thunderstorms, freezing precipitation) — for those the base svgKey is
 * always returned regardless of the `intensity` argument.
 */
type IntensityIconMap = Record<WeatherIntensity, SvgIconKey>

const SVG_INTENSITY_OVERRIDE: Record<number, IntensityIconMap> = {
  // ── Drizzle (51, 53, 55) ──────────────────────────────────────────────────
  51: { light: 'drizzle-light',    moderate: 'drizzle-moderate', heavy: 'drizzle-heavy' },
  53: { light: 'drizzle-light',    moderate: 'drizzle-moderate', heavy: 'drizzle-heavy' },
  55: { light: 'drizzle-moderate', moderate: 'drizzle-heavy',    heavy: 'drizzle-heavy' },

  // ── Rain (61, 63, 65) ─────────────────────────────────────────────────────
  61: { light: 'rain-light',    moderate: 'rain-moderate', heavy: 'rain-moderate' },
  63: { light: 'rain-light',    moderate: 'rain-moderate', heavy: 'rain-heavy' },
  65: { light: 'rain-moderate', moderate: 'rain-heavy',    heavy: 'rain-heavy' },

  // ── Rain showers (80, 81, 82) ─────────────────────────────────────────────
  80: { light: 'showers-light',    moderate: 'showers-moderate', heavy: 'showers-moderate' },
  81: { light: 'showers-light',    moderate: 'showers-moderate', heavy: 'showers-heavy' },
  82: { light: 'showers-moderate', moderate: 'showers-heavy',    heavy: 'showers-heavy' },

  // ── Snow (71, 73, 75) ─────────────────────────────────────────────────────
  71: { light: 'snow-light',    moderate: 'snow-moderate', heavy: 'snow-moderate' },
  73: { light: 'snow-light',    moderate: 'snow-moderate', heavy: 'snow-heavy' },
  75: { light: 'snow-moderate', moderate: 'snow-heavy',    heavy: 'snow-heavy' },

  // ── Snow showers (85, 86) ─────────────────────────────────────────────────
  85: { light: 'snow-showers-light', moderate: 'snow-showers-light',  heavy: 'snow-showers-heavy' },
  86: { light: 'snow-showers-light', moderate: 'snow-showers-heavy',  heavy: 'snow-showers-heavy' },
}

/**
 * Return the SVG icon markup (inner `<svg>` content) for `code`, optionally
 * biased by an intensity hint.
 *
 * For codes that support intensity differentiation (rain, drizzle, snow,
 * showers) the returned SVG may differ from the base icon when `intensity`
 * is provided. For all other codes (clear, clouds, fog, thunderstorms,
 * freezing precipitation) the base icon is returned unchanged.
 *
 * @param code      WMO weather code
 * @param intensity Optional severity hint (`'light' | 'moderate' | 'heavy'`).
 *                  Omit (or pass `undefined`) to use the code's natural icon.
 */
export function getWeatherSvgIcon(
  code: number,
  intensity?: WeatherIntensity,
): string {
  let key: SvgIconKey
  if (intensity !== undefined) {
    const override = SVG_INTENSITY_OVERRIDE[code]
    key = override ? override[intensity] : lookup(code).svgKey
  } else {
    key = lookup(code).svgKey
  }
  return SVG_ICONS[key]
}

/**
 * Intensity-aware emoji resolver — kept for backward compatibility.
 * Prefer `getWeatherSvgIcon` for visual rendering.
 *
 * @deprecated Use getWeatherSvgIcon for SVG rendering.
 */
type EmojiIntensityMap = Record<WeatherIntensity, string>
const INTENSITY_OVERRIDE: Record<number, EmojiIntensityMap> = {
  // ── Drizzle (51, 53, 55) ──────────────────────────────────────────────────
  51: { light: '🌦️', moderate: '🌧️', heavy: '🌧️' },
  53: { light: '🌦️', moderate: '🌧️', heavy: '🌧️' },
  55: { light: '🌦️', moderate: '🌧️', heavy: '🌧️' },

  // ── Rain (61, 63, 65) ─────────────────────────────────────────────────────
  61: { light: '🌦️', moderate: '🌧️', heavy: '🌧️' },
  63: { light: '🌦️', moderate: '🌧️', heavy: '🌧️' },
  65: { light: '🌦️', moderate: '🌧️', heavy: '⛈️' },

  // ── Rain showers (80, 81, 82) ─────────────────────────────────────────────
  80: { light: '🌦️', moderate: '🌦️', heavy: '🌧️' },
  81: { light: '🌦️', moderate: '🌦️', heavy: '🌧️' },
  82: { light: '🌦️', moderate: '🌧️', heavy: '⛈️' },

  // ── Snow (71, 73, 75) ─────────────────────────────────────────────────────
  71: { light: '🌨️', moderate: '🌨️', heavy: '❄️' },
  73: { light: '🌨️', moderate: '🌨️', heavy: '❄️' },
  75: { light: '🌨️', moderate: '❄️',  heavy: '❄️' },

  // ── Snow showers (85, 86) ─────────────────────────────────────────────────
  85: { light: '🌨️', moderate: '🌨️', heavy: '❄️' },
  86: { light: '🌨️', moderate: '❄️',  heavy: '❄️' },
}

export function getWeatherIconForIntensity(
  code: number,
  intensity?: WeatherIntensity,
): string {
  if (intensity !== undefined) {
    const override = INTENSITY_OVERRIDE[code]
    if (override) return override[intensity]
  }
  return lookup(code).icon
}

// ---------------------------------------------------------------------------
// Wind direction helpers
// ---------------------------------------------------------------------------

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
type CompassPoint = (typeof COMPASS_POINTS)[number]

/**
 * Convert a meteorological wind direction in degrees (0–360) to an 8-point
 * compass bearing string (N, NE, E, SE, S, SW, W, NW).
 */
export function degreesToCompass(degrees: number): CompassPoint {
  const normalised = ((degrees % 360) + 360) % 360
  const index = Math.round(normalised / 45) % 8
  return COMPASS_POINTS[index]!
}
