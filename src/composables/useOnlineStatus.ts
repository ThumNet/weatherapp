import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Tracks the browser's online/offline status.
 * Returns a reactive `isOnline` ref that updates automatically.
 */
export function useOnlineStatus() {
  const isOnline = ref(navigator.onLine)

  function handleOnline() {
    isOnline.value = true
  }

  function handleOffline() {
    isOnline.value = false
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { isOnline }
}
