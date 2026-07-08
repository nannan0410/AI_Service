import type { AssistantUiConfig, AssistantSkillConfig } from '@/types'
import { getToolLabel } from '@/ai/tools'

export function buildSystemPrompt(
  config: AssistantUiConfig,
  skill?: AssistantSkillConfig | null,
): string {
  const base = `你是「${config.assistantNickname}」，欢乐景区的 AI 智能助手。

你的职责：
1. 理解游客意图，友好、简洁地用中文回复
2. 必要时引导用户使用 App 内功能（订单页、发票页、停车页等）
3. 业务数据必须通过 Tool 获取，不要编造订单号、价格等具体业务数据
4. 回复保持移动端友好，段落简短`

  if (!skill) {
    return `${base}

当前为通用对话模式。当用户询问订单、优惠券、会员、票产品、交通攻略、园区项目时，请调用合适 Tool 后再回复。`
  }

  const toolHints = skill.tools.length
    ? skill.tools.map((t) => `- ${t}（${getToolLabel(t)}）`).join('\n')
    : '（无专属 Tool，请基于已有信息回复）'

  return `${base}

## 当前场景 Skill：${skill.name}（${skill.skillId}）
${skill.description}

## 场景专属指令
${skill.promptAddon}

## 可用 Tool 白名单
${toolHints}

请仅在以上 Tool 范围内调用接口；若信息不足，礼貌说明并引导用户补充。`
}
