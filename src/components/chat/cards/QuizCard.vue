<script setup lang="ts">
import ChatCardShell from "./ChatCardShell.vue";
import type { QuizCardPayload } from "@/types";

const props = defineProps<{
  payload: QuizCardPayload;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  answer: [optionKey: string];
}>();

function onSelect(key: string) {
  if (props.disabled || props.payload.status !== "active") return;
  emit("answer", key);
}
</script>

<template>
  <ChatCardShell :title="payload.title" tag="答题" tag-color="#7c3aed">
    <p class="quiz-card__progress">
      第 {{ payload.questionIndex + 1 }} / {{ payload.totalQuestions }} 题
    </p>
    <p class="quiz-card__question">{{ payload.question }}</p>
    <div class="quiz-card__options">
      <button
        v-for="opt in payload.options"
        :key="opt.key"
        type="button"
        class="quiz-card__option"
        :class="{
          'quiz-card__option--selected': payload.selectedKey === opt.key,
          'quiz-card__option--disabled':
            disabled || payload.status !== 'active',
        }"
        :disabled="disabled || payload.status !== 'active'"
        @click="onSelect(opt.key)"
      >
        <span class="quiz-card__key">{{ opt.key }}</span>
        <span>{{ opt.text }}</span>
      </button>
    </div>
    <p v-if="payload.status === 'wrong'" class="quiz-card__hint quiz-card__hint--wrong">
      回答错误，本次挑战已结束
    </p>
    <p v-else-if="payload.status === 'finished'" class="quiz-card__hint">
      本套题已完成
    </p>
  </ChatCardShell>
</template>

<style scoped>
.quiz-card__progress {
  margin: 0 0 8px;
  font-size: 12px;
  color: #969799;
}

.quiz-card__question {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  color: #323233;
}

.quiz-card__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quiz-card__option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ebedf0;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  font-size: 14px;
  line-height: 1.4;
  color: #323233;
  cursor: pointer;
}

.quiz-card__option:active:not(:disabled) {
  background: #f7f8fa;
}

.quiz-card__option--selected {
  border-color: #7c3aed;
  background: #f5f3ff;
}

.quiz-card__option--disabled {
  cursor: default;
  opacity: 0.85;
}

.quiz-card__key {
  flex-shrink: 0;
  font-weight: 700;
  color: #7c3aed;
}

.quiz-card__hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #07c160;
}

.quiz-card__hint--wrong {
  color: #ee0a24;
}
</style>
