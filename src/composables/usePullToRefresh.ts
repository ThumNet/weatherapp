import { ref, onMounted, onUnmounted } from 'vue'

interface PullToRefreshOptions {
  /** Pixels of pull needed to trigger a refresh (default: 80) */
  threshold?: number
  /** Callback to invoke when the threshold is reached */
  onRefresh: () => void | Promise<void>
}

/**
 * Detects a touch pull-down gesture at the top of the page and triggers a refresh.
 * Exposes `isPulling` (currently being pulled) and `pullProgress` (0–1).
 */
export function usePullToRefresh({ threshold = 80, onRefresh }: PullToRefreshOptions) {
  const isPulling = ref(false)
  const isRefreshing = ref(false)
  const pullProgress = ref(0) // 0–1

  let startY = 0
  let currentY = 0

  function handleTouchStart(e: TouchEvent) {
    // Only activate when at the very top of the page
    if (window.scrollY > 5) return
    startY = e.touches[0].clientY
    currentY = startY
  }

  function handleTouchMove(e: TouchEvent) {
    if (startY === 0) return
    currentY = e.touches[0].clientY
    const delta = currentY - startY

    if (delta > 0) {
      isPulling.value = true
      pullProgress.value = Math.min(delta / threshold, 1)
    } else {
      isPulling.value = false
      pullProgress.value = 0
    }
  }

  async function handleTouchEnd() {
    if (!isPulling.value) return

    const delta = currentY - startY

    if (delta >= threshold && !isRefreshing.value) {
      isRefreshing.value = true
      try {
        await onRefresh()
      } finally {
        isRefreshing.value = false
      }
    }

    isPulling.value = false
    pullProgress.value = 0
    startY = 0
    currentY = 0
  }

  onMounted(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('touchstart', handleTouchStart)
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', handleTouchEnd)
  })

  return { isPulling, isRefreshing, pullProgress }
}
