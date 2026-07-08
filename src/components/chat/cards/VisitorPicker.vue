<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ChatCardShell from "./ChatCardShell.vue";
import type { IdType, VisitorPickPayload } from "@/types";

const props = defineProps<{
  payload: VisitorPickPayload;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  confirm: [idNumbers: string[]];
}>();

const idTypeLabel: Record<IdType, string> = {
  id_card: "身份证",
  passport: "护照",
  hk_macao_pass: "港澳通行证",
  taiwan_pass: "台湾通行证",
};

const requiredCount = computed(
  () => props.payload.quantity.adult + props.payload.quantity.child
);

const selected = ref<string[]>([]);
const submitting = ref(false);

watch(
  () => props.payload,
  (payload) => {
    selected.value = payload.visitors
      .slice(0, payload.quantity.adult + payload.quantity.child)
      .map((item) => item.idNumber);
    submitting.value = false;
  },
  { immediate: true }
);

const canConfirm = computed(
  () =>
    !props.disabled &&
    !submitting.value &&
    selected.value.length === requiredCount.value
);

function toggle(idNumber: string) {
  if (props.disabled || submitting.value) return;
  const index = selected.value.indexOf(idNumber);
  if (index >= 0) {
    selected.value.splice(index, 1);
    return;
  }
  if (selected.value.length >= requiredCount.value) return;
  selected.value.push(idNumber);
}

function onConfirm() {
  if (!canConfirm.value) return;
  submitting.value = true;
  emit("confirm", [...selected.value]);
}

function maskId(idNumber: string) {
  if (idNumber.length <= 8) return idNumber;
  return `${idNumber.slice(0, 3)}****${idNumber.slice(-4)}`;
}
</script>

<template>
  <ChatCardShell title="选择出行游客" tag="购票" tag-color="var(--chat-primary)">
    <p class="visitor-picker__hint">
      需选择 {{ payload.quantity.adult }} 成人
      <template v-if="payload.quantity.child">
        · {{ payload.quantity.child }} 儿童
      </template>
      （已选 {{ selected.length }}/{{ requiredCount }}）
    </p>

    <ul class="visitor-picker__list">
      <li
        v-for="visitor in payload.visitors"
        :key="visitor.idNumber"
        class="visitor-picker__item"
        :class="{
          'visitor-picker__item--selected': selected.includes(visitor.idNumber),
          'visitor-picker__item--disabled': disabled || submitting,
        }"
        @click="toggle(visitor.idNumber)"
      >
        <span class="visitor-picker__check">
          {{ selected.includes(visitor.idNumber) ? "✓" : "" }}
        </span>
        <div class="visitor-picker__info">
          <strong>{{ visitor.name }}</strong>
          <span>{{ idTypeLabel[visitor.idType] }} · {{ maskId(visitor.idNumber) }}</span>
        </div>
      </li>
    </ul>

    <p class="visitor-picker__amount">
      应付
      <strong>¥{{ payload.totalAmount }}</strong>
      <span v-if="payload.discountAmount" class="visitor-picker__discount">
        已优惠 ¥{{ payload.discountAmount }}
      </span>
    </p>

    <van-button
      type="primary"
      size="small"
      round
      block
      class="visitor-picker__btn"
      :disabled="!canConfirm"
      :loading="submitting"
      @click="onConfirm"
    >
      {{ disabled ? "已确认" : "确认并生成订单" }}
    </van-button>
  </ChatCardShell>
</template>

<style scoped>
.visitor-picker__hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #969799;
}

.visitor-picker__list {
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}

.visitor-picker__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 6px;
  border-radius: 8px;
  border: 1px solid #ebedf0;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.visitor-picker__item--selected {
  border-color: var(--chat-primary);
  background: var(--chat-primary-light, #e8f8ef);
}

.visitor-picker__item--disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.visitor-picker__check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid #dcdee0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--chat-primary);
  flex-shrink: 0;
}

.visitor-picker__item--selected .visitor-picker__check {
  border-color: var(--chat-primary);
  background: #fff;
}

.visitor-picker__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #646566;
}

.visitor-picker__info strong {
  font-size: 14px;
  color: #323233;
}

.visitor-picker__amount {
  margin: 0 0 8px;
  font-size: 13px;
  color: #323233;
}

.visitor-picker__amount strong {
  font-size: 18px;
  color: #ee0a24;
}

.visitor-picker__discount {
  margin-left: 6px;
  font-size: 12px;
  color: var(--chat-primary);
}

.visitor-picker__btn {
  background: var(--chat-primary);
  border-color: var(--chat-primary);
}
</style>
