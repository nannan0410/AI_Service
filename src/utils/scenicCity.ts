import type { CityProfile } from '@/types'
import defaultCities from '@/mock/scenic/cities.json'

export const DEFAULT_CITY_ID = 'city_sh'

const cities = defaultCities as CityProfile[]

/** 演示用：根据坐标取最近城市；无坐标则回落上海 */
export function resolveDefaultCityId(coords?: {
  lat?: number | null
  lng?: number | null
} | null): string {
  const lat = coords?.lat
  const lng = coords?.lng
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return DEFAULT_CITY_ID
  }

  let bestId = DEFAULT_CITY_ID
  let bestDist = Number.POSITIVE_INFINITY
  for (const city of cities) {
    if (city.enabled === false) continue
    if (city.lat == null || city.lng == null) continue
    const dLat = city.lat - lat
    const dLng = city.lng - lng
    const dist = dLat * dLat + dLng * dLng
    if (dist < bestDist) {
      bestDist = dist
      bestId = city.cityId
    }
  }
  return bestId
}

/**
 * 浏览器定位（演示版）。失败 / 拒绝 / 超时 → null，由调用方回落默认城市。
 */
export function detectDeviceCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 2500)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer)
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {
        window.clearTimeout(timer)
        resolve(null)
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 2000 },
    )
  })
}

export async function resolveLocatedCityId(): Promise<string> {
  const coords = await detectDeviceCoords()
  return resolveDefaultCityId(coords)
}
