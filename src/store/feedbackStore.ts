import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getUserStorage,
  setUserStorage,
  STORAGE_SUFFIX,
} from '@/utils/storage'
import {
  buildAssistantSnippet,
  buildFavoriteRecord,
} from '@/utils/messageFeedback'
import type {
  ChatMessage,
  FeedbackAction,
  FeedbackEvent,
  FavoriteRecord,
} from '@/types'

const MAX_EVENTS = 200

export const useFeedbackStore = defineStore('feedback', () => {
  const memberId = ref('')
  const favorites = ref<FavoriteRecord[]>([])
  const events = ref<FeedbackEvent[]>([])

  const favoriteMessageIds = computed(
    () => new Set(favorites.value.map((item) => item.messageId)),
  )

  function bindMember(nextMemberId: string) {
    memberId.value = nextMemberId
  }

  function loadPersisted() {
    if (!memberId.value) {
      favorites.value = []
      events.value = []
      return
    }
    favorites.value = getUserStorage<FavoriteRecord[]>(
      memberId.value,
      STORAGE_SUFFIX.FAVORITES,
      [],
    )
    events.value = getUserStorage<FeedbackEvent[]>(
      memberId.value,
      STORAGE_SUFFIX.FEEDBACK_EVENTS,
      [],
    )
  }

  function persistFavorites() {
    if (!memberId.value) return
    setUserStorage(memberId.value, STORAGE_SUFFIX.FAVORITES, favorites.value)
  }

  function persistEvents() {
    if (!memberId.value) return
    setUserStorage(memberId.value, STORAGE_SUFFIX.FEEDBACK_EVENTS, events.value)
  }

  function isFavorited(messageId: string): boolean {
    return favoriteMessageIds.value.has(messageId)
  }

  function appendEvent(
    action: FeedbackAction,
    message: ChatMessage,
    context?: {
      scenicId?: string | null
      personaId?: string
    },
  ) {
    const event: FeedbackEvent = {
      eventId: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      createdAt: new Date().toISOString(),
      messageId: message.id,
      messageType: message.type,
      userText: message.feedbackMeta?.userText,
      assistantSnippet: buildAssistantSnippet(message),
      skillId: message.feedbackMeta?.skillId,
      routeSource: message.feedbackMeta?.routeSource,
      scenicId: context?.scenicId,
      personaId: context?.personaId,
    }
    events.value = [event, ...events.value].slice(0, MAX_EVENTS)
    persistEvents()
    return event
  }

  /** 赞/踩互斥；再次点击同一态则取消 */
  function setReaction(
    message: ChatMessage,
    next: 'like' | 'dislike' | null,
    context?: { scenicId?: string | null; personaId?: string },
  ): ChatMessage {
    const prev = message.reaction
    const reaction = prev === next ? undefined : (next ?? undefined)
    const patched: ChatMessage = { ...message, reaction }
    if (reaction === 'like') appendEvent('like', patched, context)
    if (reaction === 'dislike') appendEvent('dislike', patched, context)
    return patched
  }

  function addFavorite(
    message: ChatMessage,
    context?: {
      scenicId?: string | null
      scenicName?: string
      personaId?: string
    },
  ): FavoriteRecord | null {
    if (isFavorited(message.id)) {
      return favorites.value.find((item) => item.messageId === message.id) ?? null
    }
    const record = buildFavoriteRecord({
      message,
      scenicId: context?.scenicId,
      scenicName: context?.scenicName,
    })
    favorites.value = [record, ...favorites.value]
    persistFavorites()
    appendEvent('favorite', message, context)
    return record
  }

  function removeFavoriteByMessageId(
    messageId: string,
    message?: ChatMessage,
    context?: { scenicId?: string | null; personaId?: string },
  ): boolean {
    const before = favorites.value.length
    favorites.value = favorites.value.filter((item) => item.messageId !== messageId)
    if (favorites.value.length === before) return false
    persistFavorites()
    if (message) appendEvent('unfavorite', message, context)
    return true
  }

  function removeFavoriteById(favoriteId: string): boolean {
    const target = favorites.value.find((item) => item.favoriteId === favoriteId)
    if (!target) return false
    favorites.value = favorites.value.filter((item) => item.favoriteId !== favoriteId)
    persistFavorites()
    return true
  }

  /** 仅踩事件（运营反推关键词用） */
  const dislikeEvents = computed(() =>
    events.value.filter((item) => item.action === 'dislike'),
  )

  return {
    memberId,
    favorites,
    events,
    dislikeEvents,
    favoriteMessageIds,
    bindMember,
    loadPersisted,
    isFavorited,
    setReaction,
    addFavorite,
    removeFavoriteByMessageId,
    removeFavoriteById,
    appendEvent,
  }
})
