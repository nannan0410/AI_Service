import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getUserStorage,
  setUserStorage,
  STORAGE_SUFFIX,
  chatStorageSuffix,
} from '@/utils/storage'
import type { ChatMessage, ChatMessageDraft, MessageFeedbackMeta } from '@/types'
import {
  ASSISTANT_CARD_CASCADE_GAP_MS,
  countCardRevealSlots,
} from '@/utils/cardReveal'

export { ASSISTANT_CARD_CASCADE_GAP_MS }

function createWelcomeMessage(assistantNickname: string): ChatMessage {
  return {
    id: `msg_${Date.now()}`,
    type: 'system',
    role: 'system',
    content: `欢迎和${assistantNickname}对话`,
    createdAt: new Date().toISOString(),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const sending = ref(false)
  const currentUserId = ref('')
  const currentScenicId = ref<string | null>(null)
  /** 递增以取消进行中的级联展示 */
  let presentSeq = 0

  function bucketSuffix(scenicId?: string | null): string {
    if (scenicId) return chatStorageSuffix(scenicId)
    return STORAGE_SUFFIX.CHAT
  }

  function cancelPresent() {
    presentSeq += 1
    let changed = false
    messages.value = messages.value.map((item) => {
      if (item.revealCount == null) return item
      changed = true
      const { revealCount: _r, ...rest } = item
      return rest
    })
    if (changed) persist()
  }

  function loadForUser(
    userId: string,
    assistantNickname: string,
    scenicId?: string | null,
  ) {
    cancelPresent()
    currentUserId.value = userId
    currentScenicId.value = scenicId ?? null
    const suffix = bucketSuffix(scenicId)
    const saved = getUserStorage<ChatMessage[]>(userId, suffix, [])
    // 历史消息不回放级联：清掉进行中的 revealCount，全部展示
    messages.value =
      saved.length > 0
        ? saved.map((item) => {
            const { revealCount: _r, ...rest } = item
            return rest
          })
        : [createWelcomeMessage(assistantNickname)]
  }

  function persist() {
    if (!currentUserId.value) return
    setUserStorage(
      currentUserId.value,
      bucketSuffix(currentScenicId.value),
      messages.value,
    )
  }

  function addMessage(message: ChatMessage) {
    messages.value.push(message)
    persist()
  }

  function addUserMessage(content: string) {
    addMessage({
      id: `msg_${Date.now()}`,
      type: 'text',
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    })
  }

  function addAssistantMessage(
    content: string,
    meta?: { feedbackMeta?: MessageFeedbackMeta },
  ) {
    addMessage({
      id: `msg_${Date.now()}`,
      type: 'text',
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      feedbackMeta: meta?.feedbackMeta,
    })
  }

  function addAssistantCards(
    cards: ChatMessageDraft[],
    meta?: { feedbackMeta?: MessageFeedbackMeta },
  ) {
    cards.forEach((card, index) => {
      addMessage({
        ...card,
        id: `msg_${Date.now()}_${index}`,
        role: 'assistant',
        createdAt: new Date().toISOString(),
        feedbackMeta: meta?.feedbackMeta,
      })
    })
  }

  function addSystemMessage(content: string) {
    addMessage({
      id: `msg_${Date.now()}`,
      type: 'system',
      role: 'system',
      content,
      createdAt: new Date().toISOString(),
    })
  }

  function addAssistantReply(
    content: string,
    cards?: ChatMessageDraft[],
    meta?: { feedbackMeta?: MessageFeedbackMeta },
  ) {
    addAssistantMessage(content, meta)
    if (cards?.length) addAssistantCards(cards, meta)
  }

  function patchMessage(
    messageId: string,
    patch: Partial<
      Pick<
        ChatMessage,
        | 'content'
        | 'payload'
        | 'type'
        | 'revealCount'
        | 'reaction'
        | 'favorited'
        | 'feedbackMeta'
      >
    >,
  ) {
    const index = messages.value.findIndex((item) => item.id === messageId)
    if (index < 0) return
    const next: ChatMessage = { ...messages.value[index], ...patch }
    if ('revealCount' in patch && patch.revealCount === undefined) {
      delete next.revealCount
    }
    if ('reaction' in patch && patch.reaction === undefined) {
      delete next.reaction
    }
    messages.value[index] = next
    persist()
  }

  /**
   * 助手回复：顶层文案先出；多条子卡在同一消息框内按 revealCount 逐条显现。
   * 多条顶层消息之间也保持间隔。
   */
  async function presentAssistantReply(
    content: string | undefined | null,
    cards?: ChatMessageDraft[] | null,
    options?: {
      gapMs?: number
      onItem?: () => void
      feedbackMeta?: MessageFeedbackMeta
    },
  ): Promise<void> {
    const seq = ++presentSeq
    const gapMs = options?.gapMs ?? ASSISTANT_CARD_CASCADE_GAP_MS
    const topText = content?.trim() ?? ''
    const list = cards?.length ? [...cards] : []
    const feedbackMeta = options?.feedbackMeta

    const stillActive = () => seq === presentSeq
    const notify = () => {
      if (stillActive()) options?.onItem?.()
    }

    let emitted = false

    if (topText) {
      addAssistantMessage(topText, { feedbackMeta })
      notify()
      emitted = true
    }

    for (let cardIndex = 0; cardIndex < list.length; cardIndex++) {
      if (!stillActive()) return
      const card = list[cardIndex]
      const slots = countCardRevealSlots(card)
      const messageId = `msg_${Date.now()}_${cardIndex}`

      if (emitted) {
        await sleep(gapMs)
        if (!stillActive()) return
      }

      if (slots <= 1) {
        addMessage({
          ...card,
          id: messageId,
          role: 'assistant',
          createdAt: new Date().toISOString(),
          feedbackMeta,
        })
        notify()
        emitted = true
        continue
      }

      // 同框级联：先出文案框（revealCount=0），再递增子卡
      addMessage({
        ...card,
        id: messageId,
        role: 'assistant',
        createdAt: new Date().toISOString(),
        revealCount: 0,
        feedbackMeta,
      })
      notify()
      emitted = true

      for (let revealed = 1; revealed <= slots; revealed++) {
        if (!stillActive()) return
        await sleep(gapMs)
        if (!stillActive()) return
        patchMessage(messageId, { revealCount: revealed })
        notify()
      }

      // 播完后去掉 revealCount，持久化为完整态
      if (stillActive()) {
        patchMessage(messageId, { revealCount: undefined })
      }
    }
  }

  function clearMessages(assistantNickname: string) {
    cancelPresent()
    messages.value = [createWelcomeMessage(assistantNickname)]
    persist()
  }

  return {
    messages,
    sending,
    currentScenicId,
    loadForUser,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    addAssistantCards,
    addAssistantReply,
    presentAssistantReply,
    cancelPresent,
    patchMessage,
    clearMessages,
    persist,
  }
})
