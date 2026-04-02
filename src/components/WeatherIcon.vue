<script setup lang="ts">
/**
 * WeatherIcon
 *
 * Renders an inline SVG weather icon for a WMO weather code with an optional
 * intensity variant. This is the single shared primitive for current, hourly,
 * and daily weather views.
 *
 * Props
 * ─────
 * code        (required) — WMO weather code (number)
 * intensity   (optional) — 'light' | 'moderate' | 'heavy'
 *             When provided, codes that support intensity differentiation
 *             (rain, drizzle, snow, showers) may return a distinct SVG variant.
 *             Omit to use the code's natural icon.
 * isDay       (optional) — pass `false` to use night icon variants (moon
 *             instead of sun for clear/partly-cloudy/shower codes).
 * size        (optional) — pixel size for the SVG (width & height). Defaults to 32.
 * label       (optional) — Accessible label string. When omitted the element
 *             is marked aria-hidden="true" (decorative).
 *
 * Usage examples
 * ──────────────
 * <!-- Plain — code only, decorative -->
 * <WeatherIcon :code="weatherCode" />
 *
 * <!-- With intensity hint -->
 * <WeatherIcon :code="63" intensity="heavy" />
 *
 * <!-- Night mode -->
 * <WeatherIcon :code="0" :is-day="false" />
 *
 * <!-- Custom size + accessible label -->
 * <WeatherIcon :code="0" :size="64" label="Clear sky" />
 */
import { computed } from 'vue'
import { getWeatherSvgIcon, getWeatherDescription } from '@/utils/weatherCodes'
import type { WeatherIntensity } from '@/utils/weatherCodes'

const props = withDefaults(
  defineProps<{
    /** WMO weather code */
    code: number
    /** Optional precipitation / severity intensity hint */
    intensity?: WeatherIntensity
    /** Whether it is daytime. Pass false to use night icon variants. */
    isDay?: boolean | null
    /** SVG size in pixels (width & height, default: 32) */
    size?: number
    /** Accessible label — omit for decorative icons */
    label?: string
  }>(),
  {
    intensity: undefined,
    isDay: undefined,
    size: 32,
    label: undefined,
  },
)

const svgPath = computed(() => getWeatherSvgIcon(props.code, props.intensity, props.isDay))
const ariaLabel = computed(() => props.label ?? getWeatherDescription(props.code))
const isDecorative = computed(() => props.label === undefined)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="select-none shrink-0"
    v-bind="isDecorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': ariaLabel }"
    v-html="svgPath"
  />
</template>
