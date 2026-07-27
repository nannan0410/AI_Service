import type { MapPoi, SessionContext, VisitorState } from '@/types'

export function buildSessionContext(input: {
  scenicId: string | null
  visitorState?: Pick<VisitorState, 'inPark' | 'currentLocation'> | null
  intent?: string
  activeSkillId?: string
  currentOrder?: SessionContext['currentOrder']
  locationPoi?: MapPoi | null
}): SessionContext {
  const inPark = input.visitorState?.inPark === true
  const label = input.visitorState?.currentLocation?.trim() || ''
  return {
    scenicId: input.scenicId,
    visitStatus: inPark ? 'in_park' : 'off_park',
    location: {
      label,
      mapPoiId: input.locationPoi?.poiId,
      area: input.locationPoi?.area || label || undefined,
    },
    time: new Date().toISOString(),
    intent: input.intent,
    activeSkillId: input.activeSkillId,
    currentOrder: input.currentOrder,
  }
}

/** 用当前位置文案匹配 POI（area / name / location 模糊） */
export function matchPoiByLocationLabel(
  label: string | undefined | null,
  pois: MapPoi[],
): MapPoi | null {
  const text = label?.trim()
  if (!text || !pois.length) return null
  const exact = pois.find(
    (p) => p.area === text || p.name === text || p.name.includes(text) || text.includes(p.name),
  )
  if (exact) return exact
  return (
    pois.find(
      (p) =>
        (p.area && (text.includes(p.area) || p.area.includes(text))) ||
        text.includes(p.name.slice(0, 2)),
    ) ?? null
  )
}
