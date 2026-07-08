<script setup lang="ts">
import type { TicketFallbackPayload } from "@/types";

defineProps<{
  payload: TicketFallbackPayload;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  openList: [path: string];
}>();

function formatPlanQuantity(quantity: { adult: number; child: number }): string {
  const parts: string[] = [];
  if (quantity.adult > 0) parts.push(`${quantity.adult}成人`);
  if (quantity.child > 0) parts.push(`${quantity.child}儿童`);
  return parts.join("+");
}
</script>

<template>
  <div class="ticket-fallback" :class="{ 'ticket-fallback--embedded': embedded }">
    <p v-if="payload.plan?.length" class="ticket-fallback__plan-title">参考组合</p>
    <ul v-if="payload.plan?.length" class="ticket-fallback__plan">
      <li v-for="line in payload.plan" :key="line.productId" class="ticket-fallback__plan-item">
        <span class="ticket-fallback__plan-dot" aria-hidden="true" />
        <span class="ticket-fallback__plan-text">
          {{ line.productName }}：{{ formatPlanQuantity(line.quantity) }}
        </span>
      </li>
    </ul>
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

.ticket-fallback__plan-title {
  margin: 0 0 6px;
  font-size: 12px;
  color: #888;
}

.ticket-fallback__plan {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 13px;
  line-height: 1.5;
  color: #555;
}

.ticket-fallback__plan-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ticket-fallback__plan-item + .ticket-fallback__plan-item {
  margin-top: 6px;
}

.ticket-fallback__plan-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--chat-primary, #07c160);
}

.ticket-fallback__plan-text {
  min-width: 0;
  word-break: break-word;
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
