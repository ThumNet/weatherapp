export interface RadarFrame {
  time: number
  path: string
}

export interface RainViewerResponse {
  version: string
  generated: number
  host: string
  radar: {
    past: RadarFrame[]
    nowcast: RadarFrame[]
  }
}

const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json'

/**
 * Fetches available radar frames from the RainViewer public API.
 * Returns a combined list of past + nowcast frames, sorted by time ascending.
 */
export async function fetchRadarFrames(): Promise<{ host: string; frames: RadarFrame[] }> {
  const response = await fetch(RAINVIEWER_API)

  if (!response.ok) {
    throw new Error(`RainViewer API request failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as RainViewerResponse

  const frames: RadarFrame[] = [
    ...data.radar.past,
    ...data.radar.nowcast,
  ].sort((a, b) => a.time - b.time)

  return { host: data.host, frames }
}

/**
 * Builds the Leaflet tile URL template for a given radar frame.
 * Color scheme 6 = smooth rainbow, options 1 = with snow.
 */
export function buildRadarTileUrl(host: string, framePath: string): string {
  // {z}/{x}/{y} are Leaflet placeholders
  return `${host}${framePath}/512/{z}/{x}/{y}/6/1.png`
}

/**
 * Formats a Unix timestamp as a human-readable local time string (HH:MM).
 */
export function formatFrameTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}
