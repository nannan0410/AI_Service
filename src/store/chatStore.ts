import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserStorage, setUserStorage, STORAGE_SUFFIX } from '@/utils/storage'
import type { ChatMessage } from '@/types'

function createWelcomeMessage(): ChatMessage {
  return {
    id: `msg_${Date.now()}`,
    type: 'system',
    role: 'system',
    content: '您好！我是小景，您的景区 AI 助手。可以问我购票、停车、推荐游玩项目等问题。',
    createdAt: new Date().toISOString(),
  }
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const sending = ref(false)
  const currentUserId = ref('')

  function loadForUser(userId: string) {
    currentUserId.value = userId
    const saved = getUserStorage<ChatMessage[]>(userId, STORAGE_SUFFIX.CHAT, [])
    messages.value = saved.length > 0 ? saved : [createWelcomeMessage()]
  }

  function persist() {
    if (!currentUserId.value) return
    setUserStorage(currentUserId.value, STORAGE_SUFFIX.CHAT, messages.value)
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

  function clearMessages() {
    messages.value = [createWelcomeMessage()]
    persist()
  }

  return {
    messages,
    sending,
    loadForUser,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    clearMessages,
    persist,
  }
})
