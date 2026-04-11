import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { AppLanguage } from '@/utils/i18n'
import { LOCALE_MAP, translate } from '@/utils/i18n'

const STORAGE_KEY = 'dutch-weather:language'

function loadFromStorage(): AppLanguage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'nl' || raw === 'en') return raw
  } catch {
    // localStorage unavailable
  }
  return 'nl'
}

function saveToStorage(language: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage unavailable
  }
}

function setMetaContent(selector: string, content: string): void {
  document.querySelector(selector)?.setAttribute('content', content)
}

export const useLanguageStore = defineStore('language', () => {
  const language = ref<AppLanguage>(loadFromStorage())

  const locale = computed(() => LOCALE_MAP[language.value])

  function setLanguage(value: AppLanguage): void {
    language.value = value
    saveToStorage(value)
  }

  function toggleLanguage(): void {
    setLanguage(language.value === 'nl' ? 'en' : 'nl')
  }

  function t(key: string, params?: Record<string, string | number>): string {
    return translate(language.value, key, params)
  }

  watch(
    language,
    (value) => {
      document.documentElement.lang = value
      document.title = translate(value, 'app.title')
      setMetaContent('meta[name="description"]', translate(value, 'app.description'))
      setMetaContent('meta[name="apple-mobile-web-app-title"]', translate(value, 'app.appleTitle'))
      setMetaContent('meta[property="og:title"]', translate(value, 'app.title'))
      setMetaContent('meta[property="og:description"]', translate(value, 'app.description'))
    },
    { immediate: true },
  )

  return { language, locale, setLanguage, toggleLanguage, t }
})
