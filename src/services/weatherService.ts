import type {
  CitySearchResult,
  CurrentWeather,
  DailyForecast,
  GeocodingResponse,
  HourlyForecast,
  NominatimReverseResponse,
  OpenMeteoCurrentWeatherResponse,
  OpenMeteoDailyResponse,
  OpenMeteoHourlyResponse,
} from '@/types/weather'

const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const FORECAST_BASE = 'https://api.open-meteo.com/v1'

/**
 * Search for cities by name using the Open-Meteo Geocoding API.
 * Returns up to 5 matching results.
 */
export async function searchCities(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const url = `${GEOCODING_BASE}/search?name=${encodeURIComponent(trimmed)}&count=20&language=en&format=json`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`)
  }

  const data: GeocodingResponse = (await response.json()) as GeocodingResponse

  if (!data.results || data.results.length === 0) {
    return []
  }

  // Filter strictly to the Netherlands and return max 5 results
  const nlResults = data.results.filter((r) => r.country_code === 'NL').slice(0, 5)

  return nlResults.map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    admin1: r.admin1,
  }))
}

/**
 * Reverse geocode coordinates to a city name using the Nominatim API.
 * Falls back to a formatted coordinate string if the request fails.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'DutchWeatherPWA/1.0 (https://github.com/example/dutch-weather)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`)
  }

  const data: NominatimReverseResponse = (await response.json()) as NominatimReverseResponse

  const address = data.address
  // Pick the most specific locality name available
  const cityName =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    data.display_name.split(',')[0]

  return cityName.trim()
}

/**
 * Fetch current weather conditions for the given coordinates using Open-Meteo.
 */
export async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,is_day',
    timezone: 'auto',
  })

  const url = `${FORECAST_BASE}/forecast?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OpenMeteoCurrentWeatherResponse
  const c = data.current

  return {
    temperature: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    apparentTemperature: c.apparent_temperature,
    weatherCode: c.weather_code,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    time: c.time,
    precipitation: c.precipitation ?? null,
    isDay: c.is_day !== undefined ? c.is_day === 1 : null,
  }
}

/**
 * Fetch the next 24 hours of hourly forecast data for the given coordinates.
 */
export async function fetchHourlyForecast(lat: number, lon: number): Promise<HourlyForecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,is_day',
    timezone: 'auto',
    forecast_hours: '24',
  })

  const url = `${FORECAST_BASE}/forecast?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OpenMeteoHourlyResponse
  const h = data.hourly

  return {
    time: h.time,
    temperature: h.temperature_2m,
    precipitationProbability: h.precipitation_probability,
    precipitation: h.precipitation,
    weatherCode: h.weather_code,
    isDay: h.is_day ?? null,
  }
}

/**
 * Fetch 7-day daily forecast data for the given coordinates using Open-Meteo.
 */
export async function fetchDailyForecast(lat: number, lon: number): Promise<DailyForecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,precipitation_hours,sunrise,sunset',
    timezone: 'auto',
  })

  const url = `${FORECAST_BASE}/forecast?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OpenMeteoDailyResponse
  const d = data.daily

  return {
    time: d.time,
    weatherCode: d.weather_code,
    temperatureMax: d.temperature_2m_max,
    temperatureMin: d.temperature_2m_min,
    precipitationSum: d.precipitation_sum,
    precipitationProbabilityMax: d.precipitation_probability_max,
    precipitationHours: d.precipitation_hours ?? null,
    sunrise: d.sunrise ?? null,
    sunset: d.sunset ?? null,
  }
}
