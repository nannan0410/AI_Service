import type { Activity } from '@/types'

/** 餐饮菜系偏好（封闭目录，演示关键词；正式版可由 LLM 归并） */
export type DiningCuisinePreference = 'chinese' | 'western' | 'snack'

const CUISINE_TAG: Record<DiningCuisinePreference, string> = {
  chinese: '中餐',
  western: '西餐',
  snack: '小吃',
}

/** 从用户话术识别菜系约束 */
export function resolveDiningCuisinePreference(
  message: string,
): DiningCuisinePreference | null {
  const text = message.trim()
  if (!text) return null
  if (/冰淇淋|雪糕|甜品|小吃|零食|点心/.test(text)) return 'snack'
  if (/西餐|西式|牛排|披萨|意面|汉堡|咖啡厅/.test(text)) return 'western'
  if (/中餐|中式|川菜|粤菜|湘菜|火锅|面馆|米饭|盖浇|中午饭|中国菜/.test(text)) {
    return 'chinese'
  }
  // 「饿了 / 想吃饭」不单独定菜系
  return null
}

export function cuisinePreferenceLabel(
  pref: DiningCuisinePreference,
): string {
  return CUISINE_TAG[pref]
}

/** 按菜系 tag 过滤；无命中时回落原列表，避免空推荐 */
export function filterDiningByCuisine(
  activities: Activity[],
  preference: DiningCuisinePreference | null,
): { list: Activity[]; filtered: boolean; label?: string } {
  if (!preference) return { list: activities, filtered: false }
  const tag = CUISINE_TAG[preference]
  const matched = activities.filter((a) => a.tags?.includes(tag))
  if (!matched.length) {
    return { list: activities, filtered: false, label: tag }
  }
  return { list: matched, filtered: true, label: tag }
}
