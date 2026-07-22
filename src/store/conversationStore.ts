import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getUserStorage, setUserStorage, removeUserStorage, STORAGE_SUFFIX } from '@/utils/storage'
import type { Conversation, PersonaId } from '@/types'

function createConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useConversationStore = defineStore('conversation', () => {
  const conversation = ref<Conversation | null>(null)
  const memberId = ref('')

  const conversationId = computed(() => conversation.value?.conversationId ?? null)
  const scenicId = computed(() => conversation.value?.scenicId ?? null)
  const hasConversation = computed(() => Boolean(conversation.value?.conversationId))

  function bindMember(nextMemberId: string) {
    memberId.value = nextMemberId
  }

  function persist() {
    if (!memberId.value) return
    if (!conversation.value) {
      removeUserStorage(memberId.value, STORAGE_SUFFIX.CONVERSATION)
      return
    }
    setUserStorage(memberId.value, STORAGE_SUFFIX.CONVERSATION, conversation.value)
  }

  function loadPersisted(): Conversation | null {
    if (!memberId.value) {
      conversation.value = null
      return null
    }
    const saved = getUserStorage<Conversation | null>(
      memberId.value,
      STORAGE_SUFFIX.CONVERSATION,
      null,
    )
    if (
      saved &&
      typeof saved.conversationId === 'string' &&
      typeof saved.scenicId === 'string' &&
      saved.memberId === memberId.value
    ) {
      conversation.value = saved
      return saved
    }
    conversation.value = null
    return null
  }

  /** 强制新会话（切换景区 / 明确重开） */
  function startNew(scenicIdValue: string, personaId?: PersonaId | null): Conversation {
    if (!memberId.value) {
      throw new Error('未绑定会员，无法创建会话')
    }
    const now = new Date().toISOString()
    const next: Conversation = {
      conversationId: createConversationId(),
      scenicId: scenicIdValue,
      memberId: memberId.value,
      personaId: personaId ?? undefined,
      createdAt: now,
      updatedAt: now,
    }
    conversation.value = next
    persist()
    return next
  }

  /**
   * 确保有绑定该景区的会话：
   * - 已有且 scenicId 一致 → 复用并刷新 updatedAt
   * - 否则 → startNew
   */
  function ensureConversation(
    scenicIdValue: string,
    options?: { personaId?: PersonaId | null; forceNew?: boolean },
  ): Conversation {
    if (!options?.forceNew && conversation.value?.scenicId === scenicIdValue) {
      conversation.value = {
        ...conversation.value,
        personaId: options?.personaId ?? conversation.value.personaId,
        updatedAt: new Date().toISOString(),
      }
      persist()
      return conversation.value
    }
    return startNew(scenicIdValue, options?.personaId)
  }

  function touch() {
    if (!conversation.value) return
    conversation.value = {
      ...conversation.value,
      updatedAt: new Date().toISOString(),
    }
    persist()
  }

  function clear() {
    conversation.value = null
    persist()
  }

  return {
    conversation,
    conversationId,
    scenicId,
    hasConversation,
    memberId,
    bindMember,
    loadPersisted,
    startNew,
    ensureConversation,
    touch,
    clear,
    persist,
  }
})
