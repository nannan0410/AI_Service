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

/** 导览图坐标粗估距离（百分比坐标差 → 演示「步行约 N 分钟」） */
export function estimateWalkMinutesFromMap(
  from: Pick<MapPoi, 'mapX' | 'mapY'> | null | undefined,
  to: Pick<MapPoi, 'mapX' | 'mapY'> | null | undefined,
): number | null {
  if (!from || !to) return null
  if (
    typeof from.mapX !== 'number' ||
    typeof from.mapY !== 'number' ||
    typeof to.mapX !== 'number' ||
    typeof to.mapY !== 'number'
  ) {
    return null
  }
  const dx = from.mapX - to.mapX
  const dy = from.mapY - to.mapY
  const dist = Math.sqrt(dx * dx + dy * dy)
  // 约每 8 个坐标单位 ≈ 1 分钟，夹在 1～18
  return Math.min(18, Math.max(1, Math.round(dist / 8)))
}

/**
 * 相对当前位置的距离文案（演示）
 * - 同区：就在附近
 * - 有坐标：步行约 N 分钟 · 所在区
 * - 否则：位于「xx」
 */
export function formatRelativeLocationLabel(options: {
  currentArea?: string
  activityLocation?: string
  walkMinutes?: number | null
  targetArea?: string
}): string {
  const current = options.currentArea?.trim()
  const loc = options.activityLocation?.trim()
  const targetArea = options.targetArea?.trim() || loc
  const sameArea =
    Boolean(current) &&
    Boolean(loc) &&
    (loc === current || loc!.includes(current!) || current!.includes(loc!))

  if (sameArea) {
    return `就在「${current}」附近`
  }
  if (options.walkMinutes != null && options.walkMinutes > 0) {
    const areaBit = targetArea ? ` · ${targetArea}` : ''
    return `步行约 ${options.walkMinutes} 分钟${areaBit}`
  }
  if (targetArea) return `位于「${targetArea}」`
  return '园区内'
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
