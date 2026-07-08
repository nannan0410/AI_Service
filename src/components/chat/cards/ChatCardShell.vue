<script setup lang="ts">
defineProps<{
  title: string;
  tag?: string;
  tagColor?: string;
}>();
</script>

<template>
  <div class="chat-card">
    <div v-if="title || tag || $slots.tags" class="chat-card__head">
      <strong class="chat-card__title">{{ title }}</strong>
      <div v-if="$slots.tags || tag" class="chat-card__tags">
        <slot name="tags">
          <span
            v-if="tag"
            class="chat-card__tag"
            :style="{ color: tagColor || 'var(--chat-primary)' }"
          >
            {{ tag }}
          </span>
        </slot>
      </div>
    </div>
    <div class="chat-card__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.chat-card {
  width: 100%;
  max-width: 280px;
  min-width: 0;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.chat-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.chat-card__title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 15px;
  color: #323233;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.chat-card__tags {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 1;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.chat-card__tag {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
}

.chat-card__body {
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
