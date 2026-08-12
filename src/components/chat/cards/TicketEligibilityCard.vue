<script setup lang="ts">
import ChatCardShell from './ChatCardShell.vue'
import type { TicketEligibilityCardPayload } from '@/types'

const props = defineProps<{
  payload: TicketEligibilityCardPayload
  disabled?: boolean
}>()

const emit = defineEmits<{
  answer: [ok: boolean]
}>()

function onAnswer(ok: boolean) {
  if (props.disabled || props.payload.status !== 'active') return
  emit('answer', ok)
}
</script>

<template>
  <ChatCardShell title="购票资格确认" tag="购票" tag-color="#07c160">
    <p class="eligibility-card__question">{{ payload.question }}</p>
    <div class="eligibility-card__actions">
      <button
        type="button"
        class="eligibility-card__btn eligibility-card__btn--yes"
        :disabled="disabled || payload.status !== 'active'"
        :class="{
          'eligibility-card__btn--selected':
            payload.status === 'answered' && payload.selected === true,
          'eligibility-card__btn--dim':
            payload.status === 'answered' && payload.selected !== true,
        }"
        @click="onAnswer(true)"
      >
        {{ payload.yesLabel }}
      </button>
      <button
        type="button"
        class="eligibility-card__btn eligibility-card__btn--no"
        :disabled="disabled || payload.status !== 'active'"
        :class="{
          'eligibility-card__btn--selected':
            payload.status === 'answered' && payload.selected === false,
          'eligibility-card__btn--dim':
            payload.status === 'answered' && payload.selected !== false,
        }"
        @click="onAnswer(false)"
      >
        {{ payload.noLabel }}
      </button>
    </div>
  </ChatCardShell>
</template>

<style scoped>
.eligibility-card__question {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  color: #323233;
}

.eligibility-card__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eligibility-card__btn {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ebedf0;
  border-radius: 10px;
  background: #fff;
  font-size: 14px;
  line-height: 1.4;
  color: #323233;
  text-align: left;
  cursor: pointer;
}

.eligibility-card__btn:disabled {
  cursor: default;
}

.eligibility-card__btn--yes {
  border-color: color-mix(in srgb, var(--chat-primary, #07c160) 35%, #ebedf0);
}

.eligibility-card__btn--selected {
  border-color: var(--chat-primary, #07c160);
  background: color-mix(in srgb, var(--chat-primary, #07c160) 12%, #fff);
  color: var(--chat-primary, #07c160);
  font-weight: 600;
}

.eligibility-card__btn--dim {
  opacity: 0.45;
}
</style>
