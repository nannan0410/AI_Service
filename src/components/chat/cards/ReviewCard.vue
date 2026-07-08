<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { showToast } from "vant";
import ChatCardShell from "./ChatCardShell.vue";
import type { ReviewCardPayload, ReviewSubmitDraft } from "@/types";
import {
  REVIEW_CONTENT_MAX,
  REVIEW_REWARD_MIN_CONTENT,
  REVIEW_REWARD_MIN_IMAGES,
  REVIEW_TAG_OPTIONS,
  qualifiesReviewReward,
} from "@/utils/reviewForm";
import { uploadReviewImage } from "@/api/business";

const props = defineProps<{
  payload: ReviewCardPayload;
  disabled?: boolean;
  submittedOrderIds?: string[];
}>();

const emit = defineEmits<{
  submit: [draft: ReviewSubmitDraft];
}>();

const selectedOrderId = ref("");
const rating = ref(0);
const selectedTags = ref<string[]>([]);
const content = ref("");
const imageIds = ref<string[]>([]);
const uploading = ref(false);
const submitting = ref(false);

const fileList = ref<{ url: string; imageId?: string }[]>([]);

watch(
  () => [props.payload, props.submittedOrderIds] as const,
  ([payload, submitted]) => {
    const available = payload.orders.filter(
      (o) => !(submitted ?? []).includes(o.orderId),
    );
    const preferred =
      payload.defaultOrderId && available.some((o) => o.orderId === payload.defaultOrderId)
        ? payload.defaultOrderId
        : available[0]?.orderId ?? "";
    selectedOrderId.value = preferred;
    rating.value = 0;
    selectedTags.value = [];
    content.value = "";
    imageIds.value = [];
    fileList.value = [];
    submitting.value = false;
  },
  { immediate: true },
);

const availableOrders = computed(() =>
  props.payload.orders.filter(
    (o) => !(props.submittedOrderIds ?? []).includes(o.orderId),
  ),
);

const selectedOrder = computed(() =>
  availableOrders.value.find((o) => o.orderId === selectedOrderId.value),
);

const showOrderPicker = computed(() => availableOrders.value.length > 1);

const rewardHint = computed(() => {
  const qualifies = qualifiesReviewReward(content.value, imageIds.value.length);
  if (qualifies) {
    return "已满足优质评价条件，提交后可获餐饮折扣券 + 当日停车券";
  }
  const needChars = Math.max(0, REVIEW_REWARD_MIN_CONTENT + 1 - content.value.trim().length);
  const needImages = Math.max(0, REVIEW_REWARD_MIN_IMAGES - imageIds.value.length);
  const parts: string[] = [];
  if (needChars > 0) parts.push(`再写 ${needChars} 字`);
  if (needImages > 0) parts.push(`再传 ${needImages} 张图`);
  if (!parts.length) return "";
  return `优质评价赠券：${parts.join("，")}（餐饮 3 个月 + 当日停车）`;
});

const canSubmit = computed(
  () =>
    !props.disabled &&
    !submitting.value &&
    !uploading.value &&
    !!selectedOrderId.value &&
    rating.value >= 1,
);

function toggleTag(tag: string) {
  if (props.disabled || submitting.value) return;
  const idx = selectedTags.value.indexOf(tag);
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1);
  } else if (selectedTags.value.length < 5) {
    selectedTags.value.push(tag);
  } else {
    showToast("最多选择 5 个标签");
  }
}

async function afterRead() {
  if (props.disabled || submitting.value) return;
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
  const removed = imageIds.value[detail.index];
  imageIds.value.splice(detail.index, 1);
  if (removed) {
    /* keep fileList in sync via v-model */
  }
}

function onSubmit() {
  if (!canSubmit.value || !selectedOrderId.value) return;
  if (content.value.length > REVIEW_CONTENT_MAX) {
    showToast(`评价内容不超过 ${REVIEW_CONTENT_MAX} 字`);
    return;
  }
  submitting.value = true;
  emit("submit", {
    orderId: selectedOrderId.value,
    rating: rating.value,
    tags: [...selectedTags.value],
    content: content.value.trim(),
    imageIds: [...imageIds.value],
  });
}

/** 父组件在 API 失败时调用，允许重试 */
function resetSubmitting() {
  submitting.value = false;
}

defineExpose({ resetSubmitting });
</script>

<template>
  <ChatCardShell title="服务点评" tag="游后服务" tag-color="#ff976a">
    <p v-if="!availableOrders.length" class="review-card__done">
      相关订单均已评价，感谢您的反馈。
    </p>
    <template v-else>
    <template v-if="showOrderPicker">
      <p class="review-card__label">选择要评价的订单</p>
      <van-radio-group v-model="selectedOrderId" :disabled="disabled || submitting">
        <div
          v-for="order in availableOrders"
          :key="order.orderId"
          class="review-card__order"
          :class="{ 'review-card__order--active': selectedOrderId === order.orderId }"
          @click="!disabled && !submitting && (selectedOrderId = order.orderId)"
        >
          <van-radio :name="order.orderId" />
          <div class="review-card__order-body">
            <div class="review-card__order-title">{{ order.ticketName }}</div>
            <div class="review-card__order-meta">
              {{ order.orderId }} · {{ order.completedAt?.slice(0, 10) ?? order.visitDate ?? "-" }}
            </div>
          </div>
          <span class="review-card__order-amount">¥{{ order.totalAmount }}</span>
        </div>
      </van-radio-group>
    </template>
    <template v-else-if="selectedOrder">
      <p class="review-card__order-single">
        {{ selectedOrder.ticketName }} · {{ selectedOrder.orderId }}
      </p>
    </template>

    <p class="review-card__label">整体满意度</p>
    <van-rate
      v-model="rating"
      :size="24"
      color="#ffd21e"
      void-icon="star"
      void-color="#eee"
      :readonly="disabled || submitting"
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

    <van-field
      v-model="content"
      class="review-card__field"
      rows="3"
      autosize
      type="textarea"
      :maxlength="REVIEW_CONTENT_MAX"
      show-word-limit
      placeholder="分享游玩体验（选填）"
      :readonly="disabled || submitting"
    />

    <p class="review-card__label">上传图片（选填，优质评价需 ≥2 张）</p>
    <van-uploader
      v-model="fileList"
      :max-count="6"
      :disabled="disabled || submitting"
      :deletable="!disabled && !submitting"
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
      {{ disabled ? "已提交评价" : "提交评价" }}
    </van-button>
    </template>
  </ChatCardShell>
</template>

<style scoped>
.review-card__label {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: #323233;
}

.review-card__label:first-child {
  margin-top: 0;
}

.review-card__order {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 10px;
  border: 1px solid #ebedf0;
  background: #fafafa;
  cursor: pointer;
}

.review-card__order--active {
  border-color: rgba(25, 137, 250, 0.45);
  background: rgba(25, 137, 250, 0.06);
}

.review-card__order-body {
  flex: 1;
  min-width: 0;
}

.review-card__order-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}

.review-card__order-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #969799;
}

.review-card__order-amount {
  font-size: 13px;
  font-weight: 600;
  color: #ee0a24;
  flex-shrink: 0;
}

.review-card__order-single {
  margin: 0 0 4px;
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
}

.review-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-card__tag {
  cursor: pointer;
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
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
}
</style>
