import catalogJson from '@/mock/assistant/skill_intent_catalog.json'
import type { SkillIntentCatalog, SkillSubIntentDef } from '@/types/businessConfig'

const catalog = catalogJson as SkillIntentCatalog

export function getSkillSubIntents(skillId: string): SkillSubIntentDef[] {
  return catalog[skillId] ?? []
}

export function getLockedKeywordsForSkill(skillId: string): string[] {
  const set = new Set<string>()
  for (const intent of getSkillSubIntents(skillId)) {
    for (const word of intent.keywords) {
      set.add(word)
    }
  }
  return [...set]
}

export function isLockedKeyword(skillId: string, keyword: string): boolean {
  return getLockedKeywordsForSkill(skillId).includes(keyword)
}

export function getSkillIntentCatalog(): SkillIntentCatalog {
  return catalog
}
