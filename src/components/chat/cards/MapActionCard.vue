<script setup lang="ts">
import { computed } from "vue";
import ChatCardShell from "./ChatCardShell.vue";
import type { MapActionCardPayload } from "@/types";

const props = defineProps<{
  payload: MapActionCardPayload;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  open: [path: string];
}>();

const embedded = computed(() => props.embedded === true);

function onOpen() {
  emit("open", props.payload.deepLink);
}
</script>

<template>
  <div class="map-action-card" :class="{ 'map-action-card--embedded': embedded }">
    <ChatCardShell
      :title="payload.title"
      :tag="payload.tag || '地图'"
      tag-color="#07c160"
    >
      <p v-if="payload.subtitle" class="map-action-card__sub">{{ payload.subtitle }}</p>
      <p v-if="payload.activityName" class="map-action-card__meta">
        项目 · {{ payload.activityName }}
      </p>
      <van-button
        type="primary"
        size="small"
        round
        block
        class="map-action-card__btn"
        @click="onOpen"
      >
        {{ payload.buttonLabel }}
      </van-button>
    </ChatCardShell>
  </div>
</template>

<style scoped>
.map-action-card {
  width: 100%;
  max-width: 280px;
}

.map-action-card--embedded {
  max-width: none;
}

.map-action-card--embedded :deep(.chat-card) {
  max-width: none;
  background: #f7f8fa;
  box-shadow: none;
  padding: 10px;
}

.map-action-card__sub {
  margin: 0 0 6px;
  font-size: 13px;
  color: #646566;
  line-height: 1.4;
}

.map-action-card__meta {
  margin: 0 0 10px;
  font-size: 12px;
  color: #969799;
}

.map-action-card__btn {
  margin-top: 4px;
}
</style>
