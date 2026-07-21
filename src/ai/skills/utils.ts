import type { AssistantSkillConfig } from '@/types'

/** 阶段二已接入 Workflow / 可路由的 Skill */
export const STAGE2_SKILL_IDS = [
  'ticket_purchase',
  'travel_guide',
  'order_query',
  'parking_pay',
  'scenic_recommend',
  'queue_recommend',
  'invoice_service',
  'review_service',
  'checkin_service',
  'proactive_marketing',
] as const

export type Stage2SkillId = (typeof STAGE2_SKILL_IDS)[number]

/** 历史配置中的 Tool 名 → 当前注册表 */
const TOOL_ALIASES: Record<string, string> = {
  getTicketCatalog: 'getProductCatalog',
  getContentBlock: 'getContentBlocks',
  generateTravelGuide: 'generateTravelGuide',
  createOrder: 'createOrderDraft',
  createOrderDraft: 'createOrderDraft',
  getCommonVisitors: 'getCommonVisitors',
  issueCoupon: 'issueCoupon',
  bindPlateNo: 'getMemberInfo',
  payParking: 'getMemberInfo',
  updateVisitorPreferences: 'getScenicActivities',
}

export function normalizeSkillToolName(name: string): string {
  return TOOL_ALIASES[name] ?? name
}

export function resolveSkillTools(
  skill: AssistantSkillConfig,
  availableTools: Set<string>,
): string[] {
  const resolved = skill.tools
    .map(normalizeSkillToolName)
    .filter((name) => availableTools.has(name))
  return [...new Set(resolved)]
}

export function collectStage2ToolNames(
  skills: AssistantSkillConfig[],
  registryToolNames: Set<string>,
): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const skill of skills) {
    if (!skill.enabled || !STAGE2_SKILL_IDS.includes(skill.skillId as Stage2SkillId)) continue
    for (const tool of resolveSkillTools(skill, registryToolNames)) {
      if (!seen.has(tool)) {
        seen.add(tool)
        names.push(tool)
      }
    }
  }
  return names
}

export function isRoutableSkill(skill: AssistantSkillConfig): boolean {
  return skill.enabled && STAGE2_SKILL_IDS.includes(skill.skillId as Stage2SkillId)
}
