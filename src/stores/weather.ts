import { defineStore } from 'pinia'
import { ref } from 'vue'
import { translate } from '@/utils/i18n'
import {
  fetchCurrentWeather,
  fetchDailyForecast,
  fetchHourlyForecast,
} from '@/services/weatherService'
import type { CurrentWeather, DailyForecast, HourlyForecast } from '@/types/weather'

const STORAGE_KEY = 'dutch-weather:weather'

interface WeatherCache {
  currentWeather: CurrentWeather
  hourlyForecast: HourlyForecast
  dailyForecast: DailyForecast
  lastUpdated: string // ISO string
}

function loadFromStorage(): WeatherCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeatherCache

    // Backward-compatible normalization: older cached shapes may be missing
    // fields added after the initial release. Coerce undefined → null so the
    // rest of the app always receives a known type (number | null).
    if (parsed.currentWeather) {
      parsed.currentWeather.precipitation = parsed.currentWeather.precipitation ?? null
      parsed.currentWeather.isDay = parsed.currentWeather.isDay ?? null
    }
    if (parsed.hourlyForecast) {
      parsed.hourlyForecast.isDay = parsed.hourlyForecast.isDay ?? null
    }
    if (parsed.dailyForecast) {
      parsed.dailyForecast.precipitationHours = parsed.dailyForecast.precipitationHours ?? null
      parsed.dailyForecast.sunrise = parsed.dailyForecast.sunrise ?? null
      parsed.dailyForecast.sunset = parsed.dailyForecast.sunset ?? null
    }

    return parsed
  } catch {
    return null
  }
}

function saveToStorage(cache: WeatherCache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

export const useWeatherStore = defineStore('weather', () => {
  // Hydrate from localStorage on init
  const cached = loadFromStorage()

  const currentWeather = ref<CurrentWeather | null>(cached?.currentWeather ?? null)
  const hourlyForecast = ref<HourlyForecast | null>(cached?.hourlyForecast ?? null)
  const dailyForecast = ref<DailyForecast | null>(cached?.dailyForecast ?? null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<Date | null>(
    cached?.lastUpdated ? new Date(cached.lastUpdated) : null,
  )

  function currentLanguage(): 'nl' | 'en' {
    if (typeof document === 'undefined') return 'nl'
    return document.documentElement.lang === 'en' ? 'en' : 'nl'
  }

  async function fetchWeather(lat: number, lon: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const [current, hourly, daily] = await Promise.all([
        fetchCurrentWeather(lat, lon),
        fetchHourlyForecast(lat, lon),
        fetchDailyForecast(lat, lon),
      ])
      currentWeather.value = current
      hourlyForecast.value = hourly
      dailyForecast.value = daily
      lastUpdated.value = new Date()

      // Persist fresh data for offline use
      saveToStorage({
        currentWeather: current,
        hourlyForecast: hourly,
        dailyForecast: daily,
        lastUpdated: lastUpdated.value.toISOString(),
      })
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : translate(currentLanguage(), 'weather.fetchError')
      // Keep the previous weather data visible while showing the error
    } finally {
      loading.value = false
    }
  }

  return {
    currentWeather,
    hourlyForecast,
    dailyForecast,
    loading,
    error,
    lastUpdated,
    fetchWeather,
  }
})
