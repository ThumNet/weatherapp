export interface RoutePoint {
  lat: number
  lon: number
}

export interface RouteFeature {
  geometry: {
    coordinates: [number, number][] // [lon, lat]
  }
  distance: number
  duration: number
}

export async function fetchBikeRoute(start: RoutePoint, end: RoutePoint): Promise<RouteFeature | null> {
  const url = `https://router.project-osrm.org/route/v1/bicycle/${start.lon},${start.lat};${end.lon},${end.lat}?geometries=geojson&overview=full`
  
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      }
    }
    return null
  } catch (e) {
    console.error('Failed to fetch route', e)
    return null
  }
}

export function calculateBearing(startLat: number, startLon: number, endLat: number, endLon: number): number {
  const toRad = (val: number) => (val * Math.PI) / 180
  const toDeg = (val: number) => (val * 180) / Math.PI

  const dLon = toRad(endLon - startLon)
  const y = Math.sin(dLon) * Math.cos(toRad(endLat))
  const x = Math.cos(toRad(startLat)) * Math.sin(toRad(endLat)) -
            Math.sin(toRad(startLat)) * Math.cos(toRad(endLat)) * Math.cos(dLon)
  
  let bearing = toDeg(Math.atan2(y, x))
  return (bearing + 360) % 360
}

export function calculateHeadwind(windSpeed: number, windDirection: number, bearing: number): number {
  const toRad = (val: number) => (val * Math.PI) / 180
  const angleDiff = toRad(windDirection - bearing)
  return windSpeed * Math.cos(angleDiff) // positive is headwind, negative is tailwind
}
