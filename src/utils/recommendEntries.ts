import type { PersonaId, RecommendEntry } from '@/types'
import type { RecommendEntryConfig } from '@/types/businessConfig'
import {
  buildDemoRuleContext,
  type DemoRuleLiveOverrides,
} from '@/utils/demoRuleContext'
import { evaluateRules } from '@/utils/ruleEngine'
import { matchesScenicScope } from '@/utils/scenicScope'

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

/** 按景区 + persona 规则过滤，并按 priority 降序 */
export function resolveActiveRecommendEntries(
  entries: RecommendEntryConfig[],
  personaId: PersonaId,
  live?: DemoRuleLiveOverrides,
): RecommendEntry[] {
  const ctx = buildDemoRuleContext(personaId, live)
  return entries
    .filter((entry) => entry.enabled !== false)
    .filter((entry) => matchesScenicScope(entry, ctx.scenicId))
    .filter((entry) => evaluateRules(entry.rules, ctx))
    .sort((a, b) => b.priority - a.priority)
    .map(toRecommendEntry)
}

/** 预览：返回命中与未命中的入口（供配置后台） */
export function previewRecommendEntries(
  entries: RecommendEntryConfig[],
  personaId: PersonaId,
  live?: DemoRuleLiveOverrides,
): { matched: RecommendEntryConfig[]; unmatched: RecommendEntryConfig[] } {
  const ctx = buildDemoRuleContext(personaId, live)
  const enabled = entries
    .filter((entry) => entry.enabled !== false)
    .filter((entry) => matchesScenicScope(entry, ctx.scenicId))
  const matched = enabled
    .filter((entry) => evaluateRules(entry.rules, ctx))
    .sort((a, b) => b.priority - a.priority)
  const matchedIds = new Set(matched.map((e) => e.entryId))
  const unmatched = enabled.filter((entry) => !matchedIds.has(entry.entryId))
  return { matched, unmatched }
}
