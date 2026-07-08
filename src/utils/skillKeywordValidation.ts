import type { AssistantSkillConfig } from '@/types'
import { getLockedKeywordsForSkill } from '@/utils/skillIntentCatalog'

export interface KeywordConflict {
  keyword: string
  skillIds: string[]
}

export interface SkillKeywordValidationResult {
  ok: boolean
  conflicts: KeywordConflict[]
  missingBySkill: Array<{ skillId: string; name: string; missing: string[] }>
}

/** 合并子意图锁定词到 Skill 触发词（去重，锁定词在前） */
export function mergeLockedKeywordsIntoTriggerKeywords(
  skill: Pick<AssistantSkillConfig, 'skillId' | 'triggerKeywords'>,
): string[] {
  const locked = getLockedKeywordsForSkill(skill.skillId)
  const current = skill.triggerKeywords ?? []
  const extension = current.filter((word) => !locked.includes(word))
  return [...locked, ...extension]
}

export function findKeywordConflictsAcrossSkills(
  skills: AssistantSkillConfig[],
): KeywordConflict[] {
  const owner = new Map<string, Set<string>>()

  for (const skill of skills) {
    for (const word of skill.triggerKeywords ?? []) {
      const trimmed = word.trim()
      if (!trimmed) continue
      const ids = owner.get(trimmed) ?? new Set<string>()
      ids.add(skill.skillId)
      owner.set(trimmed, ids)
    }
  }

  const conflicts: KeywordConflict[] = []
  for (const [keyword, skillIds] of owner.entries()) {
    if (skillIds.size > 1) {
      conflicts.push({ keyword, skillIds: [...skillIds] })
    }
  }
  return conflicts.sort((a, b) => a.keyword.localeCompare(b.keyword, 'zh-CN'))
}

export function findMissingLockedKeywords(
  skill: AssistantSkillConfig,
): string[] {
  const locked = getLockedKeywordsForSkill(skill.skillId)
  const current = new Set(skill.triggerKeywords ?? [])
  return locked.filter((word) => !current.has(word))
}

/** 为所有 Skill 补全子意图锁定词（LocalStorage 旧覆盖可能缺失） */
export function normalizeSkillsTriggerKeywords(
  skills: AssistantSkillConfig[],
): AssistantSkillConfig[] {
  return skills.map((skill) => ({
    ...skill,
    triggerKeywords: mergeLockedKeywordsIntoTriggerKeywords(skill),
  }))
}

export function validateSkillTriggerKeywords(
  skills: AssistantSkillConfig[],
): SkillKeywordValidationResult {
  const conflicts = findKeywordConflictsAcrossSkills(skills)
  const missingBySkill = skills
    .map((skill) => ({
      skillId: skill.skillId,
      name: skill.name,
      missing: findMissingLockedKeywords(skill),
    }))
    .filter((item) => item.missing.length > 0)

  return {
    ok: conflicts.length === 0 && missingBySkill.length === 0,
    conflicts,
    missingBySkill,
  }
}

export function formatSkillKeywordValidationErrors(
  result: SkillKeywordValidationResult,
  skills: AssistantSkillConfig[],
): string {
  const lines: string[] = []
  const nameById = new Map(skills.map((s) => [s.skillId, s.name]))

  if (result.conflicts.length) {
    lines.push('触发关键词在多个 Skill 间重复：')
    for (const { keyword, skillIds } of result.conflicts) {
      const labels = skillIds
        .map((id) => `${nameById.get(id) ?? id}（${id}）`)
        .join('、')
      lines.push(`·「${keyword}」：${labels}`)
    }
  }

  if (result.missingBySkill.length) {
    lines.push('以下 Skill 缺少子意图必选关键词：')
    for (const { name, skillId, missing } of result.missingBySkill) {
      lines.push(`·${name}（${skillId}）：${missing.join('、')}`)
    }
  }

  return lines.join('\n')
}

export function findKeywordOwnerSkillId(
  skills: AssistantSkillConfig[],
  keyword: string,
  excludeSkillId?: string,
): string | null {
  const trimmed = keyword.trim()
  if (!trimmed) return null

  for (const skill of skills) {
    if (excludeSkillId && skill.skillId === excludeSkillId) continue
    if ((skill.triggerKeywords ?? []).includes(trimmed)) {
      return skill.skillId
    }
  }
  return null
}
