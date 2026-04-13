<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="mb-4 flex items-center justify-between">
    <h2
      class="text-sm font-semibold uppercase tracking-widget text-storm-water-500 dark:text-sea-mist-300/65"
    >
      {{ title }}
    </h2>
    <slot />
  </div>
</template>
