<template>
  <div
    class="relative w-full border-b border-slate-200 pb-6 transition-all duration-500 dark:border-slate-800"
  >
    <slot name="loading-bar" />
    <div class="relative z-10 px-2">
      <slot />
    </div>
  </div>
</template>
