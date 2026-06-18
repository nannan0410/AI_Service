<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage } from "@/types";
import AssistantAvatar from "@/components/assistant/AssistantAvatar.vue";

const props = defineProps<{ message: ChatMessage }>();

interface TextSegment {
  text: string;
  highlighted: boolean;
}

const autoHighlightKeywords = [
  "确认下单",
  "模拟支付",
  "优惠价格",
  "优惠价",
  "优惠券",
  "下单支付",
  "惊喜",
  "支付",
  "下单",
  "优惠",
];

const autoHighlightAmountPattern =
  "(?:立减\\s*\\d+(?:\\.\\d+)?\\s*元|券\\s*\\d+(?:\\.\\d+)?\\s*元|\\d+(?:\\.\\d+)?\\s*元券|减\\s*\\d+(?:\\.\\d+)?\\s*元|省\\s*\\d+(?:\\.\\d+)?\\s*元|\\d+(?:\\.\\d+)?\\s*折)";

const autoHighlightPattern = new RegExp(
  `(${autoHighlightAmountPattern}|${autoHighlightKeywords.join("|")})`,
  "g"
);

const exactAutoHighlightPattern = new RegExp(`^${autoHighlightAmountPattern}$`);

function splitAutoHighlightText(text: string) {
  return text
    .split(autoHighlightPattern)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      highlighted:
        autoHighlightKeywords.includes(part) ||
        exactAutoHighlightPattern.test(part),
    }));
}

function parseHighlightedText(content = "") {
  const segments: TextSegment[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content))) {
    if (match.index > lastIndex) {
      segments.push(
        ...splitAutoHighlightText(content.slice(lastIndex, match.index))
      );
    }

    segments.push({ text: match[1], highlighted: true });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push(...splitAutoHighlightText(content.slice(lastIndex)));
  }

  return segments.length ? segments : [{ text: content, highlighted: false }];
}

const contentSegments = computed(() =>
  props.message.role === "assistant"
    ? parseHighlightedText(props.message.content)
    : [{ text: props.message.content || "", highlighted: false }]
);
</script>

<template>
  <div
    class="bubble-row"
    :class="{
      'bubble-row--user': message.role === 'user',
      'bubble-row--system': message.role === 'system',
    }"
  >
    <AssistantAvatar v-if="message.role === 'assistant'" :size="36" />
    <div
      class="bubble"
      :class="{
        'bubble--user': message.role === 'user',
        'bubble--assistant': message.role === 'assistant',
        'bubble--system': message.role === 'system',
      }"
    >
      <!-- <span v-if="message.role === 'assistant'" class="bubble__icon">🤖</span> -->
      <span
        v-for="(segment, index) in contentSegments"
        :key="`${index}-${segment.text}`"
        :class="{ bubble__highlight: segment.highlighted }"
      >
        {{ segment.text }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 12px;
}

.bubble-row--user {
  flex-direction: row-reverse;
}

.bubble-row--system {
  justify-content: center;
}

.bubble {
  max-width: 75%;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    "Comic Sans MS", "Marker Felt", sans-serif;
}

.bubble__icon {
  margin-right: 3px;
}

.bubble__highlight {
  color: #ff5a3c;
  font-weight: 700;
}

.bubble--user {
  background: var(--chat-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble--assistant {
  background: #fff;
  color: #333;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.bubble--system {
  background: #f6f6f6;
  color: #888;
  font-size: 11px;
  max-width: 90%;
  padding: 8px 12px;
}
</style>
