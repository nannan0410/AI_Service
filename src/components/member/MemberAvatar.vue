<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useAssistantStore } from "@/store/assistantStore";

const { size } = withDefaults(
  defineProps<{
    size?: number;
  }>(),
  {
    size: 36,
  }
);

const assistantStore = useAssistantStore();
const { memberDefaultAvatarUrl } = storeToRefs(assistantStore);

onMounted(() => {
  assistantStore.loadConfig();
});
</script>

<template>
  <div
    class="member-avatar"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      :key="memberDefaultAvatarUrl"
      :src="memberDefaultAvatarUrl"
      alt="我"
      class="member-avatar__img"
      :style="{
        width: `${Math.max(size - 4, 20)}px`,
        height: `${Math.max(size - 4, 20)}px`,
      }"
    />
  </div>
</template>

<style scoped>
.member-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(58, 87, 112, 0.1);
}

.member-avatar__img {
  border-radius: 50%;
  object-fit: cover;
}
</style>
