<script setup lang="ts">
import type { TicketFallbackPayload } from "@/types";

defineProps<{
  payload: TicketFallbackPayload;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  openList: [path: string];
}>();
</script>

<template>
  <div class="ticket-fallback" :class="{ 'ticket-fallback--embedded': embedded }">
    <button
      type="button"
      class="ticket-fallback__btn"
      @click="emit('openList', payload.listPath)"
    >
      去购票列表选购
    </button>
  </div>
</template>

<style scoped>
.ticket-fallback {
  padding: 12px;
  background: #f8fafc;
  border-radius: 12px;
}

.ticket-fallback--embedded {
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.92);
}

.ticket-fallback__btn {
  width: 100%;
  height: 40px;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  color: #fff;
  background: var(--chat-primary, #07c160);
}
</style>
