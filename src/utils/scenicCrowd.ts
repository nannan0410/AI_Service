/**
 * 欢迎页景区客流（本地 Mock）
 * 演示：每次进入欢迎页随机三档；后续可改为 `/api/crowd?scenicId=`
 */
export type CrowdLevel = 'idle' | 'normal' | 'busy'

export interface ScenicCrowdStatus {
  level: CrowdLevel
  text: string
}

const CROWD_LEVELS: CrowdLevel[] = ['idle', 'normal', 'busy']

/** 口语化客流文案 */
export const CROWD_COPY: Record<CrowdLevel, string> = {
  idle: '人不多，逛起来很舒服',
  normal: '客流还好，不用太赶',
  busy: '有点挤，热门项目建议错峰',
}

export function pickRandomCrowdLevel(): CrowdLevel {
  const index = Math.floor(Math.random() * CROWD_LEVELS.length)
  return CROWD_LEVELS[index] ?? 'normal'
}

export function formatScenicCrowdLine(level: CrowdLevel = 'normal'): string {
  return CROWD_COPY[level]
}

/** 随机一档客流状态（进入欢迎页 / 对话查询时调用） */
export function getRandomScenicCrowd(): ScenicCrowdStatus {
  const level = pickRandomCrowdLevel()
  return { level, text: formatScenicCrowdLine(level) }
}

/** 对话回复用：👥 前缀 + 口语文案 */
export function formatScenicCrowdChatLine(level?: CrowdLevel): string {
  const status = level
    ? { level, text: formatScenicCrowdLine(level) }
    : getRandomScenicCrowd()
  return `👥 人流：${status.text}`
}
