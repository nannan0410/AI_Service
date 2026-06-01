<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAssistantStore } from '@/store/assistantStore'
import type { AssistantMotionId } from '@/types'

const props = withDefaults(
  defineProps<{
    motion?: AssistantMotionId
    size?: number
    showName?: boolean
  }>(),
  {
    motion: 'idle',
    size: 48,
    showName: false,
  },
)

const assistantStore = useAssistantStore()

onMounted(() => {
  assistantStore.loadConfig()
})

const displayMotion = computed(() => props.motion || assistantStore.motion)

const avatarSrc = computed(() => {
  const cfg = assistantStore.uiConfig
  if (!cfg) return '/assistant/avatar-idle.svg'
  const found = cfg.motions.find((m) => m.actionId === displayMotion.value)
  return found?.assetUrl || cfg.assistantAvatarUrl || cfg.defaultImageUrl
})

const assistantName = computed(
  () => assistantStore.uiConfig?.assistantNickname ?? assistantStore.uiConfig?.assistantName ?? '小景',
)

const borderColor = computed(() => assistantStore.primaryColor)
</script>

<template>
  <div class="assistant-avatar">
    <img
      :src="avatarSrc"
      :alt="assistantName"
      class="assistant-avatar__img"
      :style="{
        width: `${size}px`,
        height: `${size}px`,
        borderColor: borderColor,
      }"
    />
    <span v-if="showName" class="assistant-avatar__name">{{ assistantName }}</span>
  </div>
</template>

<style scoped>
.assistant-avatar {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.assistant-avatar__img {
  border-radius: 50%;
  object-fit: cover;
  background: var(--chat-primary-light, #e8f8ef);
  border: 2px solid var(--chat-primary, #07c160);
}

.assistant-avatar__name {
  font-size: 12px;
  color: #666;
}
</style>
