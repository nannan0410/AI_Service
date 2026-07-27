import type { CrowdLevel } from '@/utils/scenicCrowd'
import { getRandomScenicCrowd } from '@/utils/scenicCrowd'
import type { Order } from '@/types'

const CARE_HOURS_THRESHOLD = 4

/** 演示：在园但无核销时间时，默认按今日 10:00 入园 */
export function demoDefaultEntryAt(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(10, 0, 0, 0)
  return d
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * 从今日已核销订单取入园/核销时间；无则在园时用演示默认 10:00
 */
export function resolveParkEntryAt(
  orders: Order[] | undefined,
  options: { inPark: boolean; now?: Date },
): Date | null {
  const now = options.now ?? new Date()
  const todayCompleted = (orders ?? [])
    .filter((o) => o.status === 'completed' && o.completedAt)
    .filter((o) => isSameLocalDay(new Date(o.completedAt!), now))
    .sort(
      (a, b) =>
        new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime(),
    )

  if (todayCompleted[0]?.completedAt) {
    return new Date(todayCompleted[0].completedAt)
  }
  if (options.inPark) {
    return demoDefaultEntryAt(now)
  }
  return null
}

export function hoursSinceParkEntry(
  entryAt: Date | null,
  now = new Date(),
): number {
  if (!entryAt) return 0
  return Math.max(0, (now.getTime() - entryAt.getTime()) / (1000 * 60 * 60))
}

export interface NearbyCareTipResult {
  /** 是否展示温馨提示 */
  show: boolean
  text: string
  hoursInPark: number
  crowdLevel: CrowdLevel
}

/**
 * 附近项目场景：逛太久（≥4h）时给歇脚/冰淇淋提示；人流偏忙时语气更强
 */
export function buildNearbyCareTip(options: {
  inPark: boolean
  orders?: Order[]
  crowdLevel?: CrowdLevel
  now?: Date
}): NearbyCareTipResult | null {
  if (!options.inPark) return null
  const now = options.now ?? new Date()
  const entryAt = resolveParkEntryAt(options.orders, {
    inPark: true,
    now,
  })
  const hours = hoursSinceParkEntry(entryAt, now)
  if (hours < CARE_HOURS_THRESHOLD) return null

  const crowdLevel = options.crowdLevel ?? getRandomScenicCrowd().level
  const hoursLabel = Math.floor(hours)
  const busy = crowdLevel === 'busy'

    const text = busy
    ? `温馨提示：您大约已游玩 ${hoursLabel} 小时，园内人流偏多。热门项目可稍后再去，先看看下方「冰淇淋小站」歇歇脚、补充体力会更轻松～`
    : `温馨提示：您大约已游玩 ${hoursLabel} 小时。不妨先到下方「冰淇淋小站」（美食广场）休息片刻，再继续探索～`

  return {
    show: true,
    text,
    hoursInPark: hours,
    crowdLevel,
  }
}
