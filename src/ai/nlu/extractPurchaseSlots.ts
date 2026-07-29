import { llmConfig } from '@config/llm.config'
import { isLlmAvailable, requestLlmChatCompletion } from '@/ai/llm/client'
import type { PurchaseStep } from '@/store/purchaseStore'
import type { ParsedParty } from '@/utils/ticketPartyParser'
import { formatPartyLabel } from '@/utils/ticketPartyParser'

export interface LlmPurchaseSlots {
  adult?: number | null
  child?: number | null
  elderly?: number | null
  visitDate?: string | null
}

export interface PurchaseSlotSessionContext {
  step?: PurchaseStep
  party?: ParsedParty
  visitDate?: string
}

function formatToday(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildSessionBlock(session?: PurchaseSlotSessionContext | null): string {
  if (!session) return '当前无进行中的购票会话（新对话）。'

  const lines: string[] = []
  if (session.step) lines.push(`流程阶段：${session.step}`)
  if (session.party && (session.party.adult || session.party.child || session.party.elderly)) {
    lines.push(`已记录人数：${formatPartyLabel(session.party)}`)
  } else {
    lines.push('已记录人数：尚未确定')
  }
  lines.push(session.visitDate ? `已记录出行日：${session.visitDate}` : '已记录出行日：尚未确定')
  return lines.join('\n')
}

function buildSystemPrompt(today: string, session?: PurchaseSlotSessionContext | null): string {
  return `你是景区购票助手的信息提取器。从用户「最新一条消息」中提取要更新的出行人数与计划出行日期。

参考日期（今天）：${today}

${buildSessionBlock(session)}

规则：
1. 只提取用户在本条消息中明确提到或可直接推断的变更；未提及的字段必须填 null（不要用已记录状态填充 null 字段）。
2. 用户说「改成/改到/换成/还是」等时，仅输出需要变更的字段，例如只改日期则人数全为 null。
3. adult / child / elderly 为非负整数；老人单独计数写入 elderly。
4. 「两大一小」「2大1小」→ adult:2, child:1, elderly:0。
5. 「N人」且无儿童/老人说明 → adult:N, child:0, elderly:0。
6. visitDate 输出 YYYY-MM-DD，必须是参考日期之后（不可今天或过去）；无法确定则 null。
7. 相对/模糊日期请换算为具体 ISO 日期：
   - 这周末/下周末/下周/明天/后天 等按字面含义换算；
   - 「N月上旬」→ 该月 10 日；「N月中旬」→ 15 日；「N月下旬」→ 25 日（月份为公历）。

仅输出 JSON，不要其他文字：
{"adult":number|null,"child":number|null,"elderly":number|null,"visitDate":string|null}`
}

function parseNonNegativeInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined
  return n
}

function normalizeLlmPayload(raw: unknown): LlmPurchaseSlots | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const adult = parseNonNegativeInt(obj.adult)
  const child = parseNonNegativeInt(obj.child)
  const elderly = parseNonNegativeInt(obj.elderly)

  let visitDate: string | null | undefined
  if (obj.visitDate === null || obj.visitDate === undefined || obj.visitDate === '') {
    visitDate = null
  } else if (typeof obj.visitDate === 'string') {
    visitDate = obj.visitDate.trim()
  }

  if (adult === undefined && child === undefined && elderly === undefined && !visitDate) {
    return null
  }

  return {
    adult: adult ?? null,
    child: child ?? null,
    elderly: elderly ?? null,
    visitDate: visitDate ?? null,
  }
}

function parseJsonContent(content: string): LlmPurchaseSlots | null {
  const trimmed = content.trim()
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null

  try {
    return normalizeLlmPayload(JSON.parse(jsonText))
  } catch {
    return null
  }
}

function isPurchaseNluEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_PURCHASE_NLU
  if (flag === 'false' || flag === '0') return false
  return Boolean(llmConfig.nlu.purchaseSlots)
}

/** 使用 LLM 从用户消息提取购票槽位；无 Key / 失败时返回 null */
export async function extractPurchaseSlotsWithLlm(
  message: string,
  now = new Date(),
  session?: PurchaseSlotSessionContext | null,
): Promise<LlmPurchaseSlots | null> {
  if (!isPurchaseNluEnabled() || !isLlmAvailable()) return null

  const text = message.trim()
  if (!text) return null

  try {
    const response = await requestLlmChatCompletion(
      [
        { role: 'system', content: buildSystemPrompt(formatToday(now), session) },
        { role: 'user', content: text },
      ],
      {
        temperature: llmConfig.nlu.purchaseSlotsTemperature,
        maxTokens: 256,
        responseFormat: 'json_object',
      },
    )

    return parseJsonContent(response.content ?? '')
  } catch {
    return null
  }
}

export { isPurchaseNluEnabled }
