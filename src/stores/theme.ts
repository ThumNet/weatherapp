import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

type Theme = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'dutch-weather:theme'

function loadFromStorage(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw
  } catch {
    // localStorage unavailable
  }
  return 'system'
}

function saveToStorage(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage unavailable — silently ignore
  }
}

function prefersColorSchemeDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(loadFromStorage())

  const isDark = computed<boolean>(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    return prefersColorSchemeDark()
  })

  function setTheme(newTheme: Theme): void {
    theme.value = newTheme
    saveToStorage(newTheme)
  }

  // Apply/remove dark class on <html> and update PWA theme-color meta tag
  watch(
    isDark,
    (dark) => {
      if (dark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0f2027' : '#bae6fd')
    },
    { immediate: true },
  )

  // Also react to OS-level preference changes when theme is 'system'
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') {
        // Re-trigger the watcher by toggling a dependency — isDark recomputes automatically
        // because it reads matchMedia inside computed, but Vue doesn't track it reactively.
        // Force a re-evaluation by briefly toggling and restoring.
        const current = theme.value
        theme.value = 'dark' // trigger reactivity
        theme.value = current
      }
    })
  }

  return { theme, isDark, setTheme }
})
