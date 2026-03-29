import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchPrecipitationForecast } from '@/services/buienradarService'
import type { PrecipitationEntry } from '@/types/weather'

/** Minimum mm/h value considered "rain" (light drizzle threshold) */
const RAIN_THRESHOLD_MM_PER_HOUR = 0.1

const STORAGE_KEY = 'dutch-weather:precipitation'

interface PrecipitationCache {
  entries: PrecipitationEntry[]
  lastUpdated: string // ISO string
}

function loadFromStorage(): PrecipitationCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PrecipitationCache
  } catch {
    return null
  }
}

function saveToStorage(cache: PrecipitationCache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

export const usePrecipitationStore = defineStore('precipitation', () => {
  // Hydrate from localStorage on init
  const cached = loadFromStorage()

  const entries = ref<PrecipitationEntry[]>(cached?.entries ?? [])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<Date | null>(
    cached?.lastUpdated ? new Date(cached.lastUpdated) : null,
  )

  async function fetchPrecipitation(lat: number, lon: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      entries.value = await fetchPrecipitationForecast(lat, lon)
      lastUpdated.value = new Date()

      // Persist fresh data for offline use
      saveToStorage({
        entries: entries.value,
        lastUpdated: lastUpdated.value.toISOString(),
      })
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : 'Failed to fetch precipitation data. Please try again.'
      // Keep previous entries visible while showing the error
    } finally {
      loading.value = false
    }
  }

  /** True when any entry in the 2-hour window has measurable rain */
  const isRainExpected = computed<boolean>(() =>
    entries.value.some((e) => e.mmPerHour >= RAIN_THRESHOLD_MM_PER_HOUR),
  )

  /**
   * Minutes from now until rain starts.
   * Buienradar returns entries every 5 minutes starting at ~now.
   * We treat each index as 5 minutes into the future.
   * Returns null when no rain is expected.
   */
  const minutesUntilRain = computed<number | null>(() => {
    const idx = entries.value.findIndex((e) => e.mmPerHour >= RAIN_THRESHOLD_MM_PER_HOUR)
    return idx === -1 ? null : idx * 5
  })

  /** Highest mm/h value across all entries */
  const maxIntensity = computed<number>(() => {
    if (entries.value.length === 0) return 0
    return Math.max(...entries.value.map((e) => e.mmPerHour))
  })

  return {
    entries,
    loading,
    error,
    lastUpdated,
    fetchPrecipitation,
    isRainExpected,
    minutesUntilRain,
    maxIntensity,
  }
})
