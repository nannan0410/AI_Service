import {
  extractPurchaseSlotsWithLlm,
  isPurchaseNluEnabled,
  type LlmPurchaseSlots,
  type PurchaseSlotSessionContext,
} from './extractPurchaseSlots'
import { isLlmAvailable } from '@/ai/llm/client'
import type { ParsedParty } from '@/utils/ticketPartyParser'
import {
  normalizePartyRestatement,
  parsePartyFromMessage,
} from '@/utils/ticketPartyParser'
import { parseVisitDateFromMessage, validateIsoVisitDate } from '@/utils/visitDateParser'
import type { ToolExecutionCallbacks } from '@/types'

export interface ResolvedPurchaseSlots {
  partyPatch: Partial<ParsedParty>
  visitDate: string | null
  /** llm 在线主路径；regex 为离线或 LLM 不可用时的兜底 */
  source: 'llm' | 'regex'
}

export function llmToPartyPatch(slots: LlmPurchaseSlots): Partial<ParsedParty> {
  const patch: Partial<ParsedParty> = {}
  if (slots.adult != null && slots.adult >= 0) patch.adult = slots.adult
  if (slots.child != null && slots.child >= 0) patch.child = slots.child
  if (slots.elderly != null && slots.elderly >= 0) patch.elderly = slots.elderly
  return patch
}

export function hasPartyPatch(patch: Partial<ParsedParty>): boolean {
  return patch.adult != null || patch.child != null || patch.elderly != null
}

/** 正则优先；LLM 仅填补正则未识别的字段（离线合并用） */
export function mergePartyPatch(
  regexPatch: Partial<ParsedParty>,
  llmPatch: Partial<ParsedParty>,
): Partial<ParsedParty> {
  const merged: Partial<ParsedParty> = { ...regexPatch }

  if (merged.adult == null && llmPatch.adult != null && llmPatch.adult >= 0) {
    merged.adult = llmPatch.adult
  }
  if (merged.child == null && llmPatch.child != null && llmPatch.child >= 0) {
    merged.child = llmPatch.child
  }
  if (merged.elderly == null && llmPatch.elderly != null && llmPatch.elderly >= 0) {
    merged.elderly = llmPatch.elderly
  }

  return merged
}

function resolveFromRegex(message: string, now: Date): ResolvedPurchaseSlots {
  return {
    partyPatch: normalizePartyRestatement(parsePartyFromMessage(message), message),
    visitDate: parseVisitDateFromMessage(message, now),
    source: 'regex',
  }
}

function resolveFromLlm(
  slots: LlmPurchaseSlots,
  now: Date,
  message: string,
): ResolvedPurchaseSlots {
  return {
    partyPatch: normalizePartyRestatement(llmToPartyPatch(slots), message),
    visitDate: validateIsoVisitDate(slots.visitDate, now),
    source: 'llm',
  }
}

/**
 * 购票槽位：在线 LLM 为主（带 session 上下文）；离线或 LLM 失败时正则兜底。
 */
export async function resolvePurchaseSlotsFromMessage(
  message: string,
  options?: {
    now?: Date
    callbacks?: ToolExecutionCallbacks
    skipLlm?: boolean
    session?: PurchaseSlotSessionContext | null
  },
): Promise<ResolvedPurchaseSlots> {
  const now = options?.now ?? new Date()
  const useLlm = !options?.skipLlm && isPurchaseNluEnabled() && isLlmAvailable()

  if (useLlm) {
    options?.callbacks?.onToolStart?.('extractPurchaseSlots', '理解出行人数与日期')
    const llmSlots = await extractPurchaseSlotsWithLlm(message, now, options?.session)
    options?.callbacks?.onToolDone?.('extractPurchaseSlots', llmSlots != null)

    if (llmSlots != null) {
      return resolveFromLlm(llmSlots, now, message)
    }
  }

  return resolveFromRegex(message, now)
}

export { mergePartyPatch as mergePurchasePartyPatch }
export type { PurchaseSlotSessionContext }
