<script setup lang="ts">
import { computed } from "vue";
import type { ChatMessage } from "@/types";

const props = defineProps<{
  message: ChatMessage;
  favorited?: boolean;
}>();

const emit = defineEmits<{
  like: [];
  dislike: [];
  favorite: [];
}>();

const isLiked = computed(() => props.message.reaction === "like");
const isDisliked = computed(() => props.message.reaction === "dislike");
const isFavorited = computed(() =>
  props.favorited ?? Boolean(props.message.favorited),
);
</script>

<template>
  <div class="msg-feedback" role="group" aria-label="消息反馈">
    <button
      type="button"
      class="msg-feedback__btn"
      :class="{ 'msg-feedback__btn--active': isLiked }"
      :aria-pressed="isLiked"
      aria-label="赞"
      @click.stop="emit('like')"
    >
      <van-icon :name="isLiked ? 'good-job' : 'good-job-o'" size="16" />
    </button>
    <button
      type="button"
      class="msg-feedback__btn"
      :class="{ 'msg-feedback__btn--active-down': isDisliked }"
      :aria-pressed="isDisliked"
      aria-label="踩"
      @click.stop="emit('dislike')"
    >
      <van-icon name="good-job-o" size="16" class="msg-feedback__icon--down" />
    </button>
    <button
      type="button"
      class="msg-feedback__btn"
      :class="{ 'msg-feedback__btn--fav': isFavorited }"
      :aria-pressed="isFavorited"
      aria-label="收藏"
      @click.stop="emit('favorite')"
    >
      <van-icon :name="isFavorited ? 'star' : 'star-o'" size="16" />
    </button>
  </div>
</template>

<style scoped>
.msg-feedback {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.msg-feedback__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #c8c9cc;
  cursor: pointer;
}

.msg-feedback__btn:active {
  opacity: 0.75;
}

.msg-feedback__btn--active {
  color: #07c160;
  background: rgba(7, 193, 96, 0.1);
}

.msg-feedback__btn--active-down {
  color: #ee0a24;
  background: rgba(238, 10, 36, 0.08);
}

.msg-feedback__btn--fav {
  color: #ff976a;
  background: rgba(255, 151, 106, 0.12);
}

.msg-feedback__icon--down {
  transform: rotate(180deg);
}
</style>
