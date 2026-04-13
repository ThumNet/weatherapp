<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useLanguageStore } from '@/stores/language'
import { searchAddresses } from '@/services/weatherService'
import type { AddressSearchResult } from '@/types/weather'

const emit = defineEmits<{
  (e: 'select', city: AddressSearchResult): void
  (e: 'cancel'): void
}>()

const languageStore = useLanguageStore()

const query = ref('')
const results = ref<AddressSearchResult[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const activeIndex = ref(-1)

const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function performSearch(value: string): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed) {
    results.value = []
    isOpen.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    results.value = await searchAddresses(trimmed)
    isOpen.value = results.value.length > 0
    activeIndex.value = -1
  } catch {
    errorMessage.value = languageStore.t('search.error')
    results.value = []
    isOpen.value = false
  } finally {
    isLoading.value = false
  }
}

watch(query, (newVal) => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    void performSearch(newVal)
  }, 300)
})

function selectCity(city: AddressSearchResult): void {
  query.value = ''
  results.value = []
  isOpen.value = false
  activeIndex.value = -1
  emit('select', city)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isOpen.value = false
    activeIndex.value = -1
    inputRef.value?.blur()
    emit('cancel')
    return
  }

  if (!isOpen.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, -1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (activeIndex.value >= 0 && activeIndex.value < results.value.length) {
      selectCity(results.value[activeIndex.value]!)
    }
  }
}

function handleClickOutside(event: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
    activeIndex.value = -1
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  inputRef.value?.focus()
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }
})

function getCitySubtitle(city: AddressSearchResult): string {
  return city.subtitle
}
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <!-- Search input -->
    <div
      class="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-dutch-orange dark:border-slate-800 dark:bg-slate-950"
    >
      <!-- Magnifying glass icon -->
      <svg
        class="size-5 shrink-0 text-storm-water-600 dark:text-sea-mist-300"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>

      <input
        ref="inputRef"
        v-model="query"
        type="search"
        name="city-search"
        :placeholder="languageStore.t('search.placeholder')"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        data-1p-ignore="true"
        data-lpignore="true"
        class="flex-1 bg-transparent text-sm text-storm-water-800 placeholder-storm-water-400 outline-none dark:text-dune-foam dark:placeholder-sea-mist-300/55 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
        :aria-label="languageStore.t('search.aria')"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        aria-controls="city-dropdown"
        @keydown="onKeyDown"
      />

      <!-- Loading spinner -->
      <svg
        v-if="isLoading"
        class="size-4 shrink-0 animate-spin text-storm-water-600 dark:text-sea-mist-200"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>

      <!-- Clear button -->
      <button
        v-else-if="query"
        class="shrink-0 text-storm-water-400 transition-colors hover:text-storm-water-800 dark:text-sea-mist-300/70 dark:hover:text-white"
        :aria-label="languageStore.t('search.clear')"
        @click="
          () => {
            query = ''
            results = []
            isOpen = false
          }
        "
      >
        <svg
          class="size-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Error message -->
    <p v-if="errorMessage" class="mt-2 text-xs text-[#8d4a3f] dark:text-[#efb4a7]">
      {{ errorMessage }}
    </p>

    <!-- Dropdown results -->
    <ul
      v-if="isOpen && results.length > 0"
      id="city-dropdown"
      role="listbox"
      class="absolute z-50 mt-2 w-full overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <li
        v-for="(city, index) in results"
        :key="`${city.name}-${city.latitude}-${city.longitude}`"
        role="option"
        :aria-selected="index === activeIndex"
        class="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
        :class="
          index === activeIndex
            ? 'bg-slate-50 text-dutch-orange dark:bg-slate-800 dark:text-dutch-orange'
            : 'text-storm-water-700 dark:text-sea-mist-100'
        "
        @mousedown.prevent="selectCity(city)"
        @mouseover="activeIndex = index"
      >
        <!-- Location pin icon -->
        <svg
          class="size-4 shrink-0 opacity-70"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
          />
        </svg>

        <div class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{ city.name }}</span>
          <span class="block truncate text-xs opacity-60">{{ getCitySubtitle(city) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
