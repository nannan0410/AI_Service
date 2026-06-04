<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useAssistantStore } from "@/store/assistantStore";
import type { AssistantMotionId } from "@/types";

const props = withDefaults(
  defineProps<{
    motion?: AssistantMotionId;
    size?: number;
    showName?: boolean;
  }>(),
  {
    motion: "idle",
    size: 48,
    showName: false,
  }
);

const assistantStore = useAssistantStore();

onMounted(() => {
  assistantStore.loadConfig();
});

const displayMotion = computed(() => props.motion || assistantStore.motion);

const avatarSrc = computed(() => {
  const cfg = assistantStore.uiConfig;
  if (displayMotion.value === "idle") return cfg.assistantAvatarUrl;
  const found = cfg.motions.find((m) => m.actionId === displayMotion.value);
  return found?.assetUrl || cfg.assistantAvatarUrl;
});

const assistantName = computed(() => assistantStore.assistantNickname);
</script>

<template>
  <div class="assistant-avatar">
    <div
      class="assistant-avatar__shell"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <img
        :src="avatarSrc"
        :alt="assistantName"
        class="assistant-avatar__img"
        :style="{
          width: `${Math.max(size - 4, 20)}px`,
          height: `${Math.max(size - 4, 20)}px`,
        }"
      />
    </div>
    <span v-if="showName" class="assistant-avatar__name">{{
      assistantName
    }}</span>
  </div>
</template>

<style scoped>
.assistant-avatar {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.assistant-avatar__shell {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 4px 14px rgba(58, 87, 112, 0.12);
}

.assistant-avatar__img {
  border-radius: 50%;
  object-fit: cover;
}

.assistant-avatar__name {
  font-size: 12px;
  color: #666;
}
</style>
