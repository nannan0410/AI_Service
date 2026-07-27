import type { AssistantSkillConfig } from '@/types'
import exclusionsJson from '@/mock/assistant/intent_exclusions.json'

/** 路由排他规则（演示只读目录，对应代码层 Workflow 互斥） */
export interface IntentExclusionRule {
  ruleId: string
  name: string
  when: string
  excludeSkillId: string
  preferSkillId: string
  note?: string
  sampleUtterances?: string[]
}

export type RouteConflictSeverity = 'covered' | 'overlap' | 'info'

export interface RouteConflictItem {
  id: string
  severity: RouteConflictSeverity
  title: string
  detail: string
  keyword?: string
  skillIds?: string[]
  ruleId?: string
}

const exclusions = exclusionsJson as IntentExclusionRule[]

export function listIntentExclusionRules(): IntentExclusionRule[] {
  return exclusions.map((r) => ({ ...r }))
}

/** Skill 触发词两两重叠（同一词挂多个 Skill） */
export function findKeywordOverlaps(
  skills: AssistantSkillConfig[],
): Array<{ keyword: string; skillIds: string[] }> {
  const map = new Map<string, string[]>()
  for (const skill of skills) {
    if (skill.enabled === false) continue
    for (const raw of skill.triggerKeywords ?? []) {
      const keyword = String(raw).trim()
      if (!keyword) continue
      const list = map.get(keyword) ?? []
      if (!list.includes(skill.skillId)) list.push(skill.skillId)
      map.set(keyword, list)
    }
  }
  return [...map.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([keyword, skillIds]) => ({ keyword, skillIds }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword, 'zh-CN'))
}

function pairCoveredByExclusion(
  skillA: string,
  skillB: string,
): IntentExclusionRule | undefined {
  return exclusions.find(
    (r) =>
      (r.preferSkillId === skillA && r.excludeSkillId === skillB) ||
      (r.preferSkillId === skillB && r.excludeSkillId === skillA),
  )
}

/**
 * 轻量冲突检查：关键词重叠 × 排他目录
 * - covered：重叠但已有排他说明
 * - overlap：重叠且目录未声明排他（潜在风险）
 * - info：目录中的示例话术说明
 */
export function buildRouteConflictReport(
  skills: AssistantSkillConfig[],
): RouteConflictItem[] {
  const items: RouteConflictItem[] = []
  const nameOf = (id: string) =>
    skills.find((s) => s.skillId === id)?.name ?? id

  for (const { keyword, skillIds } of findKeywordOverlaps(skills)) {
    const covered = pairCoveredByExclusion(skillIds[0], skillIds[1])
    // 多 Skill 重叠：任一对有排他则标 covered，否则 overlap
    let rule: IntentExclusionRule | undefined
    for (let i = 0; i < skillIds.length; i++) {
      for (let j = i + 1; j < skillIds.length; j++) {
        const hit = pairCoveredByExclusion(skillIds[i], skillIds[j])
        if (hit) {
          rule = hit
          break
        }
      }
      if (rule) break
    }

    const skillLabel = skillIds.map((id) => nameOf(id)).join('、')
    if (rule || covered) {
      const r = rule ?? covered!
      items.push({
        id: `kw_${keyword}`,
        severity: 'covered',
        title: `关键词「${keyword}」多 Skill 命中（已有排他）`,
        detail: `涉及：${skillLabel}。排他规则「${r.name}」：优先 ${nameOf(r.preferSkillId)}，排除 ${nameOf(r.excludeSkillId)}。`,
        keyword,
        skillIds,
        ruleId: r.ruleId,
      })
    } else {
      items.push({
        id: `kw_${keyword}`,
        severity: 'overlap',
        title: `关键词「${keyword}」多 Skill 命中（未声明排他）`,
        detail: `涉及：${skillLabel}。演示版请用代码优先级或补充排他目录说明。`,
        keyword,
        skillIds,
      })
    }
  }

  for (const rule of exclusions) {
    items.push({
      id: `rule_${rule.ruleId}`,
      severity: 'info',
      title: rule.name,
      detail: `当「${rule.when}」→ 优先 ${nameOf(rule.preferSkillId)}，排除 ${nameOf(rule.excludeSkillId)}。${rule.note ?? ''}`,
      ruleId: rule.ruleId,
      skillIds: [rule.preferSkillId, rule.excludeSkillId],
    })
  }

  const order: Record<RouteConflictSeverity, number> = {
    overlap: 0,
    covered: 1,
    info: 2,
  }
  return items.sort((a, b) => order[a.severity] - order[b.severity])
}
