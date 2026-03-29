import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'dutch-weather-location'

interface PersistedLocation {
  latitude: number
  longitude: number
  cityName: string
}

function loadFromStorage(): PersistedLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'latitude' in parsed &&
      'longitude' in parsed &&
      'cityName' in parsed &&
      typeof (parsed as PersistedLocation).latitude === 'number' &&
      typeof (parsed as PersistedLocation).longitude === 'number' &&
      typeof (parsed as PersistedLocation).cityName === 'string'
    ) {
      return parsed as PersistedLocation
    }
    return null
  } catch {
    return null
  }
}

function saveToStorage(data: PersistedLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Silently fail if localStorage is not available (e.g. private browsing with full storage block)
  }
}

const AMSTERDAM_DEFAULTS: PersistedLocation = {
  latitude: 52.37,
  longitude: 4.9,
  cityName: 'Amsterdam',
}

export const useLocationStore = defineStore('location', () => {
  const persisted = loadFromStorage() ?? AMSTERDAM_DEFAULTS

  const latitude = ref<number>(persisted.latitude)
  const longitude = ref<number>(persisted.longitude)
  const cityName = ref<string>(persisted.cityName)

  function updateLocation(lat: number, lon: number): void {
    latitude.value = lat
    longitude.value = lon
    saveToStorage({ latitude: lat, longitude: lon, cityName: cityName.value })
  }

  function updateCityName(name: string): void {
    cityName.value = name
    saveToStorage({ latitude: latitude.value, longitude: longitude.value, cityName: name })
  }

  function setLocationWithCity(lat: number, lon: number, name: string): void {
    latitude.value = lat
    longitude.value = lon
    cityName.value = name
    saveToStorage({ latitude: lat, longitude: lon, cityName: name })
  }

  function resetToAmsterdam(): void {
    setLocationWithCity(
      AMSTERDAM_DEFAULTS.latitude,
      AMSTERDAM_DEFAULTS.longitude,
      AMSTERDAM_DEFAULTS.cityName,
    )
  }

  return {
    latitude,
    longitude,
    cityName,
    updateLocation,
    updateCityName,
    setLocationWithCity,
    resetToAmsterdam,
  }
})
