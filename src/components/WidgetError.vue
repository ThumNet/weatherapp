<script setup lang="ts">
defineProps<{
  title: string
  error: string
}>()
</script>

<template>
  <div
    class="bg-[#b97a6a]/18 dark:bg-[#7d4c42]/18 w-full border-y border-[#a96f61]/30 p-5 dark:border-[#dca293]/20"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <span class="mt-0.5 text-xl" aria-hidden="true">⚠️</span>
      <div>
        <p class="text-sm font-semibold">{{ title }}</p>
        <p class="mt-1 text-xs text-red-600 dark:text-red-200">{{ error }}</p>
      </div>
    </div>
  </div>
</template>
