import type { Activity } from '@/types'
import { filterByBusinessScenicId } from '@/utils/scenicScope'

const MIN_ALIAS_LEN = 2

/**
 * 话术与项目名模糊匹配得分（越高越优先）：
 * - 话术包含全名
 * - 全名包含整句短话术（如「过山车」→「极限过山车」）
 * - 名称中连续片段出现在话术中（如「过山车怎么样」）
 */
export function scoreActivityNameMatch(message: string, name: string): number {
  const text = message.trim()
  const activityName = name.trim()
  if (!text || !activityName) return 0

  if (text.includes(activityName)) return 1000 + activityName.length
  if (text.length >= MIN_ALIAS_LEN && activityName.includes(text)) {
    return 800 + text.length
  }

  let bestPart = 0
  for (let len = activityName.length - 1; len >= MIN_ALIAS_LEN; len -= 1) {
    for (let i = 0; i + len <= activityName.length; i += 1) {
      const part = activityName.slice(i, i + len)
      if (text.includes(part) && part.length > bestPart) {
        bestPart = part.length
      }
    }
    if (bestPart >= len) break
  }
  return bestPart > 0 ? 500 + bestPart : 0
}

/** 在候选项目中按名称模糊匹配，同分时名称更长优先 */
export function matchActivityByName(
  message: string,
  candidates: Activity[],
  scenicId?: string | null,
): Activity | null {
  const text = message.trim()
  if (!text || !candidates.length) return null

  const scoped = filterByBusinessScenicId(candidates, scenicId)
  let best: Activity | null = null
  let bestScore = 0

  for (const activity of scoped) {
    const score = scoreActivityNameMatch(text, activity.name)
    if (score <= 0) continue
    if (
      score > bestScore ||
      (score === bestScore &&
        best != null &&
        activity.name.length > best.name.length)
    ) {
      best = activity
      bestScore = score
    }
  }
  return best
}
