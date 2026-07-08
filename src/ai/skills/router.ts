import type { AssistantSkillConfig } from '@/types'
import { isRoutableSkill } from './utils'

interface MatchCandidate {
  skill: AssistantSkillConfig
  keyword: string
}

/**
 * 关键词路由：优先匹配更长、更具体的关键词；同长度按配置顺序。
 */
export function routeSkillByKeywords(
  message: string,
  skills: AssistantSkillConfig[],
): AssistantSkillConfig | null {
  const text = message.trim()
  if (!text) return null

  const candidates: MatchCandidate[] = []

  for (const skill of skills) {
    if (!isRoutableSkill(skill)) continue
    const keywords = skill.triggerKeywords ?? []
    for (const keyword of keywords) {
      if (!keyword) continue
      if (text.includes(keyword)) {
        candidates.push({ skill, keyword })
      }
    }
  }

  if (!candidates.length) return null

  candidates.sort((a, b) => b.keyword.length - a.keyword.length)
  return candidates[0].skill
}

export function getSkillById(
  skills: AssistantSkillConfig[],
  skillId: string,
): AssistantSkillConfig | undefined {
  return skills.find((s) => s.skillId === skillId)
}
