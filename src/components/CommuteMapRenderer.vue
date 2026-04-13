<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { computed, ref, watch } from 'vue'
import { LMap, LTileLayer, LMarker, LPolyline } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import type { CurrentWeather } from '@/types/weather'
import { calculateBearing, calculateHeadwind } from '@/services/routingService'
import { fetchCurrentWeather } from '@/services/weatherService'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const props = defineProps<{
  route: unknown
  origin: { lat: number; lon: number; name: string }
  destination: { lat: number; lon: number; name: string }
  weather: CurrentWeather | null
  bearing: number
}>()

const polylinePoints = computed(() => {
  if (!props.route || !props.route.geometry) return []
  return props.route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
})

const mapCenter = computed<[number, number]>(() => {
  if (polylinePoints.value.length > 0) {
    const midIndex = Math.floor(polylinePoints.value.length / 2)
    return polylinePoints.value[midIndex]
  }
  return [props.origin.lat, props.origin.lon]
})

const bounds = computed(() => {
  if (polylinePoints.value.length > 0) {
    return L.latLngBounds(polylinePoints.value)
  }
  return null
})

const originIcon = L.divIcon({
  html: `
    <div style="transform: translate(-50%, -100%);">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#3b82f6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3" fill="white" stroke="none"></circle>
      </svg>
    </div>
  `,
  className: 'custom-origin-icon',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
})

const destinationIcon = L.divIcon({
  html: `
    <div style="transform: translate(-50%, -100%);">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#f97316" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <path d="M9 7h6v5H9V7z" fill="white" stroke="none"></path>
        <line x1="9" y1="15" x2="9" y2="7" stroke="white" stroke-width="2"></line>
      </svg>
    </div>
  `,
  className: 'custom-destination-icon',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
})

interface WindMarker {
  latLng: [number, number]
  windDir: number
  windSpeed: number
  color: string
  isHeadwind: boolean
}

const windMarkers = ref<WindMarker[]>([])

watch(
  polylinePoints,
  async (points) => {
    if (points.length < 2) {
      windMarkers.value = []
      return
    }

    const step = Math.floor(points.length / 4)
    const promises = []

    for (let i = step; i < points.length - step; i += step) {
      const pt = points[i]

      // Calculate local bearing for this segment
      const nextPt = points[Math.min(i + 1, points.length - 1)]
      const prevPt = points[Math.max(i - 1, 0)]

      // Bearing from prevPt to nextPt (Leaflet coordinates are [lat, lon])
      const segmentBearing = calculateBearing(prevPt[0], prevPt[1], nextPt[0], nextPt[1])

      promises.push(
        (async () => {
          try {
            const localWeather = await fetchCurrentWeather(pt[0], pt[1])
            const headwind = calculateHeadwind(
              localWeather.windSpeed,
              localWeather.windDirection,
              segmentBearing,
            )
            const isHeadwind = headwind > 0
            const color = isHeadwind ? '#ef4444' : '#22c55e' // red for head, green for tail

            return {
              latLng: pt,
              windDir: localWeather.windDirection,
              windSpeed: localWeather.windSpeed,
              color,
              isHeadwind,
            }
          } catch (err) {
            console.error('Failed fetching local weather for marker', err)
            return null
          }
        })(),
      )
    }

    const results = await Promise.all(promises)
    windMarkers.value = results.filter((r) => r !== null)
  },
  { immediate: true },
)

function getWindIcon(marker: WindMarker) {
  // Arrow pointing in the direction wind is blowing TO (which is windDirection + 180 mod 360)
  // E.g. Wind from North (0) blows TO South (180).
  const arrowAngle = (marker.windDir + 180) % 360

  const html = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 3px; background: white; padding: 2px 6px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); border: 1px solid ${marker.color}; color: ${marker.color}; font-weight: bold; font-size: 11px; font-family: ui-sans-serif, system-ui, sans-serif; white-space: nowrap; width: max-content;">
      <div style="transform: rotate(${arrowAngle}deg); display: flex; align-items: center; justify-content: center;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
      </div>
      <span>${Math.round(marker.windSpeed)} <span style="font-size: 9px; opacity: 0.8; font-weight: 500;">km/h</span></span>
    </div>
  `
  // We specify iconAnchor so the center of the arrow is roughly on the line.
  return L.divIcon({
    html,
    className: 'wind-arrow-icon',
    iconSize: [64, 24],
    iconAnchor: [32, 12],
  })
}
</script>

<template>
  <LMap
    class="z-0 h-full w-full"
    :zoom="12"
    :center="mapCenter"
    :bounds="bounds"
    :bounds-options="{ padding: [20, 20] }"
    :use-global-leaflet="false"
  >
    <LTileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      layer-type="base"
      name="OpenStreetMap"
      attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
      :max-zoom="19"
      class="map-tiles"
    />

    <LPolyline
      v-if="polylinePoints.length > 0"
      :lat-lngs="polylinePoints"
      color="#f97316"
      :weight="5"
    />

    <LMarker :lat-lng="[props.origin.lat, props.origin.lon]" :icon="originIcon"> </LMarker>

    <LMarker :lat-lng="[props.destination.lat, props.destination.lon]" :icon="destinationIcon">
    </LMarker>

    <LMarker
      v-for="(marker, idx) in windMarkers"
      :key="idx"
      :lat-lng="marker.latLng"
      :icon="getWindIcon(marker)"
    >
    </LMarker>
  </LMap>
</template>

<style>
.dark .map-tiles {
  filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
}
.wind-arrow-icon {
  background: transparent;
  border: none;
}
</style>
