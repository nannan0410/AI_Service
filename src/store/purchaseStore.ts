import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ParsedParty } from '@/utils/ticketPartyParser'
import { emptyParty } from '@/utils/ticketPartyParser'

export type PurchaseStep = 'ask_party' | 'ask_date' | 'recommend' | 'fallback'

export interface PurchaseSession {
  sessionId: string
  step: PurchaseStep
  party: ParsedParty
  visitDate?: string
  productId?: string
  couponId?: string
  marketingIssued: boolean
  fallbackCouponIssued: boolean
  /** 当前有效推荐版本，用于禁用历史推荐卡上的确认按钮 */
  quoteToken?: string
}

export const usePurchaseStore = defineStore('purchase', () => {
  const session = ref<PurchaseSession | null>(null)
  const confirmedSessions = ref<Set<string>>(new Set())

  function startSession(): PurchaseSession {
    const next: PurchaseSession = {
      sessionId: `purchase_${Date.now()}`,
      step: 'ask_party',
      party: emptyParty(),
      marketingIssued: false,
      fallbackCouponIssued: false,
    }
    session.value = next
    return next
  }

  function patchSession(patch: Partial<PurchaseSession>) {
    if (!session.value) return
    session.value = { ...session.value, ...patch }
  }

  function patchParty(party: Partial<ParsedParty>) {
    if (!session.value) return
    session.value = {
      ...session.value,
      party: { ...session.value.party, ...party },
    }
  }

  function clearSession() {
    session.value = null
  }

  function markConfirmed(sessionId: string) {
    confirmedSessions.value.add(sessionId)
  }

  function isConfirmed(sessionId: string): boolean {
    return confirmedSessions.value.has(sessionId)
  }

  return {
    session,
    confirmedSessions,
    startSession,
    patchSession,
    patchParty,
    clearSession,
    markConfirmed,
    isConfirmed,
  }
})
