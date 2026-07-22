import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getUserStorage,
  setUserStorage,
  STORAGE_SUFFIX,
  chatStorageSuffix,
} from '@/utils/storage'
import type { ChatMessage, ChatMessageDraft } from '@/types'

function createWelcomeMessage(assistantNickname: string): ChatMessage {
  return {
    id: `msg_${Date.now()}`,
    type: 'system',
    role: 'system',
    content: `欢迎和${assistantNickname}对话`,
    createdAt: new Date().toISOString(),
  }
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const sending = ref(false)
  const currentUserId = ref('')
  const currentScenicId = ref<string | null>(null)

  function bucketSuffix(scenicId?: string | null): string {
    if (scenicId) return chatStorageSuffix(scenicId)
    return STORAGE_SUFFIX.CHAT
  }

  function loadForUser(
    userId: string,
    assistantNickname: string,
    scenicId?: string | null,
  ) {
    currentUserId.value = userId
    currentScenicId.value = scenicId ?? null
    const suffix = bucketSuffix(scenicId)
    const saved = getUserStorage<ChatMessage[]>(userId, suffix, [])
    messages.value = saved.length > 0 ? saved : [createWelcomeMessage(assistantNickname)]
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

  function addAssistantMessage(content: string) {
    addMessage({
      id: `msg_${Date.now()}`,
      type: 'text',
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    })
  }

  function addAssistantCards(cards: ChatMessageDraft[]) {
    cards.forEach((card, index) => {
      addMessage({
        ...card,
        id: `msg_${Date.now()}_${index}`,
        role: 'assistant',
        createdAt: new Date().toISOString(),
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

  function addAssistantReply(content: string, cards?: ChatMessageDraft[]) {
    addAssistantMessage(content)
    if (cards?.length) addAssistantCards(cards)
  }

  function patchMessage(
    messageId: string,
    patch: Partial<Pick<ChatMessage, 'content' | 'payload' | 'type'>>,
  ) {
    const index = messages.value.findIndex((item) => item.id === messageId)
    if (index < 0) return
    messages.value[index] = { ...messages.value[index], ...patch }
    persist()
  }

  function clearMessages(assistantNickname: string) {
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
    patchMessage,
    clearMessages,
    persist,
  }
})
