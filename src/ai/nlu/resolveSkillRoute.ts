import { routeSkillByKeywords, getSkillById } from '@/ai/skills/router'
import { classifySkillWithLlm } from './classifySkill'
import { isLikelyGeneralMessage } from './isLikelyGeneralMessage'
import {
  resolveSkillByWorkflowIntent,
  shouldSkipLlmSkillRouting,
} from './resolveSkillByWorkflowIntent'
import type { AssistantSkillConfig } from '@/types'
import type { ToolExecutionCallbacks } from '@/types'

export type SkillRouteSource = 'keyword' | 'llm' | 'general'

export interface SkillRouteResult {
  skill: AssistantSkillConfig | null
  source: SkillRouteSource
  /** LLM 路由时的置信度（关键词路由无此字段） */
  confidence?: number
}

/**
 * Skill 路由：关键词优先 → LLM 语义补全
 * P0-2 增强：高置信度 LLM 结果可进 Workflow（见 skillWorkflowGate.ts）
 */
export async function resolveSkillRoute(
  message: string,
  skills: AssistantSkillConfig[],
  callbacks?: ToolExecutionCallbacks,
): Promise<SkillRouteResult> {
  const keywordSkill = routeSkillByKeywords(message, skills)
  if (keywordSkill) {
    return { skill: keywordSkill, source: 'keyword' }
  }

  const workflowSkill = resolveSkillByWorkflowIntent(message, skills)
  if (workflowSkill || shouldSkipLlmSkillRouting(message)) {
    return { skill: workflowSkill, source: 'keyword' }
  }

  if (isLikelyGeneralMessage(message)) {
    return { skill: null, source: 'general' }
  }

  callbacks?.onToolStart?.('classifySkill', '语义识别对话场景')
  const classification = await classifySkillWithLlm(message, skills)
  callbacks?.onToolDone?.('classifySkill', classification != null)

  if (classification) {
    const skill = getSkillById(skills, classification.skillId)
    if (skill && skill.enabled) {
      return {
        skill,
        source: 'llm',
        confidence: classification.confidence,
      }
    }
  }

  return { skill: null, source: 'general' }
}
