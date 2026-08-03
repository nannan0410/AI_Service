<script setup lang="ts">
/**
 * 免费虚拟排队取号假页
 * 入口：对话 queue_recommend「立即取号排队」
 */
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showLoadingToast, showToast, closeToast } from "vant";
import {
  fetchVirtualQueueCatalog,
  takeVirtualQueueNumber,
} from "@/api/business";
import type { Activity } from "@/types";
import { formatVirtualQueueLine, activityToCardPayload } from "@/utils/activityDisplay";

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const inPark = ref(false);
const activity = ref<Activity | null>(null);
const submitting = ref(false);
const done = ref(false);
const resultText = ref("");

const activityId = computed(() => String(route.query.activityId ?? "").trim());

const card = computed(() =>
  activity.value
    ? activityToCardPayload(activity.value, { guideContext: "in_park" })
    : null,
);

onMounted(async () => {
  try {
    const { data: res } = await fetchVirtualQueueCatalog();
    if (res.code !== 200) return;
    inPark.value = res.data.inPark;
    activity.value =
      res.data.activities.find((item) => item.activityId === activityId.value) ??
      null;
  } finally {
    loading.value = false;
  }
});

async function onTake() {
  if (!activity.value) {
    showToast("项目不存在");
    return;
  }
  if (!inPark.value) {
    showToast("入园后才可取号");
    return;
  }
  if (!activity.value.virtualQueue?.isFree) {
    showToast("该项目需付费快速排队");
    return;
  }
  submitting.value = true;
  showLoadingToast({ message: "正在取号…", forbidClick: true, duration: 0 });
  try {
    const { data: res } = await takeVirtualQueueNumber(activity.value.activityId);
    closeToast();
    if (res.code !== 200) {
      showToast(res.message || "取号失败");
      return;
    }
    done.value = true;
    resultText.value = `取号成功：${res.data.activityName}，前方约 ${res.data.position} 人，预计等待 ${res.data.waitMinutes} 分钟`;
    showToast("取号成功");
  } catch {
    closeToast();
    showToast("取号失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

/** 登录成功默认落地页（首页） */
function goHome() {
  router.replace("/");
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="免费虚拟排队"
      left-arrow
      class="page__nav"
      @click-left="router.back()"
    />

    <van-notice-bar
      left-icon="info-o"
      text="演示版：在园游客可对免费项目取号，无需支付"
    />

    <van-loading v-if="loading" class="page__loading" vertical>
      加载中…
    </van-loading>

    <template v-else>
      <van-empty v-if="!activity" description="未找到该项目" />
      <van-empty
        v-else-if="!inPark"
        description="您当前不在园区内，入园后才可取号"
      />
      <template v-else>
        <div class="page__body">
          <div class="card">
            <h2 class="card__title">{{ activity.name }}</h2>
            <p class="card__meta">
              {{ activity.location }} · {{ activity.timeRange }}
            </p>
            <p v-if="activity.waitMinutes != null" class="card__queue">
              当前排队约 {{ activity.waitMinutes }} 分钟
            </p>
            <p v-if="card && formatVirtualQueueLine(card)" class="card__vq">
              {{ formatVirtualQueueLine(card) }}
            </p>
          </div>

          <div v-if="done" class="page__result-wrap">
            <p class="page__result">{{ resultText }}</p>
            <van-button
              type="primary"
              plain
              block
              round
              class="page__home-btn"
              @click="goHome"
            >
              返回个人中心
            </van-button>
          </div>
        </div>

        <div class="page__footer">
          <van-button
            type="primary"
            block
            round
            :loading="submitting"
            :disabled="done"
            @click="onTake"
          >
            {{ done ? "已取号" : "立即取号排队" }}
          </van-button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f7f8fa;
}

.page__nav {
  position: sticky;
  top: 0;
  z-index: 100;
}

.page__loading {
  margin-top: 48px;
}

.page__body {
  flex: 1;
  padding: 16px 16px 12px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.card__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.card__meta,
.card__queue,
.card__vq {
  margin: 4px 0 0;
  font-size: 13px;
  color: #666;
}

.card__vq {
  color: #07c160;
}

.page__result-wrap {
  margin-top: 16px;
}

.page__result {
  margin: 0;
  padding: 12px;
  background: #e8f8ef;
  border-radius: 8px;
  font-size: 14px;
  color: #07c160;
}

.page__home-btn {
  margin-top: 12px;
}

.page__footer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  width: 100%;
  margin-top: auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}
</style>
