<script setup lang="ts">
import { computed } from "vue";
import ChatCardShell from "./ChatCardShell.vue";
import type { TicketCardPayload } from "@/types";
import {
  payableAmount,
  preferentialAmount,
  resolvePurchaseUnit,
} from "@/utils/ticketPriceDisplay";

const props = defineProps<{ payload: TicketCardPayload; embedded?: boolean }>();

const purchase = computed(() => resolvePurchaseUnit(props.payload));
const payable = computed(() => payableAmount(props.payload));
const preferential = computed(() => preferentialAmount(props.payload));
</script>

<template>
  <ChatCardShell :title="payload.ticketName">
    <template #tags>
      <span class="ticket-card__tag ticket-card__tag--ticket">门票</span>
      <span
        v-if="payload.recommendedReason"
        class="ticket-card__tag ticket-card__tag--reason"
      >
        {{ payload.recommendedReason }}
      </span>
    </template>

    <p v-if="payload.visitDate" class="ticket-card__date">计划 {{ payload.visitDate }} 出行</p>
    <p class="ticket-card__qty">
      {{ payload.quantity.adult }} 成人
      <template v-if="payload.quantity.child">
        · {{ payload.quantity.child }} 儿童
      </template>
    </p>

    <p class="ticket-card__unit-line">
      单价 ¥{{ purchase.unitPrice }} × {{ purchase.purchaseCount }} {{ purchase.purchaseUnit }}
    </p>

    <div class="ticket-card__price-row">
      <span class="ticket-card__price-label">总额</span>
      <span class="ticket-card__price ticket-card__price--payable">¥{{ payable }}</span>
    </div>
    <p v-if="payload.discountAmount" class="ticket-card__discount">
      优惠券抵扣 ¥{{ payload.discountAmount }}
    </p>
    <div class="ticket-card__price-row ticket-card__price-row--preferential">
      <span class="ticket-card__price-label">应付</span>
      <span class="ticket-card__price">¥{{ preferential }}</span>
    </div>
  </ChatCardShell>
</template>

<style scoped>
.ticket-card__tag {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.ticket-card__tag--ticket {
  color: #07c160;
  background: #e8f8ef;
}

.ticket-card__tag--reason {
  color: #ff7a45;
  background: #fff3e8;
}

.ticket-card__date {
  margin: 0 0 6px;
  font-size: 12px;
  color: #969799;
}

.ticket-card__qty {
  margin: 0 0 6px;
}

.ticket-card__unit-line {
  margin: 0 0 8px;
  font-size: 13px;
  color: #646566;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ticket-card__price-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.ticket-card__price-row--preferential {
  margin-top: 4px;
}

.ticket-card__price-label {
  font-size: 12px;
  color: #646566;
}

.ticket-card__price {
  font-size: 20px;
  font-weight: 700;
  color: #ee0a24;
}

.ticket-card__price--payable {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.ticket-card__discount {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--chat-primary, #07c160);
}
</style>
