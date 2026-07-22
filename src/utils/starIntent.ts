/** 动物明星介绍意图（演示：企鹅 / 白鲸）；不做独立「我想答题」入口 */
export function shouldRunStarIntroWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return /企鹅|白鲸/.test(text)
}
