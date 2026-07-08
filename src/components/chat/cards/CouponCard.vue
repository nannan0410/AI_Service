<script setup lang="ts">
import ChatCardShell from "./ChatCardShell.vue";
import { COUPON_STATUS_LABEL } from "@/utils/newGuestCoupon";
import type { CouponCardPayload } from "@/types";
import { computed } from "vue";

const props = defineProps<{ payload: CouponCardPayload; embedded?: boolean }>();

const typeLabel: Record<CouponCardPayload["type"], string> = {
  cash: "代金券",
  discount: "折扣券",
  parking: "停车券",
  dining: "餐饮券",
  retail: "商品券",
  express: "快票券",
};

const valueText = computed(() => {
  if (props.payload.type === "express") {
    return props.payload.redeemActivityName
      ? `兑换 ${props.payload.redeemActivityName}`
      : "兑换 1 次";
  }
  return `¥${props.payload.value}`;
});

const status = computed(() => props.payload.status ?? "available");
const statusLabel = computed(() => {
  if (props.payload.claimable) return "可领取";
  return COUPON_STATUS_LABEL[status.value];
});
const isInactive = computed(() => status.value !== "available");
const embedded = computed(() => props.embedded === true);
</script>

<template>
  <div :class="{ 'coupon-card--inactive': isInactive, 'coupon-card--embedded': embedded }">
    <ChatCardShell :title="payload.title">
      <template #tags>
        <span class="coupon-card__type-tag">{{ typeLabel[payload.type] }}</span>
        <span class="coupon-card__status-tag" :class="`coupon-card__status-tag--${status}`">
          {{ statusLabel }}
        </span>
      </template>
      <div class="coupon-card__value">{{ valueText }}</div>
      <p v-if="payload.condition" class="coupon-card__condition">
        {{ payload.condition }}
      </p>
      <p class="coupon-card__expire">有效期至 {{ payload.expireAt }}</p>
    </ChatCardShell>
  </div>
</template>

<style scoped>
.coupon-card--inactive :deep(.chat-card) {
  opacity: 0.88;
}

.coupon-card--embedded :deep(.chat-card) {
  background: transparent;
  padding: 0;
}

.coupon-card__type-tag,
.coupon-card__status-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  max-width: 100%;
  white-space: normal;
  word-break: break-word;
  text-align: center;
}

.coupon-card__type-tag {
  color: #ff976a;
  background: rgba(255, 151, 106, 0.14);
  border: 1px solid rgba(255, 151, 106, 0.35);
}

.coupon-card__status-tag--available {
  color: #07c160;
  background: rgba(7, 193, 96, 0.12);
  border: 1px solid rgba(7, 193, 96, 0.25);
}

.coupon-card__status-tag--used {
  color: #969799;
  background: rgba(150, 151, 153, 0.12);
  border: 1px solid rgba(150, 151, 153, 0.25);
}

.coupon-card__status-tag--expired {
  color: #ed6a0c;
  background: rgba(237, 106, 12, 0.12);
  border: 1px solid rgba(237, 106, 12, 0.25);
}

.coupon-card__value {
  font-size: 24px;
  font-weight: 700;
  color: #ee0a24;
  line-height: 1.2;
}

.coupon-card--inactive .coupon-card__value {
  color: #969799;
}

.coupon-card__condition {
  margin: 6px 0 0;
}

.coupon-card__expire {
  margin: 6px 0 0;
  font-size: 12px;
  color: #969799;
}
</style>
