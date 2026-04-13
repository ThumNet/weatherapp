<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  isOpen: boolean
  title: string
  subtitle: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Escape key handler
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

// Watch isOpen to: lock body scroll, manage key listener
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      document.body.classList.add('overflow-hidden')
      document.addEventListener('keydown', onKeydown)
    } else {
      document.body.classList.remove('overflow-hidden')
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  document.body.classList.remove('overflow-hidden')
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fs-modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex flex-col bg-white text-storm-water-800 dark:bg-slate-950 dark:text-slate-50"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel || title"
      >
        <!-- Top bar -->
        <div
          class="relative z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 pt-safe dark:border-slate-800 dark:bg-slate-950"
        >
          <div class="flex items-center gap-2">
            <div>
              <p
                class="text-[11px] uppercase tracking-[0.24em] text-storm-water-500 dark:text-sea-mist-300/55"
              >
                {{ subtitle }}
              </p>
              <h2 class="text-lg font-semibold text-storm-water-800 dark:text-dune-foam">
                {{ title }}
              </h2>
            </div>
          </div>
          <!-- Close button — min 44px tap target -->
          <button
            class="flex size-11 items-center justify-center text-storm-water-500 transition hover:text-dutch-orange active:text-storm-water-800 dark:text-sea-mist-200/70 dark:hover:text-dutch-orange dark:active:text-white"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content Area -->
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fs-modal-enter-active,
.fs-modal-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fs-modal-enter-from,
.fs-modal-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
