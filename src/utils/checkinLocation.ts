/** 演示版：当前位置与打卡点 location 一致（或互相包含）视为在附近 */
export function isNearCheckinSpot(
  currentLocation: string | undefined,
  spotLocation: string | undefined,
): boolean {
  const current = currentLocation?.trim() ?? ''
  const spot = spotLocation?.trim() ?? ''
  if (!current || !spot) return false
  return current === spot || current.includes(spot) || spot.includes(current)
}
