<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { computed } from 'vue'
import { LMap, LTileLayer, LMarker, LPolyline } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import type { CurrentWeather } from '@/types/weather'
import { calculateBearing, calculateHeadwind } from '@/services/routingService'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const props = defineProps<{
  route: any
  home: { lat: number; lon: number; name: string }
  work: { lat: number; lon: number; name: string }
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
  return [props.home.lat, props.home.lon]
})

const bounds = computed(() => {
  if (polylinePoints.value.length > 0) {
    return L.latLngBounds(polylinePoints.value)
  }
  return null
})

const windMarkers = computed(() => {
  if (!props.weather || polylinePoints.value.length < 2) return []
  
  const windDir = props.weather.windDirection
  const markers = []
  const step = Math.floor(polylinePoints.value.length / 4)
  for (let i = step; i < polylinePoints.value.length - step; i += step) {
    const pt = polylinePoints.value[i]
    
    // Calculate local bearing for this segment
    const nextPt = polylinePoints.value[Math.min(i + 1, polylinePoints.value.length - 1)]
    const prevPt = polylinePoints.value[Math.max(i - 1, 0)]
    
    // Bearing from prevPt to nextPt (Leaflet coordinates are [lat, lon])
    const segmentBearing = calculateBearing(prevPt[0], prevPt[1], nextPt[0], nextPt[1])
    
    const headwind = calculateHeadwind(props.weather.windSpeed, windDir, segmentBearing)
    const isHeadwind = headwind > 0
    const color = isHeadwind ? '#ef4444' : '#22c55e' // red for head, green for tail
    
    markers.push({
      latLng: pt,
      windDir: windDir,
      color,
      isHeadwind
    })
  }
  return markers
})

function getWindIcon(marker: any) {
  // Arrow pointing in the direction wind is blowing TO (which is windDirection + 180 mod 360)
  // E.g. Wind from North (0) blows TO South (180).
  const arrowAngle = (marker.windDir + 180) % 360
  
  const html = `
    <div style="transform: rotate(${arrowAngle}deg); color: ${marker.color}; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    </div>
  `
  return L.divIcon({
    html,
    className: 'wind-arrow-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
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

    <LMarker :lat-lng="[props.home.lat, props.home.lon]">
    </LMarker>

    <LMarker :lat-lng="[props.work.lat, props.work.lon]">
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
