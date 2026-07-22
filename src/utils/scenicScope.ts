/** 演示默认景区（历史数据未标注 scenicId 时回落） */
export const DEFAULT_SCENIC_ID = 'scenic_hlg'

/** 配置项是否适用于当前景区（无 scenicId/scenicIds 表示全景区通用） */
export function matchesScenicScope(
  item: { scenicId?: string; scenicIds?: string[] },
  scenicId: string | null | undefined,
): boolean {
  if (!scenicId) return true
  if (item.scenicId && item.scenicId !== scenicId) return false
  if (item.scenicIds?.length && !item.scenicIds.includes(scenicId)) return false
  return true
}

/** 业务实体所属景区（订单/活动/内容/票）；缺省视为默认景区 */
export function resolveBusinessScenicId(scenicId?: string | null): string {
  return scenicId?.trim() || DEFAULT_SCENIC_ID
}

/** 订单/活动/内容/票：是否属于当前景区 */
export function matchesBusinessScenicId(
  itemScenicId: string | undefined | null,
  currentScenicId: string | null | undefined,
): boolean {
  if (!currentScenicId) return true
  return resolveBusinessScenicId(itemScenicId) === currentScenicId
}

export function filterByBusinessScenicId<T extends { scenicId?: string }>(
  items: T[],
  scenicId: string | null | undefined,
): T[] {
  if (!scenicId) return items
  return items.filter((item) => matchesBusinessScenicId(item.scenicId, scenicId))
}

/**
 * 券 / 券产品：
 * - 有 scenicId/scenicIds → 按作用域
 * - 都没有 → 集团通用（各景区可见）
 */
export function matchesCouponScenicScope(
  item: { scenicId?: string; scenicIds?: string[] },
  scenicId: string | null | undefined,
): boolean {
  if (!scenicId) return true
  if (!item.scenicId && !item.scenicIds?.length) return true
  return matchesScenicScope(item, scenicId)
}

export function filterCouponsByScenic<T extends { scenicId?: string; scenicIds?: string[] }>(
  items: T[],
  scenicId: string | null | undefined,
): T[] {
  if (!scenicId) return items
  return items.filter((item) => matchesCouponScenicScope(item, scenicId))
}
