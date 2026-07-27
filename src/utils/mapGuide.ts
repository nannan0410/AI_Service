import type { MapConfig, MapPoi } from '@/types'

export function hasMapGuideForScenic(config: MapConfig | null | undefined): boolean {
  return Boolean(config?.mapImageUrl && config.enabled !== false)
}

export function buildMapDeepLink(options: {
  scenicId: string
  poiId?: string
}): string {
  const params = new URLSearchParams()
  params.set('scenicId', options.scenicId)
  if (options.poiId) params.set('poiId', options.poiId)
  return `/map?${params.toString()}`
}

export function findPoiByActivityId(
  pois: MapPoi[],
  activityId: string | undefined,
): MapPoi | null {
  if (!activityId) return null
  return pois.find((p) => p.activityId === activityId) ?? null
}

export function findPoiById(pois: MapPoi[], poiId: string | undefined): MapPoi | null {
  if (!poiId) return null
  return pois.find((p) => p.poiId === poiId) ?? null
}

/** 按当前位置 area 筛「附近」项目（同区优先，否则热门） */
export function sortActivitiesNearArea<
  T extends { location?: string; area?: string; isHot?: boolean; name: string },
>(items: T[], areaLabel: string | undefined): T[] {
  const area = areaLabel?.trim()
  if (!area) {
    return [...items].sort((a, b) => Number(b.isHot) - Number(a.isHot))
  }
  return [...items].sort((a, b) => {
    const aHit = Number(
      a.location === area ||
        a.area === area ||
        (a.location && (a.location.includes(area) || area.includes(a.location))),
    )
    const bHit = Number(
      b.location === area ||
        b.area === area ||
        (b.location && (b.location.includes(area) || area.includes(b.location))),
    )
    if (aHit !== bHit) return bHit - aHit
    return Number(b.isHot) - Number(a.isHot)
  })
}
