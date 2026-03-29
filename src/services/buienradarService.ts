import type { PrecipitationEntry } from '@/types/weather'

const BUIENRADAR_URL = 'https://gpsgadget.buienradar.nl/data/raintext'

/**
 * Converts a raw Buienradar intensity value (0–255) to mm/h.
 * Formula: mm/h = 10^((value - 109) / 32)
 * Returns 0 for intensity values of 0 (no rain).
 */
function intensityToMmPerHour(value: number): number {
  if (value <= 0) return 0
  return Math.pow(10, (value - 109) / 32)
}

/**
 * Fetches the 2-hour precipitation forecast from Buienradar for the given
 * coordinates and returns a parsed array of { time, intensity, mmPerHour }.
 *
 * The raw response is plain text with one entry per line:
 *   "000|14:30"
 * where the first 3 characters are the intensity (0–255) and the part after
 * the pipe is the time (HH:MM).
 */
export async function fetchPrecipitationForecast(
  lat: number,
  lon: number,
): Promise<PrecipitationEntry[]> {
  const url = `${BUIENRADAR_URL}?lat=${lat}&lon=${lon}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Buienradar request failed: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  const entries: PrecipitationEntry[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const pipeIndex = trimmed.indexOf('|')
    if (pipeIndex === -1) continue

    const rawIntensity = trimmed.slice(0, pipeIndex)
    const time = trimmed.slice(pipeIndex + 1)

    const intensity = parseInt(rawIntensity, 10)
    if (isNaN(intensity)) continue

    entries.push({
      time,
      intensity,
      mmPerHour: intensityToMmPerHour(intensity),
    })
  }

  return entries
}
