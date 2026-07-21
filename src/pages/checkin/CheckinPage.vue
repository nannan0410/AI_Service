<script setup lang="ts">
/**
 * H5 园区打卡假页
 * 入口：对话「我要打卡」引导卡、快捷推荐「园区打卡」
 * 演示：Mock 用 currentLocation 与点位 location 匹配，模拟「附近识别」
 */
import { computed, onMounted, ref } from "vue";
import { showLoadingToast, showToast, closeToast } from "vant";
import { fetchCheckinSpots, submitCheckin } from "@/api/business";
import type { CheckinSpotView } from "@/types";
import { isNearCheckinSpot } from "@/utils/checkinLocation";

const loading = ref(true);
const inPark = ref(false);
const currentLocation = ref("");
const spots = ref<CheckinSpotView[]>([]);
const submittingId = ref<string | null>(null);

const checkedCount = computed(() => spots.value.filter((s) => s.checkedInToday).length);

const nearSpotIds = computed(() => {
  const loc = currentLocation.value.trim();
  if (!loc) return new Set<string>();
  return new Set(
    spots.value
      .filter((s) => isNearCheckinSpot(loc, s.location))
      .map((s) => s.spotId),
  );
});

onMounted(async () => {
  try {
    const { data: res } = await fetchCheckinSpots();
    if (res.code === 200) {
      inPark.value = res.data.inPark;
      currentLocation.value = res.data.currentLocation ?? "";
      spots.value = res.data.spots;
    }
  } finally {
    loading.value = false;
  }
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function onCheckin(spot: CheckinSpotView) {
  if (!inPark.value) {
    showToast("入园后才可打卡");
    return;
  }
  if (spot.checkedInToday) {
    showToast("该点位今日已打卡");
    return;
  }
  submittingId.value = spot.spotId;
  showLoadingToast({
    message: "正在识别您的位置…",
    forbidClick: true,
    duration: 0,
  });
  try {
    await delay(1100);
    const { data: res } = await submitCheckin(spot.spotId);
    closeToast();
    if (res.code !== 200) {
      showToast(res.message || "位置识别失败，打卡未成功");
      return;
    }
    spot.checkedInToday = true;
    const parts = [`打卡成功 +${res.data.rewardPoints} 积分`];
    if (res.data.coupon) {
      parts.push(`已发放「${res.data.coupon.title}」`);
    }
    showToast(parts.join("，"));
  } catch {
    closeToast();
    showToast("位置识别失败，请稍后重试");
  } finally {
    submittingId.value = null;
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="园区打卡"
      left-arrow
      class="checkin-page__nav"
      @click-left="$router.back()"
    />

    <van-notice-bar
      left-icon="info-o"
      text="演示版：需识别到您在该点位附近才能打卡；同点每日仅一次"
    />

    <van-loading v-if="loading" class="checkin-page__loading" vertical>
      加载打卡点…
    </van-loading>

    <template v-else>
      <van-empty
        v-if="!inPark"
        description="您当前不在园区内，入园后即可打卡领奖励"
      />

      <template v-else>
        <div class="checkin-page__summary">
          <p>
            Mock 当前位置：
            <strong>{{ currentLocation || "未知" }}</strong>
          </p>
          <p>今日已打卡 {{ checkedCount }} / {{ spots.length }} 个点位</p>
        </div>

        <van-cell-group inset>
          <van-cell
            v-for="spot in spots"
            :key="spot.spotId"
            :title="spot.name"
            :label="`${spot.location} · +${spot.rewardPoints} 积分${spot.rewardCouponProductId ? ' · 含小券' : ''}`"
          >
            <template #value>
              <div class="checkin-page__actions">
                <van-tag v-if="spot.checkedInToday" type="success" plain>已签到</van-tag>
                <template v-else>
                  <van-tag
                    v-if="nearSpotIds.has(spot.spotId)"
                    type="primary"
                    plain
                  >
                    附近
                  </van-tag>
                  <van-button
                    size="small"
                    type="primary"
                    round
                    :loading="submittingId === spot.spotId"
                    @click="onCheckin(spot)"
                  >
                    打卡
                  </van-button>
                </template>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}

.checkin-page__nav {
  position: sticky;
  top: 0;
  z-index: 100;
}

.checkin-page__loading {
  margin-top: 48px;
}

.checkin-page__summary {
  padding: 12px 20px 8px;
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
}

.checkin-page__summary p {
  margin: 0 0 4px;
}

.checkin-page__summary strong {
  color: #323233;
}

.checkin-page__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
</style>
