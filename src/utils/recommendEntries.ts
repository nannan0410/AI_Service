import type { PersonaId, RecommendEntry } from '@/types'
import type { RecommendEntryConfig } from '@/types/businessConfig'
import { buildDemoRuleContext } from '@/utils/demoRuleContext'
import { evaluateRules } from '@/utils/ruleEngine'

export function toRecommendEntry(config: RecommendEntryConfig): RecommendEntry {
  return {
    entryId: config.entryId,
    title: config.title,
    icon: config.icon,
    target: config.target,
    targetPath: config.targetPath,
    skillId: config.skillId,
    promptHint: config.promptHint,
    priority: config.priority,
  }
}

/** 按 persona 过滤 enabled + 规则命中，并按 priority 降序 */
export function resolveActiveRecommendEntries(
  entries: RecommendEntryConfig[],
  personaId: PersonaId,
): RecommendEntry[] {
  const ctx = buildDemoRuleContext(personaId)
  return entries
    .filter((entry) => entry.enabled !== false)
    .filter((entry) => evaluateRules(entry.rules, ctx))
    .sort((a, b) => b.priority - a.priority)
    .map(toRecommendEntry)
}

/** 预览：返回命中与未命中的入口（供配置后台） */
export function previewRecommendEntries(
  entries: RecommendEntryConfig[],
  personaId: PersonaId,
): { matched: RecommendEntryConfig[]; unmatched: RecommendEntryConfig[] } {
  const ctx = buildDemoRuleContext(personaId)
  const enabled = entries.filter((entry) => entry.enabled !== false)
  const matched = enabled
    .filter((entry) => evaluateRules(entry.rules, ctx))
    .sort((a, b) => b.priority - a.priority)
  const matchedIds = new Set(matched.map((e) => e.entryId))
  const unmatched = enabled.filter((entry) => !matchedIds.has(entry.entryId))
  return { matched, unmatched }
}
