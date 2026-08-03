<script setup lang="ts">
import { computed } from "vue";
import ChatCardShell from "./ChatCardShell.vue";
import type { TicketCardPayload } from "@/types";
import {
  payableAmount,
  preferentialAmount,
  resolvePurchaseUnit,
} from "@/utils/ticketPriceDisplay";

const props = defineProps<{
  payload: TicketCardPayload;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  confirm: [payload: TicketCardPayload];
}>();

const cartLines = computed(() => props.payload.items ?? []);
const isMultiLine = computed(() => cartLines.value.length > 1);
const purchase = computed(() =>
  isMultiLine.value ? null : resolvePurchaseUnit(props.payload),
);
const payable = computed(() => payableAmount(props.payload));
const preferential = computed(() => preferentialAmount(props.payload));

function totalPeople(): number {
  return props.payload.quantity.adult + props.payload.quantity.child;
}

function onConfirm() {
  if (props.disabled) return;
  emit("confirm", props.payload);
}
</script>

<template>
  <ChatCardShell title="确认产品信息">
    <template #tags>
      <span class="ticket-confirm__tag ticket-confirm__tag--purchase">购票</span>
    </template>

    <p class="ticket-confirm__name">{{ payload.ticketName }}</p>
    <p v-if="payload.visitDate" class="ticket-confirm__date">计划 {{ payload.visitDate }} 出行</p>
    <p class="ticket-confirm__qty">
      {{ payload.quantity.adult }} 成人
      <template v-if="payload.quantity.child"> · {{ payload.quantity.child }} 儿童</template>
      ，共 {{ totalPeople() }} 人
    </p>

    <ul v-if="isMultiLine" class="ticket-confirm__lines">
      <li v-for="line in cartLines" :key="line.productId" class="ticket-confirm__line">
        <span>{{ line.productName }}</span>
        <span>¥{{ line.unitPrice }} × {{ line.purchaseCount }}{{ line.purchaseUnit }}</span>
        <span class="ticket-confirm__line-amount">¥{{ line.lineAmount }}</span>
      </li>
    </ul>
    <p v-else-if="purchase" class="ticket-confirm__unit-line">
      单价 ¥{{ purchase.unitPrice }} × {{ purchase.purchaseCount }} {{ purchase.purchaseUnit }}
    </p>

    <div class="ticket-confirm__pay-row">
      <span>应付</span>
      <strong class="ticket-confirm__payable">¥{{ payable }}</strong>
    </div>
    <p v-if="payload.discountAmount" class="ticket-confirm__discount">
      优惠券抵扣 ¥{{ payload.discountAmount }}
    </p>
    <div class="ticket-confirm__pay-row ticket-confirm__pay-row--preferential">
      <span>优惠价</span>
      <strong>¥{{ preferential }}</strong>
    </div>

    <van-button
      type="primary"
      size="small"
      round
      block
      class="ticket-confirm__btn"
      :disabled="disabled"
      @click="onConfirm"
    >
      {{ disabled ? "已生成订单" : "确认并生成订单" }}
    </van-button>
  </ChatCardShell>
</template>

<style scoped>
.ticket-confirm__tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.ticket-confirm__tag--purchase {
  color: var(--chat-primary, #07c160);
  background: var(--chat-primary-light, #e8f8ef);
}

.ticket-confirm__name {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.ticket-confirm__date {
  margin: 0 0 4px;
  font-size: 12px;
  color: #969799;
}

.ticket-confirm__qty {
  margin: 0 0 6px;
  font-size: 13px;
  color: #646566;
}

.ticket-confirm__lines {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.ticket-confirm__line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px 8px;
  font-size: 13px;
  color: #646566;
}

.ticket-confirm__line + .ticket-confirm__line {
  margin-top: 6px;
}

.ticket-confirm__line-amount {
  font-weight: 600;
  color: #323233;
}

.ticket-confirm__unit-line {
  margin: 0 0 8px;
  font-size: 13px;
  color: #646566;
}

.ticket-confirm__pay-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
  color: #323233;
}

.ticket-confirm__pay-row--preferential {
  margin-bottom: 10px;
}

.ticket-confirm__pay-row strong {
  font-size: 20px;
  color: #ee0a24;
}

.ticket-confirm__payable {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #323233 !important;
}

.ticket-confirm__discount {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--chat-primary, #07c160);
}

.ticket-confirm__btn {
  background: var(--chat-primary, #07c160);
  border-color: var(--chat-primary, #07c160);
}
</style>
