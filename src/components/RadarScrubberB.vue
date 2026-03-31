<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatFrameTime } from '@/services/rainviewerService'
import type { RadarFrame } from '@/services/rainviewerService'

// ---------------------------------------------------------------------------
// Props & emits
// ---------------------------------------------------------------------------
const props = defineProps<{
  frames: RadarFrame[]
  currentFrameIndex: number
  nowcastStartIndex: number
  framesLoaded: boolean
}>()

const emit = defineEmits<{
  'update:currentFrameIndex': [index: number]
  'scrub-start': []
}>()

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

const frameCount = computed(() => props.frames.length)

/** Current frame time label */
const currentTimeLabel = computed<string>(() => {
  if (props.frames.length === 0 || props.currentFrameIndex >= props.frames.length) return ''
  return formatFrameTime(props.frames[props.currentFrameIndex].time)
})

/** True when there ARE forecast frames after the boundary */
const hasNowcast = computed<boolean>(() => props.nowcastStartIndex < props.frames.length)

/** Whether the current frame is in the forecast zone */
const isNowcast = computed<boolean>(() => props.currentFrameIndex >= props.nowcastStartIndex)

// ---------------------------------------------------------------------------
// Tick-based timeline
// ---------------------------------------------------------------------------

interface TickEntry {
  time: number
  percent: number
  isPlaceholder: boolean
  isNow: boolean
  isForecast: boolean
  isCurrent: boolean
}

/**
 * Build the full list of ticks for the timeline.
 * Real frames map 1:1 to ticks. When nowcast is empty, we append
 * placeholder ticks at 10-minute intervals for the next 2 hours.
 */
const ticks = computed<TickEntry[]>(() => {
  if (props.frames.length === 0) return []

  const hasFC = props.nowcastStartIndex < props.frames.length

  // If there ARE real forecast frames, no placeholders needed — just map frames to ticks
  if (hasFC) {
    const total = props.frames.length - 1
    return props.frames.map((f, i) => ({
      time: f.time,
      percent: total > 0 ? (i / total) * 100 : 0,
      isPlaceholder: false,
      isNow: i === props.nowcastStartIndex - 1,
      isForecast: i >= props.nowcastStartIndex,
      isCurrent: i === props.currentFrameIndex,
    }))
  }

  // No forecast frames — generate placeholders for +2 hours
  const lastPastTime = props.frames[props.frames.length - 1].time
  const INTERVAL = 600 // 10 minutes in seconds
  const FUTURE_DURATION = 7200 // 2 hours in seconds
  const placeholderCount = Math.floor(FUTURE_DURATION / INTERVAL) // 12 placeholders

  // Total timeline: real frames + placeholders
  // Real frames span from frames[0].time to lastPastTime
  // Placeholders span from lastPastTime + INTERVAL to lastPastTime + FUTURE_DURATION
  const timelineStart = props.frames[0].time
  const timelineEnd = lastPastTime + FUTURE_DURATION
  const totalDuration = timelineEnd - timelineStart

  const entries: TickEntry[] = []

  // Real frame ticks
  for (let i = 0; i < props.frames.length; i++) {
    entries.push({
      time: props.frames[i].time,
      percent: ((props.frames[i].time - timelineStart) / totalDuration) * 100,
      isPlaceholder: false,
      isNow: i === props.frames.length - 1, // last real frame = "now"
      isForecast: false,
      isCurrent: i === props.currentFrameIndex,
    })
  }

  // Placeholder ticks
  for (let p = 1; p <= placeholderCount; p++) {
    const t = lastPastTime + p * INTERVAL
    entries.push({
      time: t,
      percent: ((t - timelineStart) / totalDuration) * 100,
      isPlaceholder: true,
      isNow: false,
      isForecast: true,
      isCurrent: false,
    })
  }

  return entries
})

/** Percentage position (0–100) of the thumb */
const thumbPosition = computed<number>(() => {
  if (props.frames.length <= 1) return 0
  // Find the tick that matches the current frame index (non-placeholder ticks)
  const realTicks = ticks.value.filter(t => !t.isPlaceholder)
  if (realTicks.length === 0) return 0
  const currentTick = realTicks[props.currentFrameIndex]
  return currentTick ? currentTick.percent : 0
})

/** Width of the filled portion up to current frame */
const filledWidth = computed<number>(() => thumbPosition.value)

/** Percentage position (0–100) of the "now" boundary on the track */
const nowPosition = computed<number>(() => {
  const nowTick = ticks.value.find(t => t.isNow)
  return nowTick ? nowTick.percent : 100
})

// ---------------------------------------------------------------------------
// Pointer / drag handling
// ---------------------------------------------------------------------------
const trackRef = ref<HTMLElement | null>(null)

function calcIndexFromPointer(e: PointerEvent): number {
  const el = trackRef.value
  if (!el || props.frames.length === 0) return 0
  const rect = el.getBoundingClientRect()
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const ratio = x / rect.width
  // Map the ratio to the tick timeline, but clamp to the last real frame
  const percent = ratio * 100
  // Find the closest real (non-placeholder) tick
  const realTicks = ticks.value.filter(t => !t.isPlaceholder)
  let closest = 0
  let minDist = Infinity
  for (let i = 0; i < realTicks.length; i++) {
    const dist = Math.abs(realTicks[i].percent - percent)
    if (dist < minDist) {
      minDist = dist
      closest = i
    }
  }
  return closest
}

function onPointerDown(event: PointerEvent): void {
  emit('scrub-start')

  const el = event.currentTarget as HTMLElement
  el.setPointerCapture(event.pointerId)

  emit('update:currentFrameIndex', calcIndexFromPointer(event))

  function onMove(e: PointerEvent) {
    emit('update:currentFrameIndex', calcIndexFromPointer(e))
  }

  function onUp() {
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
  }

  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
}
</script>

<template>
  <div class="select-none">
    <!-- Track + thumb wrapper -->
    <div
      ref="trackRef"
      class="relative flex cursor-pointer items-center py-3"
      role="slider"
      :aria-valuemin="0"
      :aria-valuemax="frameCount - 1"
      :aria-valuenow="currentFrameIndex"
      aria-label="Radar timeline"
      @pointerdown="onPointerDown"
    >
      <!-- ── Track ───────────────────────────────────────────────────── -->
      <div class="relative h-1.5 w-full rounded-full bg-white/15">
        <!-- Past fill (blue) -->
        <div
          v-if="currentFrameIndex < nowcastStartIndex || !hasNowcast"
          class="absolute inset-y-0 left-0 rounded-full bg-blue-400"
          :style="{ width: `${filledWidth}%` }"
        />

        <!-- Forecast zone: full blue past + amber forecast portion -->
        <template v-else>
          <div
            class="absolute inset-y-0 left-0 rounded-l-full bg-blue-400"
            :style="{ width: `${nowPosition}%` }"
          />
          <div
            class="absolute inset-y-0 bg-amber-400"
            :style="{
              left: `${nowPosition}%`,
              width: `${filledWidth - nowPosition}%`,
            }"
          />
        </template>

        <!-- "Now" divider line on track -->
        <div
          v-if="frames.length > 0"
          class="absolute top-1/2 z-10 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white/80"
          :style="{ left: `${nowPosition}%` }"
        />
      </div>

      <!-- ── Thumb ─────────────────────────────────────────────────── -->
      <div
        class="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        :style="{ left: `${thumbPosition}%` }"
      >
        <div class="flex size-[44px] items-center justify-center">
          <div
            class="size-5 rounded-full ring-2 ring-white/80 transition-colors duration-150"
            :class="isNowcast ? 'bg-amber-400' : 'bg-blue-400'"
          />
        </div>
      </div>
    </div>

    <!-- ── Tick marks ────────────────────────────────────────────────── -->
    <div class="relative h-4">
      <div
        v-for="tick in ticks"
        :key="'tick-' + tick.time"
        class="absolute top-0"
        :style="{ left: `${tick.percent}%` }"
      >
        <div
          class="w-px -translate-x-1/2"
          :class="[
            tick.isNow
              ? 'h-4 bg-white'
              : tick.isCurrent
                ? 'h-3.5 bg-white/70'
                : tick.isPlaceholder
                  ? 'h-3 bg-white/[0.07]'
                  : tick.isForecast
                    ? 'h-3 bg-amber-400/30'
                    : 'h-3 bg-white/20',
          ]"
        />
      </div>
    </div>

    <!-- ── Current time display ──────────────────────────────────────── -->
    <div class="mt-1 text-center">
      <span
        class="text-sm font-semibold tabular-nums"
        :class="isNowcast ? 'text-amber-400' : 'text-white'"
      >
        {{ currentTimeLabel }}
      </span>
      <span
        v-if="isNowcast"
        class="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-400/70"
      >
        forecast
      </span>
      <span
        v-else-if="ticks.find(t => t.isNow && t.isCurrent)"
        class="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-white/50"
      >
        now
      </span>
    </div>

    <!-- ── No forecast hint ──────────────────────────────────────────── -->
    <p
      v-if="framesLoaded && !hasNowcast"
      class="mt-1 text-center text-[10px] text-white/40"
    >
      No forecast available
    </p>
  </div>
</template>
