<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showToast } from "vant";
import { fetchOrders, submitReview, uploadReviewImage } from "@/api/business";
import type { Order } from "@/types";
import { filterReviewableOrders } from "@/utils/reviewableOrders";
import {
  REVIEW_CONTENT_MAX,
  REVIEW_TAG_OPTIONS,
  qualifiesReviewReward,
} from "@/utils/reviewForm";

const route = useRoute();
const router = useRouter();

const orders = ref<Order[]>([]);
const rating = ref(0);
const selectedTags = ref<string[]>([]);
const content = ref("");
const imageIds = ref<string[]>([]);
const fileList = ref<{ url: string }[]>([]);
const submitting = ref(false);
const uploading = ref(false);

const queryOrderId = computed(() => (route.query.orderId as string) || "");

const reviewable = computed(() =>
  [...filterReviewableOrders(orders.value)].sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return tb - ta;
  }),
);

const targetOrder = computed(() => {
  if (queryOrderId.value) {
    return reviewable.value.find((o) => o.orderId === queryOrderId.value) ?? null;
  }
  return reviewable.value[0] ?? null;
});

const rewardHint = computed(() =>
  qualifiesReviewReward(content.value, imageIds.value.length)
    ? "已满足优质评价条件，提交后可获餐饮折扣券 + 当日停车券"
    : "优质评价：文案超过 20 字且上传至少 2 张图片，可获餐饮券（3 个月）+ 当日停车券",
);

onMounted(async () => {
  const { data: res } = await fetchOrders();
  if (res.code === 200) orders.value = res.data;
});

function toggleTag(tag: string) {
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
  uploading.value = true;
  try {
    const { data: res } = await uploadReviewImage();
    if (res.code === 200 && res.data?.imageId) {
      imageIds.value.push(res.data.imageId);
    } else {
      fileList.value = fileList.value.slice(0, -1);
      showToast("图片上传失败");
    }
  } finally {
    uploading.value = false;
  }
}

function onDelete(_file: unknown, detail: { index: number }) {
  imageIds.value.splice(detail.index, 1);
}

async function onSubmit() {
  if (!targetOrder.value) {
    showToast("暂无可评价订单");
    return;
  }
  if (rating.value < 1) {
    showToast("请选择星级评分");
    return;
  }
  if (content.value.length > REVIEW_CONTENT_MAX) {
    showToast(`评价内容不超过 ${REVIEW_CONTENT_MAX} 字`);
    return;
  }

  submitting.value = true;
  try {
    const { data: res } = await submitReview({
      orderId: targetOrder.value.orderId,
      rating: rating.value,
      tags: selectedTags.value.length ? selectedTags.value : undefined,
      content: content.value.trim() || undefined,
      imageIds: imageIds.value.length ? imageIds.value : undefined,
    });
    if (res.code === 200) {
      showToast(
        res.data.rewardIssued ? "评价已提交，赠券已发放" : "评价已提交，感谢您的反馈",
      );
      router.replace("/orders?tab=1");
    } else {
      showToast(res.message || "提交失败");
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="服务点评"
      left-arrow
      fixed
      placeholder
      class="review-page__nav"
      @click-left="$router.back()"
    />
    <van-empty v-if="!targetOrder" description="暂无可评价订单" />
    <template v-else>
      <van-cell-group inset class="order-card">
        <van-cell
          :title="targetOrder.ticketName"
          :label="`${targetOrder.orderId} · 完成于 ${targetOrder.completedAt?.slice(0, 10) ?? '-'}`"
          :value="`¥${targetOrder.totalAmount}`"
        />
      </van-cell-group>

      <div class="section">
        <div class="section__title">整体满意度</div>
        <van-rate v-model="rating" :size="28" color="#ffd21e" void-icon="star" void-color="#eee" />
      </div>

      <div class="section">
        <div class="section__title">快捷标签（可选，最多 5 个）</div>
        <div class="tags">
          <van-tag
            v-for="tag in REVIEW_TAG_OPTIONS"
            :key="tag"
            :type="selectedTags.includes(tag) ? 'primary' : 'default'"
            size="medium"
            class="tag"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </van-tag>
        </div>
      </div>

      <van-cell-group inset class="form">
        <van-field
          v-model="content"
          rows="4"
          autosize
          type="textarea"
          :maxlength="REVIEW_CONTENT_MAX"
          show-word-limit
          placeholder="分享您的游玩体验（选填）"
        />
      </van-cell-group>

      <div class="section">
        <div class="section__title">上传图片（选填）</div>
        <van-uploader v-model="fileList" :max-count="6" :after-read="afterRead" @delete="onDelete" />
        <p class="reward-hint">{{ rewardHint }}</p>
      </div>

      <div class="actions">
        <van-button
          block
          type="primary"
          :loading="submitting || uploading"
          @click="onSubmit"
        >
          提交评价
        </van-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 24px;
}
.review-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}
.order-card {
  margin-top: 12px;
}
.section {
  margin: 16px 16px 0;
}
.section__title {
  font-size: 14px;
  color: #323233;
  margin-bottom: 10px;
  font-weight: 500;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag {
  cursor: pointer;
}
.form {
  margin-top: 16px;
}
.reward-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #ff976a;
  line-height: 1.45;
}
.actions {
  padding: 20px 16px 0;
}
</style>
