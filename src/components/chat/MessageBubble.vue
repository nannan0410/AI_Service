<script setup lang="ts">
import type { ChatMessage } from "@/types";
import AssistantAvatar from "@/components/assistant/AssistantAvatar.vue";

defineProps<{ message: ChatMessage }>();
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
      <span v-if="message.role === 'assistant'" class="bubble__icon">🤖</span>
      <span v-if="message.role === 'user'" class="bubble__icon">🧑</span>
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
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    "Comic Sans MS", "Marker Felt", sans-serif;
}

.bubble__icon {
  margin-right: 3px;
}

.bubble--user {
  background: var(--chat-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble--assistant {
  background: #fff;
  color: #333;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.bubble--system {
  background: #f6f6f6;
  color: #888;
  font-size: 11px;
  max-width: 90%;
  padding: 8px 12px;
}
</style>
