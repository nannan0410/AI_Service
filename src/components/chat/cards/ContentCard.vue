<script setup lang="ts">
import ChatCardShell from "./ChatCardShell.vue";
import type { ContentCardPayload } from "@/types";

defineProps<{ payload: ContentCardPayload }>();

const typeLabel: Record<ContentCardPayload["type"], string> = {
  traffic: "交通",
  entry_notice: "入园",
  faq: "FAQ",
  guide: "攻略",
  strategy: "玩法",
};
</script>

<template>
  <ChatCardShell
    :title="payload.title"
    :tag="typeLabel[payload.type]"
    tag-color="#1989fa"
  >
    <p class="content-card__body">{{ payload.body }}</p>
  </ChatCardShell>
</template>

<style scoped>
.content-card__body {
  margin: 0;
  white-space: pre-wrap;
}
</style>
