<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog, showToast } from "vant";
import { useAuthStore } from "@/store/authStore";
import { useFeedbackStore } from "@/store/feedbackStore";
import { messageTypeLabel } from "@/utils/messageFeedback";

const router = useRouter();
const authStore = useAuthStore();
const feedbackStore = useFeedbackStore();

const list = computed(() => feedbackStore.favorites);

onMounted(() => {
  if (authStore.memberId) {
    feedbackStore.bindMember(authStore.memberId);
    feedbackStore.loadPersisted();
  }
});

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

async function onRemove(favoriteId: string) {
  try {
    await showConfirmDialog({
      title: "取消收藏？",
      confirmButtonText: "取消收藏",
      cancelButtonText: "再想想",
    });
    feedbackStore.removeFavoriteById(favoriteId);
    showToast("已取消收藏");
  } catch {
    /* cancel */
  }
}
</script>

<template>
  <div class="favorites-page">
    <van-nav-bar
      title="收藏记录"
      left-arrow
      class="favorites-page__nav"
      @click-left="router.back()"
    />

    <p class="favorites-page__hint">
      收藏与聊天记录分开保存；清除聊天不会删除这里的内容。
    </p>

    <van-empty v-if="list.length === 0" description="暂无收藏" />

    <div v-else class="favorites-page__list">
      <article
        v-for="item in list"
        :key="item.favoriteId"
        class="favorites-page__card"
      >
        <header class="favorites-page__card-head">
          <span class="favorites-page__type">{{
            messageTypeLabel(item.messageType)
          }}</span>
          <span class="favorites-page__time">{{ formatTime(item.createdAt) }}</span>
        </header>
        <p v-if="item.userText" class="favorites-page__user">
          问：{{ item.userText }}
        </p>
        <p class="favorites-page__snippet">{{ item.contentSnippet }}</p>
        <p v-if="item.payloadSummary" class="favorites-page__extra">
          {{ item.payloadSummary }}
        </p>
        <footer class="favorites-page__card-foot">
          <span class="favorites-page__meta">
            {{ item.scenicName || item.scenicId || "未标注景区" }}
            <template v-if="item.skillId"> · {{ item.skillId }}</template>
          </span>
          <button
            type="button"
            class="favorites-page__remove"
            @click="onRemove(item.favoriteId)"
          >
            取消收藏
          </button>
        </footer>
      </article>
    </div>
  </div>
</template>

<style scoped>
.favorites-page {
  min-height: 100%;
  background: #f7f8fa;
  padding-bottom: 24px;
}

.favorites-page__nav {
  background: #fff;
}

.favorites-page__hint {
  margin: 12px 16px 8px;
  font-size: 12px;
  color: #969799;
  line-height: 1.5;
}

.favorites-page__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 12px 16px;
}

.favorites-page__card {
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
}

.favorites-page__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.favorites-page__type {
  font-size: 12px;
  font-weight: 600;
  color: #576b95;
}

.favorites-page__time {
  font-size: 11px;
  color: #c8c9cc;
}

.favorites-page__user {
  margin: 0 0 6px;
  font-size: 12px;
  color: #969799;
  line-height: 1.45;
}

.favorites-page__snippet {
  margin: 0;
  font-size: 14px;
  color: #323233;
  line-height: 1.5;
  white-space: pre-line;
  word-break: break-word;
}

.favorites-page__extra {
  margin: 6px 0 0;
  font-size: 12px;
  color: #646566;
}

.favorites-page__card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #f2f3f5;
}

.favorites-page__meta {
  min-width: 0;
  font-size: 11px;
  color: #969799;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorites-page__remove {
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #ee0a24;
  font-size: 12px;
  cursor: pointer;
}
</style>
