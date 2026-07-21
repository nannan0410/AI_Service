<script setup lang="ts">
import { computed } from "vue";
import ChatCardShell from "./ChatCardShell.vue";
import type { ActivityCardPayload } from "@/types";
import {
  ACTIVITY_CATEGORY_LABELS,
  formatActivityMetaLine,
  formatHotProjectLine,
  formatQueueLine,
  formatVirtualQueueLine,
} from "@/utils/activityDisplay";

const props = withDefaults(
  defineProps<{
    payload: ActivityCardPayload;
    tag?: string;
    embedded?: boolean;
  }>(),
  {
    tag: undefined,
    embedded: false,
  },
);

function queueLine(payload: ActivityCardPayload) {
  return formatQueueLine(payload, {
    respectGuideContext: Boolean(payload.guideContext),
  });
}

const resolvedTag = computed(() => {
  if (props.tag) return props.tag;
  if (props.payload.category && ACTIVITY_CATEGORY_LABELS[props.payload.category]) {
    return ACTIVITY_CATEGORY_LABELS[props.payload.category];
  }
  return "项目";
});
</script>

<template>
  <div :class="{ 'activity-card--embedded': embedded }">
    <ChatCardShell :title="payload.name" :tag="resolvedTag" tag-color="#7232dd">
      <p class="activity-card__meta">
        {{ formatActivityMetaLine(payload) }}
      </p>
      <p v-if="payload.isHot" class="activity-card__hot">热门项目</p>
      <p v-if="queueLine(payload)" class="activity-card__queue">
        {{ queueLine(payload) }}
      </p>
      <p v-if="formatHotProjectLine(payload)" class="activity-card__hot-tip">
        {{ formatHotProjectLine(payload) }}
      </p>
      <p
        v-if="payload.showStartTimes?.length"
        class="activity-card__show-times"
      >
        演出场次 {{ payload.showStartTimes.join(" / ") }}
      </p>
      <p
        v-if="payload.recommendedDuration && payload.category !== 'show'"
        class="activity-card__duration"
      >
        建议游玩 {{ payload.recommendedDuration }}
      </p>
      <p v-if="formatVirtualQueueLine(payload)" class="activity-card__vq">
        {{ formatVirtualQueueLine(payload) }}
      </p>
      <div v-if="payload.tags?.length" class="activity-card__tags">
        <span v-for="tagItem in payload.tags" :key="tagItem" class="activity-card__tag">
          {{ tagItem }}
        </span>
      </div>
      <p v-if="payload.reason" class="activity-card__reason">{{ payload.reason }}</p>
    </ChatCardShell>
  </div>
</template>

<style scoped>
.activity-card--embedded :deep(.chat-card) {
  box-shadow: none;
  border: 1px solid #ebedf0;
}

.activity-card__meta {
  margin: 0 0 6px;
  font-size: 12px;
  color: #646566;
}

.activity-card__queue {
  margin: 0 0 4px;
  font-size: 12px;
  color: #ed6a0c;
}

.activity-card__hot {
  display: inline-block;
  margin: 0 0 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #ee0a24;
  background: rgba(238, 10, 36, 0.08);
}

.activity-card__hot-tip {
  margin: 0 0 4px;
  font-size: 12px;
  color: #ee0a24;
}

.activity-card__show-times {
  margin: 0 0 4px;
  font-size: 12px;
  color: #1989fa;
}

.activity-card__duration {
  margin: 0 0 4px;
  font-size: 12px;
  color: #646566;
}

.activity-card__vq {
  margin: 0 0 6px;
  font-size: 11px;
  color: #07c160;
}

.activity-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.activity-card__tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f2f3f5;
  font-size: 11px;
  color: #646566;
}

.activity-card__reason {
  margin: 8px 0 0;
  color: var(--chat-primary);
  font-size: 12px;
  line-height: 1.45;
}
</style>
