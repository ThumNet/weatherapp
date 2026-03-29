import { ref } from 'vue'

export interface GeolocationState {
  latitude: ReturnType<typeof ref<number | null>>
  longitude: ReturnType<typeof ref<number | null>>
  loading: ReturnType<typeof ref<boolean>>
  error: ReturnType<typeof ref<string | null>>
  requestPosition: () => void
}

export function useGeolocation() {
  const latitude = ref<number | null>(null)
  const longitude = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function requestPosition(): Promise<{ lat: number; lon: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        error.value = 'Geolocation is not supported by your browser'
        resolve(null)
        return
      }

      loading.value = true
      error.value = null

      navigator.geolocation.getCurrentPosition(
        (position) => {
          latitude.value = position.coords.latitude
          longitude.value = position.coords.longitude
          loading.value = false
          resolve({ lat: position.coords.latitude, lon: position.coords.longitude })
        },
        (err) => {
          loading.value = false
          switch (err.code) {
            case err.PERMISSION_DENIED:
              // Silently fall back to default location
              break
            case err.POSITION_UNAVAILABLE:
              // Silently fall back to default location — no need to surface this to the user
              break
            case err.TIMEOUT:
              error.value = 'Location request timed out.'
              break
            default:
              error.value = 'An unknown error occurred while fetching location.'
          }
          resolve(null)
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 300_000, // cache for 5 minutes
        },
      )
    })
  }

  return {
    latitude,
    longitude,
    loading,
    error,
    requestPosition,
  }
}
