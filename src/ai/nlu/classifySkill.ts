import { llmConfig } from '@config/llm.config'
import { isLlmAvailable, requestLlmChatCompletion } from '@/ai/llm/client'
import { isRoutableSkill, STAGE2_SKILL_IDS, type Stage2SkillId } from '@/ai/skills/utils'
import type { AssistantSkillConfig } from '@/types'

export type SkillRouteSkillId = Stage2SkillId | 'general'

export interface SkillClassification {
  skillId: SkillRouteSkillId
  confidence: number
}

const MIN_CONFIDENCE = 0.5

function buildSystemPrompt(skills: AssistantSkillConfig[]): string {
  const routable = skills.filter(isRoutableSkill)
  const catalog = routable
    .map(
      (s) =>
        `- ${s.skillId}（${s.name}）：${s.description}；示例关键词：${(s.triggerKeywords ?? []).slice(0, 6).join('、') || '无'}`,
    )
    .join('\n')

  return `你是景区 AI 助手的场景分类器。根据用户最新一句话，判断其最匹配的对话 Skill。

可选 skillId（必须从中选一个）：
${catalog}
- general：闲聊、与上述场景无关、领券（领券有独立流程）、无法判断

规则：
1. 只根据用户当前这句话分类，不要臆造需求。
2. 查订单、票在哪、订票记录 → order_query
3. 买票、票种、人数、下单、套票 → ticket_purchase
4. 交通、怎么去、攻略、入园准备、游玩路线、停车位置 → travel_guide
5. 停车费、交车费、停车缴费、绑定车牌 → parking_pay（不是问停车场在哪）
6. 今日演出、演出推荐、下一场几点、灯光秀、花车巡游 → scenic_recommend
7. 点名游乐项目（过山车、漂流、取号、快速排队）→ queue_recommend
8. 开发票、开票、报销、发票 → invoice_service
9. 点评、评价、服务怎么样、写评价、满意度 → review_service
10. 打卡、签到、景点打卡、园区打卡 → checkin_service
11. 虚拟排队、免费取号、快速排队、排队少的项目 → queue_recommend
12. 有什么券、优惠活动、推荐优惠 → proactive_marketing（不含新客领券；不含会员等级选品）
13. 会员专属套餐、按会员等级推荐、适合我的门票组合、会员怎么买最划算 → member_offer
14. 不确定或仅寒暄 → general
15. confidence 为 0~1，表示把握程度。

仅输出 JSON：
{"skillId":"ticket_purchase|travel_guide|order_query|parking_pay|scenic_recommend|queue_recommend|invoice_service|review_service|checkin_service|proactive_marketing|member_offer|general","confidence":number}`
}

function parseClassification(content: string): SkillClassification | null {
  const trimmed = content.trim()
  const jsonText = trimmed.startsWith('{') ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null

  try {
    const raw = JSON.parse(jsonText) as Record<string, unknown>
    const skillId = raw.skillId
    if (
      skillId !== 'general' &&
      !STAGE2_SKILL_IDS.includes(skillId as Stage2SkillId)
    ) {
      return null
    }

    const confidenceRaw = raw.confidence
    const confidence =
      typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
        ? Math.min(Math.max(confidenceRaw, 0), 1)
        : 0

    return {
      skillId: skillId as SkillRouteSkillId,
      confidence,
    }
  } catch {
    return null
  }
}

function isSkillRoutingEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_SKILL_NLU
  if (flag === 'false' || flag === '0') return false
  return llmConfig.nlu.skillRouting !== false
}

/** LLM 语义分类 Skill；失败或未启用时返回 null */
export async function classifySkillWithLlm(
  message: string,
  skills: AssistantSkillConfig[],
): Promise<SkillClassification | null> {
  if (!isSkillRoutingEnabled() || !isLlmAvailable()) return null

  const text = message.trim()
  if (!text) return null

  const routable = skills.filter(isRoutableSkill)
  if (!routable.length) return null

  try {
    const response = await requestLlmChatCompletion(
      [
        { role: 'system', content: buildSystemPrompt(skills) },
        { role: 'user', content: text },
      ],
      {
        temperature: llmConfig.nlu.skillRoutingTemperature,
        maxTokens: 64,
        responseFormat: 'json_object',
        timeoutMs: llmConfig.nlu.skillRoutingTimeoutMs ?? 15_000,
      },
    )

    const parsed = parseClassification(response.content ?? '')
    if (!parsed || parsed.skillId === 'general' || parsed.confidence < MIN_CONFIDENCE) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export { isSkillRoutingEnabled, MIN_CONFIDENCE as SKILL_ROUTE_MIN_CONFIDENCE }
