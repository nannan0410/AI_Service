<script setup lang="ts">
import type { RecommendEntry } from '@/types'

defineProps<{
  entries: RecommendEntry[]
}>()

const emit = defineEmits<{
  select: [entry: RecommendEntry]
}>()
</script>

<template>
  <nav
    v-if="entries.length"
    class="welcome-quick-services"
    aria-label="快捷服务"
  >
    <button
      v-for="entry in entries"
      :key="entry.entryId"
      type="button"
      class="welcome-quick-services__item"
      @click="emit('select', entry)"
    >
      <van-icon
        class="welcome-quick-services__icon"
        :name="entry.icon"
        size="15"
      />
      <span class="welcome-quick-services__label">{{ entry.title }}</span>
    </button>
  </nav>
</template>

<style scoped>
.welcome-quick-services {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 38px;
  margin-bottom: 8px;
}

.welcome-quick-services__item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 38px;
  padding: 0 8px;
  border: 1px solid rgba(7, 193, 96, 0.38);
  border-radius: 20px;
  background: rgba(7, 193, 96, 0.1);
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease;
}

.welcome-quick-services__item:active {
  background: rgba(7, 193, 96, 0.18);
  border-color: rgba(7, 193, 96, 0.52);
}

.welcome-quick-services__icon {
  flex-shrink: 0;
  color: #2d6b4a;
}

.welcome-quick-services__label {
  font-size: 11px;
  font-weight: 500;
  color: #2d6b4a;
  line-height: 1;
  white-space: nowrap;
}

@media (max-width: 390px) {
  .welcome-quick-services {
    gap: 6px;
  }

  .welcome-quick-services__item {
    height: 36px;
    padding: 0 6px;
    border-radius: 18px;
  }

  .welcome-quick-services__label {
    font-size: 10px;
  }
}
</style>
