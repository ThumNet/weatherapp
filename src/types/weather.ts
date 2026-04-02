// TypeScript interfaces for weather and geocoding API responses

export interface GeocodingResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  country_code: string
  admin1?: string
  admin2?: string
  admin3?: string
  admin4?: string
  timezone?: string
  population?: number
  elevation?: number
}

export interface GeocodingResponse {
  results?: GeocodingResult[]
  generationtime_ms?: number
}

export interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  state?: string
  country?: string
  country_code?: string
}

export interface NominatimReverseResponse {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  display_name: string
  address: NominatimAddress
  boundingbox: string[]
}

export interface CitySearchResult {
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

// ---------------------------------------------------------------------------
// Current weather
// ---------------------------------------------------------------------------

/** Raw response shape from Open-Meteo /v1/forecast (current fields only) */
export interface OpenMeteoCurrentWeatherResponse {
  latitude: number
  longitude: number
  timezone: string
  timezone_abbreviation: string
  current_units: {
    temperature_2m: string
    relative_humidity_2m: string
    apparent_temperature: string
    weather_code: string
    wind_speed_10m: string
    wind_direction_10m: string
    /** Present only when precipitation is requested */
    precipitation?: string
    /** Present only when is_day is requested */
    is_day?: string
  }
  current: {
    time: string
    temperature_2m: number
    relative_humidity_2m: number
    apparent_temperature: number
    weather_code: number
    wind_speed_10m: number
    wind_direction_10m: number
    /** Precipitation amount in mm for the current hour; absent in older cached shapes */
    precipitation?: number
    /** 1 = daytime, 0 = nighttime */
    is_day?: number
  }
}

/** Normalised current weather object used throughout the app */
export interface CurrentWeather {
  temperature: number
  humidity: number
  apparentTemperature: number
  weatherCode: number
  windSpeed: number
  windDirection: number
  /** ISO 8601 timestamp returned by Open-Meteo */
  time: string
  /**
   * Precipitation amount for the current hour in mm.
   * Null when the value is missing (e.g. older persisted cache shapes).
   */
  precipitation: number | null
  /**
   * Whether it is currently daytime (true) or nighttime (false).
   * Null when the value is missing (e.g. older persisted cache shapes).
   */
  isDay: boolean | null
}

// ---------------------------------------------------------------------------
// Hourly forecast
// ---------------------------------------------------------------------------

/** Normalised hourly forecast for the next 24 hours */
export interface HourlyForecast {
  time: string[]
  temperature: number[]
  precipitationProbability: number[]
  precipitation: number[]
  weatherCode: number[]
  /** 1 = daytime, 0 = nighttime per hour. Null array when absent from older cached shapes. */
  isDay: number[] | null
}

/** Raw response shape from Open-Meteo /v1/forecast (hourly fields) */
export interface OpenMeteoHourlyResponse {
  latitude: number
  longitude: number
  timezone: string
  timezone_abbreviation: string
  hourly_units: {
    time: string
    temperature_2m: string
    precipitation_probability: string
    precipitation: string
    weather_code: string
    is_day?: string
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    precipitation_probability: number[]
    precipitation: number[]
    weather_code: number[]
    is_day?: number[]
  }
}

// ---------------------------------------------------------------------------
// Daily forecast
// ---------------------------------------------------------------------------

/** Normalised 7-day daily forecast data used throughout the app */
export interface DailyForecast {
  time: string[]
  weatherCode: number[]
  temperatureMax: number[]
  temperatureMin: number[]
  precipitationSum: number[]
  precipitationProbabilityMax: number[]
  /**
   * Number of hours with precipitation per day (≥ 0.1 mm threshold).
   * Null when the value is missing (e.g. older persisted cache shapes).
   */
  precipitationHours: number[] | null
  /**
   * ISO 8601 datetime strings for sunrise/sunset per day.
   * Null when absent from older persisted cache shapes.
   */
  sunrise: string[] | null
  sunset: string[] | null
}

/** Raw response shape from Open-Meteo /v1/forecast (daily fields only) */
export interface OpenMeteoDailyResponse {
  latitude: number
  longitude: number
  timezone: string
  timezone_abbreviation: string
  daily_units: {
    time: string
    weather_code: string
    temperature_2m_max: string
    temperature_2m_min: string
    precipitation_sum: string
    precipitation_probability_max: string
    /** Present only when precipitation_hours is requested */
    precipitation_hours?: string
    sunrise?: string
    sunset?: string
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_probability_max: number[]
    /** Absent in older cached shapes */
    precipitation_hours?: number[]
    sunrise?: string[]
    sunset?: string[]
  }
}

// ---------------------------------------------------------------------------
// Buienradar precipitation forecast
// ---------------------------------------------------------------------------

/** A single entry from the Buienradar 2-hour precipitation forecast */
export interface PrecipitationEntry {
  /** Time label in HH:MM format */
  time: string
  /** Raw intensity value from Buienradar (0–255) */
  intensity: number
  /** Precipitation rate in mm/h derived from the intensity value */
  mmPerHour: number
}
