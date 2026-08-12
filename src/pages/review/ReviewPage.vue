<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { showToast } from "vant";
import {
  fetchReviewEligibility,
  fetchReviewRecommendActivities,
  submitReview,
  uploadReviewImage,
} from "@/api/business";
import {
  REVIEW_CONTENT_MAX,
  REVIEW_TAG_OPTIONS,
  qualifiesReviewReward,
} from "@/utils/reviewForm";
import {
  REVIEW_RECOMMEND_ACTIVITY_MAX,
  scenicDayKey,
} from "@/utils/scenicReviewAccess";
import { markScenicReviewedToday } from "@/utils/scenicReviewClient";
import { generateReviewDraft } from "@/utils/generateReviewDraft";
import { useAuthStore } from "@/store/authStore";
import { useScenicStore } from "@/store/scenicStore";
import type { ReviewRecommendActivity } from "@/types";

const router = useRouter();
const authStore = useAuthStore();
const scenicStore = useScenicStore();

const loading = ref(true);
const canReview = ref(false);
const blockReason = ref("");
const rating = ref(0);
const selectedTags = ref<string[]>([]);
const selectedActivityIds = ref<string[]>([]);
const content = ref("");
const imageIds = ref<string[]>([]);
const fileList = ref<{ url: string; imageId?: string }[]>([]);
const uploading = ref(false);
const submitting = ref(false);
const generating = ref(false);
const recommendActivities = ref<ReviewRecommendActivity[]>([]);
const submitted = ref(false);
const shareHint = ref("");

const rewardHint = computed(() =>
  qualifiesReviewReward(content.value, imageIds.value.length)
    ? "已满足优质评价条件，提交后分享可领礼"
    : "领礼需：文案超过 20 字且至少 2 张图，提交后再分享",
);

onMounted(async () => {
  try {
    const [{ data: elig }, { data: acts }] = await Promise.all([
      fetchReviewEligibility(),
      fetchReviewRecommendActivities(),
    ]);
    if (elig.code === 200 && elig.data) {
      canReview.value = elig.data.canReview;
      blockReason.value = elig.data.reason || "";
    }
    if (acts.code === 200) recommendActivities.value = acts.data ?? [];
  } finally {
    loading.value = false;
  }
});

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag);
  if (idx >= 0) selectedTags.value.splice(idx, 1);
  else if (selectedTags.value.length < 5) selectedTags.value.push(tag);
}

function toggleActivity(id: string) {
  const idx = selectedActivityIds.value.indexOf(id);
  if (idx >= 0) selectedActivityIds.value.splice(idx, 1);
  else if (selectedActivityIds.value.length < REVIEW_RECOMMEND_ACTIVITY_MAX) {
    selectedActivityIds.value.push(id);
  }
}

async function afterRead() {
  uploading.value = true;
  try {
    const { data: res } = await uploadReviewImage();
    if (res.code !== 200 || !res.data?.imageId) {
      fileList.value = fileList.value.slice(0, -1);
      showToast("上传失败");
      return;
    }
    imageIds.value.push(res.data.imageId);
  } catch {
    fileList.value = fileList.value.slice(0, -1);
  } finally {
    uploading.value = false;
  }
}

async function onGenerateDraft() {
  generating.value = true;
  try {
    const { text } = await generateReviewDraft({
      rating: rating.value || undefined,
      tags: [...selectedTags.value],
      ticketName: scenicStore.currentScenicName,
    });
    content.value = text;
  } finally {
    generating.value = false;
  }
}

async function onSubmit() {
  if (rating.value < 1 || submitting.value) return;
  submitting.value = true;
  try {
    const { data: res } = await submitReview({
      rating: rating.value,
      tags: selectedTags.value,
      content: content.value.trim(),
      imageIds: imageIds.value,
      recommendedActivityIds: selectedActivityIds.value,
    });
    if (res.code !== 200 || !res.data) throw new Error(res.message || "提交失败");
    submitted.value = true;
    shareHint.value = res.data.shareHint || "";
    const memberId = authStore.memberId;
    const scenicId = scenicStore.currentScenicId;
    if (memberId && scenicId) {
      markScenicReviewedToday({ memberId, scenicId, dayKey: scenicDayKey() });
    }
    showToast("评价已提交，请回聊天页完成分享领礼");
  } catch (e) {
    showToast(e instanceof Error ? e.message : "提交失败");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="review-page">
    <van-nav-bar
      title="景区点评"
      left-arrow
      class="review-page__nav"
      @click-left="router.back()"
    />
    <div v-if="loading" class="review-page__body">加载中…</div>
    <div v-else-if="!canReview || submitted" class="review-page__body">
      <p>{{ submitted ? shareHint || "今日已点评" : blockReason || "当前不可点评" }}</p>
      <van-button type="primary" round block style="margin-top: 16px" @click="router.push('/chat')">
        返回聊天
      </van-button>
    </div>
    <div v-else class="review-page__body">
      <p class="review-page__label">整体满意度</p>
      <van-rate v-model="rating" :size="24" color="#ffd21e" />
      <p class="review-page__label">标签</p>
      <div class="review-page__tags">
        <van-tag
          v-for="tag in REVIEW_TAG_OPTIONS"
          :key="tag"
          :type="selectedTags.includes(tag) ? 'primary' : 'default'"
          @click="toggleTag(tag)"
        >
          {{ tag }}
        </van-tag>
      </div>
      <template v-if="recommendActivities.length">
        <p class="review-page__label">推荐游玩项目</p>
        <div class="review-page__tags">
          <van-tag
            v-for="act in recommendActivities"
            :key="act.activityId"
            :type="selectedActivityIds.includes(act.activityId) ? 'primary' : 'default'"
            @click="toggleActivity(act.activityId)"
          >
            <span v-if="act.hot">热门 </span>{{ act.name }}
          </van-tag>
        </div>
      </template>
      <div class="review-page__row">
        <p class="review-page__label">评价内容</p>
        <van-button size="mini" plain type="primary" round :loading="generating" @click="onGenerateDraft">
          帮我写评价
        </van-button>
      </div>
      <van-field
        v-model="content"
        type="textarea"
        rows="3"
        :maxlength="REVIEW_CONTENT_MAX"
        show-word-limit
      />
      <p class="review-page__label">图片</p>
      <van-uploader v-model="fileList" :max-count="6" :after-read="afterRead" />
      <p class="reward-hint">{{ rewardHint }}</p>
      <van-button
        type="primary"
        round
        block
        :disabled="rating < 1 || uploading"
        :loading="submitting"
        @click="onSubmit"
      >
        提交评价
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.review-page {
  min-height: 100vh;
  background: #f5f6f8;
}
.review-page__nav {
  position: sticky;
  top: 0;
  z-index: 10;
}
.review-page__body {
  padding: 16px;
}
.review-page__label {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 500;
}
.review-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.review-page__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.reward-hint {
  margin: 12px 0;
  font-size: 12px;
  color: #ff976a;
  line-height: 1.4;
}
</style>
