<script setup lang="ts">
import { useRouter } from "vue-router";
import ChatCardShell from "./ChatCardShell.vue";
import type { OrderCardPayload } from "@/types";

const props = defineProps<{ payload: OrderCardPayload }>();
const router = useRouter();

const statusLabel: Record<OrderCardPayload["status"], string> = {
  pending: "待支付",
  paid: "待出行",
  completed: "已完成",
  refunded: "已退款",
};

const sourceLabel: Record<NonNullable<OrderCardPayload["source"]>, string> = {
  self: "自营",
  ota: "OTA",
  ta: "TA",
};

function onSubmit() {
  if (!props.payload.draftId) {
    return;
  }
  router.push({
    path: "/order/submit",
    query: { draftId: props.payload.draftId },
  });
}
</script>

<template>
  <ChatCardShell
    :title="payload.ticketName || '订单'"
    :tag="payload.source ? sourceLabel[payload.source] : '订单'"
    :tag-color="payload.readOnly ? '#969799' : 'var(--chat-primary)'"
  >
    <p class="order-card__id">{{ payload.orderId }}</p>
    <ul class="order-card__items">
      <li v-for="(item, index) in payload.items" :key="index">
        {{ item.name }} × {{ item.qty }}
      </li>
    </ul>
    <div class="order-card__footer">
      <span class="order-card__amount">¥{{ payload.totalAmount }}</span>
      <span class="order-card__status">{{ statusLabel[payload.status] }}</span>
    </div>
    <p v-if="payload.readOnly" class="order-card__hint">
      第三方订单如需改签/退票请联系购买平台
    </p>
    <van-button
      v-else-if="payload.status === 'pending'"
      type="primary"
      size="small"
      round
      block
      class="order-card__btn"
      @click="onSubmit"
    >
      去提交订单
    </van-button>
  </ChatCardShell>
</template>

<style scoped>
.order-card__id {
  margin: 0 0 6px;
  font-size: 12px;
  color: #969799;
}

.order-card__items {
  margin: 0 0 8px;
  padding-left: 16px;
}

.order-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-card__amount {
  font-size: 18px;
  font-weight: 700;
  color: #323233;
}

.order-card__status {
  font-size: 12px;
  color: var(--chat-primary);
}

.order-card__hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #969799;
  line-height: 1.4;
}

.order-card__btn {
  margin-top: 10px;
  background: var(--chat-primary);
  border-color: var(--chat-primary);
}
</style>
