<script setup lang="ts">
import ChatCardShell from "./ChatCardShell.vue";
import type { StarIntroPayload } from "@/types";

defineProps<{ payload: StarIntroPayload }>();
</script>

<template>
  <ChatCardShell :title="`${payload.name}（${payload.species}）`" tag="明星" tag-color="#0ea5e9">
    <p v-if="payload.location" class="star-card__loc">{{ payload.location }}</p>
    <p class="star-card__intro">{{ payload.intro }}</p>
  </ChatCardShell>
</template>

<style scoped>
.star-card__loc {
  margin: 0 0 8px;
  font-size: 12px;
  color: #969799;
}

.star-card__intro {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: #323233;
  white-space: pre-wrap;
}
</style>
