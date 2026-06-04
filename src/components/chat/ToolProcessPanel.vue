<script setup lang="ts">
import { ref, computed } from "vue";
import { useAiExecutionStore } from "@/store/aiExecutionStore";

const aiStore = useAiExecutionStore();
const expanded = ref(["1"]);

const runningLabel = computed(() => {
  const running = aiStore.steps.find((s) => s.status === "running");
  return running?.label ?? "AI 正在处理…";
});
</script>

<template>
  <van-collapse v-if="aiStore.visible" v-model="expanded" class="tool-panel">
    <van-collapse-item :title="runningLabel" name="1">
      <div
        v-for="step in aiStore.steps"
        :key="step.id"
        class="tool-panel__step"
      >
        <van-icon
          :name="
            step.status === 'done'
              ? 'success'
              : step.status === 'running'
              ? 'clock-o'
              : 'circle'
          "
          :color="
            step.status === 'done'
              ? 'var(--chat-primary)'
              : step.status === 'running'
              ? '#1989fa'
              : '#ccc'
          "
        />
        <span>{{ step.label }}</span>
      </div>
    </van-collapse-item>
  </van-collapse>
</template>

<style scoped>
.tool-panel {
  margin: 8px 12px 0;
  border-radius: 8px;
  overflow: hidden;
}

.tool-panel__step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: #333;
}
</style>
