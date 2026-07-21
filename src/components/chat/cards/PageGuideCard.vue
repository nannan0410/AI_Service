<script setup lang="ts">
import ChatCardShell from "./ChatCardShell.vue";
import type { PageGuideCardPayload } from "@/types";

const props = defineProps<{
  payload: PageGuideCardPayload;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  open: [path: string];
  checkin: [payload: PageGuideCardPayload];
}>();

function onClick() {
  if (props.payload.actionDone) return;
  if (props.payload.inlineAction === "checkin" && props.payload.spotId) {
    emit("checkin", props.payload);
    return;
  }
  emit("open", props.payload.path);
}
</script>

<template>
  <div :class="{ 'page-guide-card--embedded': embedded === true }">
    <ChatCardShell :title="payload.title">
      <template v-if="payload.tag" #tags>
        <span class="page-guide-card__tag">{{ payload.tag }}</span>
      </template>
      <p v-if="payload.description" class="page-guide-card__desc">
        {{ payload.description }}
      </p>
      <p v-if="payload.plateNo" class="page-guide-card__plate">
        当前车牌：<span class="page-guide-card__plate-no">{{ payload.plateNo }}</span>
      </p>
      <van-button
        type="primary"
        size="small"
        round
        block
        class="page-guide-card__btn"
        :disabled="payload.actionDone === true"
        @click="onClick"
      >
        {{ payload.actionDone ? "已打卡" : payload.buttonLabel }}
      </van-button>
    </ChatCardShell>
  </div>
</template>

<style scoped>
.page-guide-card--embedded :deep(.chat-card) {
  background: transparent;
  padding: 0;
}

.page-guide-card__tag {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #ff976a;
  background: rgba(255, 151, 106, 0.14);
  border: 1px solid rgba(255, 151, 106, 0.35);
}

.page-guide-card__desc {
  margin: 0 0 10px;
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
}

.page-guide-card__plate {
  margin: 0 0 12px;
  font-size: 14px;
  color: #323233;
  line-height: 1.5;
}

.page-guide-card__plate-no {
  font-weight: 600;
  color: #1989fa;
}

.page-guide-card__btn {
  margin-top: 0;
}
</style>
