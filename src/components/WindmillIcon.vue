<script setup lang="ts">
// Windmill Icon - Reusable SVG component
</script>

<template>
  <svg viewBox="0 0 100 100" class="group fill-none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Windmill Blade Definition -->
      <g id="blade-icon">
        <!-- Main beam -->
        <line
          x1="50"
          y1="45"
          x2="50"
          y2="4"
          stroke="currentColor"
          class="text-slate-800 dark:text-slate-200"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <!-- Sail frame -->
        <rect
          x="51"
          y="8"
          width="10"
          height="32"
          fill="currentColor"
          class="text-dutch-blue-500/80"
          stroke="currentColor"
          stroke-width="1"
          rx="0.5"
        />
        <!-- Lattice lines -->
        <line
          x1="51"
          y1="16"
          x2="61"
          y2="16"
          stroke="currentColor"
          class="text-slate-800 dark:text-slate-200"
          stroke-width="0.5"
        />
        <line
          x1="51"
          y1="24"
          x2="61"
          y2="24"
          stroke="currentColor"
          class="text-slate-800 dark:text-slate-200"
          stroke-width="0.5"
        />
        <line
          x1="51"
          y1="32"
          x2="61"
          y2="32"
          stroke="currentColor"
          class="text-slate-800 dark:text-slate-200"
          stroke-width="0.5"
        />
      </g>

      <!-- Sun Ray Definition -->
      <line
        id="ray-icon"
        x1="85"
        y1="5"
        x2="85"
        y2="0"
        stroke="#FF9B00"
        stroke-width="2"
        stroke-linecap="round"
      />
    </defs>

    <!-- Sun (Top Right) -->
    <g>
      <circle cx="85" cy="20" r="9" fill="#FF9B00" />
      <use href="#ray-icon" />
      <use href="#ray-icon" transform="rotate(45 85 20)" />
      <use href="#ray-icon" transform="rotate(90 85 20)" />
      <use href="#ray-icon" transform="rotate(135 85 20)" />
      <use href="#ray-icon" transform="rotate(180 85 20)" />
      <use href="#ray-icon" transform="rotate(225 85 20)" />
      <use href="#ray-icon" transform="rotate(270 85 20)" />
      <use href="#ray-icon" transform="rotate(315 85 20)" />
    </g>

    <!-- Clouds (Background, shifted left and raised higher) -->
    <g transform="translate(0, -35)">
      <path
        d="M 10 65 A 12 12 0 0 1 20 53 A 18 18 0 0 1 50 60 A 12 12 0 0 1 50 80 L 10 80 A 8 8 0 0 1 10 65 Z"
        class="text-slate-200 dark:text-slate-700"
        fill="currentColor"
      />
      <path
        d="M 25 75 A 10 10 0 0 1 35 65 A 15 15 0 0 1 60 70 A 10 10 0 0 1 60 88 L 25 88 A 6 6 0 0 1 25 75 Z"
        class="text-slate-300 dark:text-slate-600"
        fill="currentColor"
        opacity="0.8"
      />
      <!-- Third cloud on the right side -->
      <path
        d="M 55 70 A 8 8 0 0 1 65 60 A 12 12 0 0 1 85 65 A 8 8 0 0 1 85 80 L 55 80 A 6 6 0 0 1 55 70 Z"
        class="text-slate-200 dark:text-slate-700"
        fill="currentColor"
        opacity="0.7"
      />
    </g>

    <!-- Windmill Base/Tower -->
    <path
      d="M 36 90 L 43 45 L 57 45 L 64 90 Z"
      class="text-slate-700 dark:text-slate-300"
      fill="currentColor"
    />

    <!-- Brick/Wood horizontal texture lines -->
    <path
      d="M 41.5 55 L 58.5 55 M 39.5 65 L 60.5 65 M 38 75 L 62 75 M 36.5 85 L 63.5 85"
      stroke="currentColor"
      class="text-slate-800 dark:text-slate-400"
      stroke-width="0.5"
      stroke-dasharray="2 1"
      opacity="0.5"
    />

    <!-- Windmill Cap/Roof -->
    <path
      d="M 41 45 C 41 35, 59 35, 59 45 Z"
      class="text-slate-800 dark:text-slate-100"
      fill="currentColor"
    />

    <!-- Gallery/Deck (Stelling) -->
    <rect
      x="32"
      y="70"
      width="36"
      height="3"
      rx="1"
      class="text-slate-800 dark:text-slate-100"
      fill="currentColor"
    />
    <path
      d="M 34 73 L 37 90 M 66 73 L 63 90"
      stroke="currentColor"
      class="text-slate-800 dark:text-slate-100"
      stroke-width="1.5"
      stroke-linecap="round"
    />

    <!-- Door and Windows -->
    <path
      d="M 47 90 L 47 82 A 3 3 0 0 1 53 82 L 53 90 Z"
      class="text-slate-900 dark:text-slate-900"
      fill="currentColor"
    />
    <rect
      x="48"
      y="58"
      width="4"
      height="6"
      rx="1"
      class="text-slate-900 dark:text-slate-900"
      fill="currentColor"
    />
    <rect
      x="48"
      y="48"
      width="4"
      height="5"
      rx="1"
      class="text-slate-900 dark:text-slate-900"
      fill="currentColor"
    />

    <!-- Blades group -->
    <g
      class="transition-transform duration-500 group-hover:animate-[spin_12s_linear_infinite]"
      style="transform-origin: 50px 45px"
    >
      <use href="#blade-icon" transform="rotate(45 50 45)" />
      <use href="#blade-icon" transform="rotate(135 50 45)" />
      <use href="#blade-icon" transform="rotate(225 50 45)" />
      <use href="#blade-icon" transform="rotate(315 50 45)" />
    </g>

    <!-- Axis/Hub -->
    <circle cx="50" cy="45" r="3.5" class="text-slate-900 dark:text-slate-50" fill="currentColor" />
    <circle
      cx="50"
      cy="45"
      r="1.5"
      class="text-slate-300 dark:text-slate-800"
      fill="currentColor"
    />
  </svg>
</template>
