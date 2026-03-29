/**
 * WMO Weather interpretation codes (WW)
 * https://open-meteo.com/en/docs#weathervariables
 */

interface WeatherCodeMeta {
  description: string
  icon: string
}

const CODE_MAP: Record<number, WeatherCodeMeta> = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Fog', icon: '🌫️' },
  48: { description: 'Icy fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌧️' },
  53: { description: 'Drizzle', icon: '🌧️' },
  55: { description: 'Heavy drizzle', icon: '🌧️' },
  56: { description: 'Light freezing drizzle', icon: '🌧️❄️' },
  57: { description: 'Heavy freezing drizzle', icon: '🌧️❄️' },
  61: { description: 'Light rain', icon: '🌧️' },
  63: { description: 'Rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  66: { description: 'Light freezing rain', icon: '🌧️❄️' },
  67: { description: 'Heavy freezing rain', icon: '🌧️❄️' },
  71: { description: 'Light snow', icon: '🌨️' },
  73: { description: 'Snow', icon: '🌨️' },
  75: { description: 'Heavy snow', icon: '🌨️' },
  77: { description: 'Snow grains', icon: '🌨️' },
  80: { description: 'Light rain showers', icon: '🌦️' },
  81: { description: 'Rain showers', icon: '🌦️' },
  82: { description: 'Violent rain showers', icon: '🌦️' },
  85: { description: 'Snow showers', icon: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '🌨️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' },
}

const FALLBACK: WeatherCodeMeta = { description: 'Unknown', icon: '🌡️' }

function lookup(code: number): WeatherCodeMeta {
  return CODE_MAP[code] ?? FALLBACK
}

export function getWeatherDescription(code: number): string {
  return lookup(code).description
}

export function getWeatherIcon(code: number): string {
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
