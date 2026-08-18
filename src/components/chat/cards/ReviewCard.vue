<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { showToast } from "vant";
import ChatCardShell from "./ChatCardShell.vue";
import type { ReviewCardPayload, ReviewShareChannel, ReviewSubmitDraft } from "@/types";
import {
  REVIEW_CONTENT_MAX,
  REVIEW_REWARD_MIN_CONTENT,
  REVIEW_REWARD_MIN_IMAGES,
  REVIEW_TAG_OPTIONS,
  qualifiesReviewReward,
} from "@/utils/reviewForm";
import {
  REVIEW_RECOMMEND_ACTIVITY_MAX,
  REVIEW_SHARE_CHANNELS,
} from "@/utils/scenicReviewAccess";
import { generateReviewDraft } from "@/utils/generateReviewDraft";
import { uploadReviewImage } from "@/api/business";

const props = defineProps<{
  payload: ReviewCardPayload;
  disabled?: boolean;
  /** 提交成功后由父组件回填 */
  completed?: {
    reviewId: string;
    shareHint?: string;
    sharedChannels?: ReviewShareChannel[];
  } | null;
}>();

const emit = defineEmits<{
  submit: [draft: ReviewSubmitDraft];
  share: [channel: ReviewShareChannel];
}>();

const rating = ref(0);
const selectedTags = ref<string[]>([]);
const selectedActivityIds = ref<string[]>([]);
const content = ref("");
const imageIds = ref<string[]>([]);
const uploading = ref(false);
const submitting = ref(false);
const generating = ref(false);
const shareSheetVisible = ref(false);

const fileList = ref<{ url: string; imageId?: string }[]>([]);

watch(
  () => props.payload.cardId,
  () => {
    rating.value = 0;
    selectedTags.value = [];
    selectedActivityIds.value = [];
    content.value = "";
    imageIds.value = [];
    fileList.value = [];
    submitting.value = false;
    shareSheetVisible.value = false;
  },
  { immediate: true },
);

const recommendActivities = computed(() => props.payload.recommendActivities ?? []);
const showRecommendProjects = computed(() => recommendActivities.value.length > 0);

const rewardHint = computed(() => {
  const qualifies = qualifiesReviewReward(content.value, imageIds.value.length);
  if (qualifies) {
    return "已满足优质评价条件：提交后分享到社交平台可领餐饮折扣券 + 当日停车券（每日限领一次）";
  }
  const needChars = Math.max(
    0,
    REVIEW_REWARD_MIN_CONTENT + 1 - content.value.trim().length,
  );
  const needImages = Math.max(0, REVIEW_REWARD_MIN_IMAGES - imageIds.value.length);
  const parts: string[] = [];
  if (needChars > 0) parts.push(`再写 ${needChars} 字`);
  if (needImages > 0) parts.push(`再传 ${needImages} 张图`);
  if (!parts.length) return "";
  return `领礼需优质评价：${parts.join("，")}，提交后再分享`;
});

const formLocked = computed(
  () => Boolean(props.disabled || props.completed || submitting.value),
);

const canSubmit = computed(
  () => !formLocked.value && !uploading.value && rating.value >= 1,
);

const sharedSet = computed(() => new Set(props.completed?.sharedChannels ?? []));

function toggleTag(tag: string) {
  if (formLocked.value) return;
  const idx = selectedTags.value.indexOf(tag);
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1);
  } else if (selectedTags.value.length < 5) {
    selectedTags.value.push(tag);
  } else {
    showToast("最多选择 5 个标签");
  }
}

function toggleActivity(activityId: string) {
  if (formLocked.value) return;
  const idx = selectedActivityIds.value.indexOf(activityId);
  if (idx >= 0) {
    selectedActivityIds.value.splice(idx, 1);
  } else if (selectedActivityIds.value.length < REVIEW_RECOMMEND_ACTIVITY_MAX) {
    selectedActivityIds.value.push(activityId);
  } else {
    showToast(`最多推荐 ${REVIEW_RECOMMEND_ACTIVITY_MAX} 个项目`);
  }
}

async function afterRead() {
  if (formLocked.value) return;
  uploading.value = true;
  try {
    const { data: res } = await uploadReviewImage();
    if (res.code !== 200 || !res.data?.imageId) {
      fileList.value = fileList.value.slice(0, -1);
      showToast("图片上传失败");
      return;
    }
    const imageId = res.data.imageId;
    imageIds.value.push(imageId);
    const last = fileList.value[fileList.value.length - 1];
    if (last) last.imageId = imageId;
  } catch {
    fileList.value = fileList.value.slice(0, -1);
    showToast("图片上传失败");
  } finally {
    uploading.value = false;
  }
}

function onDelete(_file: unknown, detail: { index: number }) {
  imageIds.value.splice(detail.index, 1);
}

async function onGenerateDraft() {
  if (formLocked.value || generating.value) return;
  generating.value = true;
  try {
    const pickedNames = recommendActivities.value
      .filter((a) => selectedActivityIds.value.includes(a.activityId))
      .map((a) => a.name);
    const { text, source } = await generateReviewDraft({
      rating: rating.value || undefined,
      tags: [...selectedTags.value, ...pickedNames],
      ticketName: props.payload.scenicName,
    });
    content.value = text;
    showToast(
      source === "llm"
        ? "已生成评价草稿，请按真实体验修改后提交"
        : "已生成评价草稿（离线模板），请按真实体验修改后提交",
    );
  } finally {
    generating.value = false;
  }
}

function onSubmit() {
  if (!canSubmit.value) return;
  if (content.value.length > REVIEW_CONTENT_MAX) {
    showToast(`评价内容不超过 ${REVIEW_CONTENT_MAX} 字`);
    return;
  }
  submitting.value = true;
  emit("submit", {
    rating: rating.value,
    tags: [...selectedTags.value],
    content: content.value.trim(),
    imageIds: [...imageIds.value],
    recommendedActivityIds: [...selectedActivityIds.value],
  });
}

function resetSubmitting() {
  submitting.value = false;
}

function openShareSheet() {
  if (!props.completed?.reviewId) return;
  shareSheetVisible.value = true;
}

function onPickChannel(channel: ReviewShareChannel) {
  if (sharedSet.value.has(channel)) {
    showToast("今日已在该平台分享过");
    return;
  }
  shareSheetVisible.value = false;
  emit("share", channel);
}

/** ActionSheet @select 回调（模板内勿写 TS 类型注解，否则 vue-tsc 报错） */
function onSelectShareAction(action: { value?: ReviewShareChannel }) {
  if (action.value) onPickChannel(action.value);
}

defineExpose({ resetSubmitting });
</script>

<template>
  <ChatCardShell title="景区点评" tag="游园日" tag-color="#ff976a">
    <template v-if="completed">
      <p class="review-card__done">评价已提交，感谢您的反馈！</p>
      <p v-if="completed.shareHint" class="review-card__share-hint">
        {{ completed.shareHint }}
      </p>
      <p class="review-card__share-lead">
        可以把精彩瞬间同步分享到其他 App，让更多朋友看到～
      </p>
      <van-button
        type="primary"
        size="small"
        round
        block
        class="review-card__submit"
        @click="openShareSheet"
      >
        分享到社交平台
      </van-button>
    </template>

    <template v-else>
      <p v-if="payload.scenicName" class="review-card__scenic">
        {{ payload.scenicName }} · 今日游园体验
      </p>

      <p class="review-card__label">整体满意度</p>
      <van-rate
        v-model="rating"
        :size="24"
        color="#ffd21e"
        void-icon="star"
        void-color="#eee"
        :readonly="formLocked"
      />

      <p class="review-card__label">快捷标签（可选，最多 5 个）</p>
      <div class="review-card__tags">
        <van-tag
          v-for="tag in REVIEW_TAG_OPTIONS"
          :key="tag"
          :type="selectedTags.includes(tag) ? 'primary' : 'default'"
          size="medium"
          class="review-card__tag"
          @click="toggleTag(tag)"
        >
          {{ tag }}
        </van-tag>
      </div>

      <template v-if="showRecommendProjects">
        <p class="review-card__label">推荐游玩项目（可选）</p>
        <div class="review-card__tags">
          <van-tag
            v-for="act in recommendActivities"
            :key="act.activityId"
            :type="selectedActivityIds.includes(act.activityId) ? 'primary' : 'default'"
            size="medium"
            class="review-card__tag"
            @click="toggleActivity(act.activityId)"
          >
            <span v-if="act.hot" class="review-card__hot">热门</span>
            {{ act.name }}
          </van-tag>
        </div>
      </template>

      <div class="review-card__content-head">
        <p class="review-card__label review-card__label--inline">评价内容</p>
        <van-button
          size="mini"
          type="primary"
          plain
          round
          class="review-card__ai-btn"
          :disabled="formLocked"
          :loading="generating"
          @click="onGenerateDraft"
        >
          帮我写评价
        </van-button>
      </div>
      <van-field
        v-model="content"
        class="review-card__field"
        rows="3"
        autosize
        type="textarea"
        :maxlength="REVIEW_CONTENT_MAX"
        show-word-limit
        placeholder="分享游玩体验（选填），可点「帮我写评价」生成约 50 字草稿"
        :readonly="formLocked || generating"
      />
      <p class="review-card__ai-hint">AI 草稿仅供参考，请按真实体验修改后再提交</p>

      <p class="review-card__label">上传图片（选填，领礼需 ≥2 张）</p>
      <van-uploader
        v-model="fileList"
        :max-count="6"
        :disabled="formLocked"
        :deletable="!formLocked"
        :after-read="afterRead"
        @delete="onDelete"
      />

      <p v-if="rewardHint" class="review-card__reward-hint">{{ rewardHint }}</p>

      <van-button
        type="primary"
        size="small"
        round
        block
        class="review-card__submit"
        :disabled="!canSubmit"
        :loading="submitting"
        @click="onSubmit"
      >
        提交评价
      </van-button>
    </template>

    <van-action-sheet
      v-model:show="shareSheetVisible"
      :actions="
        REVIEW_SHARE_CHANNELS.map((c) => ({
          name: sharedSet.has(c.key) ? `${c.label}（今日已分享）` : c.label,
          value: c.key,
          disabled: sharedSet.has(c.key),
        }))
      "
      cancel-text="取消"
      close-on-click-action
      @select="onSelectShareAction"
    />
  </ChatCardShell>
</template>

<style scoped>
.review-card__scenic {
  margin: 0 0 4px;
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
}

.review-card__label {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: #323233;
}

.review-card__label:first-child {
  margin-top: 0;
}

.review-card__label--inline {
  margin: 0;
}

.review-card__content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 12px 0 8px;
}

.review-card__ai-btn {
  flex-shrink: 0;
}

.review-card__ai-hint {
  margin: 6px 0 0;
  font-size: 11px;
  color: #969799;
  line-height: 1.4;
}

.review-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-card__tag {
  cursor: pointer;
}

.review-card__hot {
  margin-right: 4px;
  color: #ee0a24;
  font-size: 11px;
}

.review-card__field {
  margin: 12px 0 0;
  padding: 0;
  background: transparent;
}

.review-card__field:deep(.van-field__control) {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 8px 10px;
}

.review-card__reward-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #ff976a;
  line-height: 1.45;
}

.review-card__submit {
  margin-top: 14px;
}

.review-card__done {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  line-height: 1.5;
}

.review-card__share-hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: #646566;
  line-height: 1.45;
}

.review-card__share-lead {
  margin: 10px 0 0;
  font-size: 13px;
  color: #323233;
  line-height: 1.45;
}
</style>
