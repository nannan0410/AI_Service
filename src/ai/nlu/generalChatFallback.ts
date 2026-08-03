import type { LlmChatResult } from '@/types'

/** 寒暄 / 无业务意图：本地秒回，不调主模型 */
export const GENERAL_CHAT_LOCAL_COPY =
  '你好呀，我是游游～可以问我购票、攻略、附近好玩、停车缴费、开票点评这些景区问题，也可以点欢迎页的快捷服务和游游推荐试试。'

/** 主对话 LLM 超时 / 失败兜底 */
export const GENERAL_CHAT_TIMEOUT_COPY =
  '游游这边响应有点慢，请稍后再试。也可以直接问购票、攻略、附近好玩或停车缴费，或点欢迎页的推荐入口哦～'

export function buildLocalGeneralChatResult(
  skillId?: string | null,
): LlmChatResult {
  return {
    content: GENERAL_CHAT_LOCAL_COPY,
    skillId: skillId ?? null,
    toolCallsUsed: [],
  }
}

export function buildTimeoutGeneralChatResult(
  skillId?: string | null,
): LlmChatResult {
  return {
    content: GENERAL_CHAT_TIMEOUT_COPY,
    skillId: skillId ?? null,
    toolCallsUsed: [],
  }
}

export function isLlmTimeoutError(error: unknown): boolean {
  return error instanceof Error && /超时|AbortError|aborted/i.test(error.message)
}
