import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'dutch-weather-commute'

export interface SavedLocation {
  lat: number
  lon: number
  name: string
}

interface PersistedCommute {
  home: SavedLocation | null
  work: SavedLocation | null
}

function loadFromStorage(): PersistedCommute {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { home: null, work: null }
    const parsed = JSON.parse(raw) as PersistedCommute
    if (parsed && typeof parsed === 'object') {
      return {
        home: parsed.home ?? null,
        work: parsed.work ?? null
      }
    }
  } catch {}
  return { home: null, work: null }
}

function saveToStorage(data: PersistedCommute): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export const useCommuteStore = defineStore('commute', () => {
  const persisted = loadFromStorage()

  const home = ref<SavedLocation | null>(persisted.home)
  const work = ref<SavedLocation | null>(persisted.work)

  function setHome(lat: number, lon: number, name: string) {
    home.value = { lat, lon, name }
    saveToStorage({ home: home.value, work: work.value })
  }

  function setWork(lat: number, lon: number, name: string) {
    work.value = { lat, lon, name }
    saveToStorage({ home: home.value, work: work.value })
  }

  function clearHome() {
    home.value = null
    saveToStorage({ home: null, work: work.value })
  }

  function clearWork() {
    work.value = null
    saveToStorage({ home: home.value, work: null })
  }

  function resetCommute() {
    home.value = null
    work.value = null
    saveToStorage({ home: null, work: null })
  }

  return {
    home,
    work,
    setHome,
    setWork,
    clearHome,
    clearWork,
    resetCommute
  }
})
