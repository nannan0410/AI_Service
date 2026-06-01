<script setup lang="ts">
import type { ChatMessage } from '@/types'
import AssistantAvatar from '@/components/assistant/AssistantAvatar.vue'

defineProps<{ message: ChatMessage }>()
</script>

<template>
  <div
    class="bubble-row"
    :class="{
      'bubble-row--user': message.role === 'user',
      'bubble-row--system': message.role === 'system',
    }"
  >
    <AssistantAvatar v-if="message.role === 'assistant'" :size="36" />
    <div
      class="bubble"
      :class="{
        'bubble--user': message.role === 'user',
        'bubble--assistant': message.role === 'assistant',
        'bubble--system': message.role === 'system',
      }"
    >
      {{ message.content }}
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 12px;
}

.bubble-row--user {
  flex-direction: row-reverse;
}

.bubble-row--system {
  justify-content: center;
}

.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.bubble--user {
  background: var(--chat-primary, #07c160);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble--assistant {
  background: #fff;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.bubble--system {
  background: #f5f5f5;
  color: #666;
  font-size: 12px;
  max-width: 90%;
}
</style>
