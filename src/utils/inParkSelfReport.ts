/**
 * 欢迎页「是否在园」自报兜底：
 * 当前景区无订单 ∧ 定位未授权/失败 ∧ 尚未作答 → 显示询问。
 */
export function shouldShowInParkSelfReport(options: {
  /** 当前景区订单数（已按景区过滤） */
  scenicOrderCount: number
  /**
   * 定位是否拿到坐标：
   * - true：已授权且成功
   * - false：拒绝 / 失败 / 超时 / 不支持
   * - null：探测中，先不展示以免闪烁
   */
  locationAuthorized: boolean | null
  /** 本会话是否已点选过 */
  answered: boolean
}): boolean {
  if (options.answered) return false
  if (options.locationAuthorized !== false) return false
  return options.scenicOrderCount <= 0
}
