import { fetchCheckinSpots } from '@/api/business'
import { applyInParkActionsToCard } from '@/utils/activityCardActions'
import {
  listTodayShowSlots,
  remainingTimesForActivity,
} from '@/utils/showSchedule'
import type { Activity, ActivityCardPayload, CheckinSpot } from '@/types'

let checkinSpotCache: CheckinSpot[] | null = null
let checkinInParkCache: boolean | null = null

export async function loadCheckinContext(): Promise<{
  inPark: boolean
  spotsByActivityId: Map<string, CheckinSpot>
}> {
  try {
    const { data: res } = await fetchCheckinSpots()
    if (res.code === 200 && res.data) {
      checkinInParkCache = res.data.inPark === true
      checkinSpotCache = res.data.spots ?? []
    }
  } catch {
    checkinInParkCache = false
    checkinSpotCache = []
  }
  const spotsByActivityId = new Map<string, CheckinSpot>()
  for (const spot of checkinSpotCache ?? []) {
    if (spot.activityId) spotsByActivityId.set(spot.activityId, spot)
  }
  return {
    inPark: checkinInParkCache === true,
    spotsByActivityId,
  }
}

export function enrichInParkActivityCard(
  card: ActivityCardPayload,
  options: {
    inPark: boolean
    spotsByActivityId: Map<string, CheckinSpot>
    mapPath?: string
    /** 演出：调用方已算好今日剩余场次 */
    remainingShowTimes?: string[]
    now?: Date
    activity?: Activity
  },
): ActivityCardPayload {
  if (!options.inPark) return card

  const withContext: ActivityCardPayload = {
    ...card,
    guideContext: 'in_park',
  }

  let canReserve = false
  if (withContext.category === 'show') {
    if (options.remainingShowTimes) {
      canReserve = options.remainingShowTimes.length > 0
    } else if (options.activity) {
      const slots = listTodayShowSlots([options.activity], options.now)
      canReserve =
        remainingTimesForActivity(
          options.activity.activityId,
          slots,
          options.now,
        ).length > 0
    }
  }

  return applyInParkActionsToCard(withContext, {
    canCheckin: options.spotsByActivityId.has(withContext.activityId),
    mapPath: options.mapPath ?? withContext.mapActions?.[0]?.path,
    canReserve,
  })
}
