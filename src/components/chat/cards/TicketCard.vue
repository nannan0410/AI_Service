<script setup lang="ts">
import { computed } from "vue";
import ChatCardShell from "./ChatCardShell.vue";
import type { TicketCardPayload } from "@/types";
import { useAssistantStore } from "@/store/assistantStore";
import { filterExplainReason } from "@/utils/explainReasons";
import {
  payableAmount,
  preferentialAmount,
  resolvePurchaseUnit,
} from "@/utils/ticketPriceDisplay";

const props = defineProps<{ payload: TicketCardPayload; embedded?: boolean }>();

const assistantStore = useAssistantStore();

const cartLines = computed(() => props.payload.items ?? []);
const isMultiLine = computed(() => cartLines.value.length > 1);
const purchase = computed(() =>
  isMultiLine.value ? null : resolvePurchaseUnit(props.payload),
);
const payable = computed(() => payableAmount(props.payload));
const preferential = computed(() => preferentialAmount(props.payload));
const displayRecommendedReason = computed(() =>
  filterExplainReason(
    props.payload.recommendedReason,
    assistantStore.uiConfig.showExplainReasons !== false,
  ),
);
</script>

<template>
  <ChatCardShell :title="payload.ticketName">
    <template #tags>
      <span class="ticket-card__tag ticket-card__tag--ticket">门票</span>
      <span
        v-if="displayRecommendedReason"
        class="ticket-card__tag ticket-card__tag--reason"
      >
        {{ displayRecommendedReason }}
      </span>
    </template>

    <p v-if="payload.visitDate" class="ticket-card__date">计划 {{ payload.visitDate }} 出行</p>
    <p class="ticket-card__qty">
      {{ payload.quantity.adult }} 成人
      <template v-if="payload.quantity.child">
        · {{ payload.quantity.child }} 儿童
      </template>
    </p>

    <ul v-if="isMultiLine" class="ticket-card__lines">
      <li v-for="line in cartLines" :key="line.productId" class="ticket-card__line">
        <span class="ticket-card__line-name">{{ line.productName }}</span>
        <span class="ticket-card__line-meta">
          ¥{{ line.unitPrice }} × {{ line.purchaseCount }}{{ line.purchaseUnit }}
        </span>
        <span class="ticket-card__line-amount">¥{{ line.lineAmount }}</span>
      </li>
    </ul>
    <p v-else-if="purchase" class="ticket-card__unit-line">
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
  flex-shrink: 1;
  max-width: 100%;
  color: #ff7a45;
  background: #fff3e8;
  white-space: pre-line;
  line-height: 1.4;
}

.ticket-card__date {
  margin: 0 0 6px;
  font-size: 12px;
  color: #969799;
}

.ticket-card__qty {
  margin: 0 0 6px;
}

.ticket-card__lines {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.ticket-card__line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px 8px;
  align-items: baseline;
  font-size: 13px;
  color: #646566;
}

.ticket-card__line + .ticket-card__line {
  margin-top: 6px;
}

.ticket-card__line-name {
  min-width: 0;
  word-break: break-word;
}

.ticket-card__line-meta {
  white-space: nowrap;
}

.ticket-card__line-amount {
  font-weight: 600;
  color: #323233;
  white-space: nowrap;
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
