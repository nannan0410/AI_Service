<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchCoupons } from "@/api/business";
import type { Coupon } from "@/types";

const EXPIRING_SOON_DAYS = 30;

const activeTab = ref(0);
const coupons = ref<Coupon[]>([]);

const availableCoupons = computed(() =>
  coupons.value.filter((item) => item.status === "available")
);
const usedCoupons = computed(() =>
  coupons.value.filter((item) => item.status === "used")
);
const expiringSoonCoupons = computed(() =>
  coupons.value.filter((item) => isExpiringSoon(item))
);

onMounted(async () => {
  const { data: res } = await fetchCoupons();
  if (res.code === 200) coupons.value = res.data;
});

function isExpiringSoon(coupon: Coupon): boolean {
  if (coupon.status !== "available") return false;
  const expireAt = new Date(coupon.expireAt);
  if (Number.isNaN(expireAt.getTime())) return false;

  const now = new Date();
  const diffMs = expireAt.getTime() - now.getTime();
  const withinMs = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= withinMs;
}

function formatValue(coupon: Coupon) {
  if (coupon.type === "express") {
    return coupon.redeemActivityName
      ? `兑换 ${coupon.redeemActivityName}`
      : "兑换 1 次";
  }
  if (coupon.type === "dining" && coupon.value === 0) return "折扣";
  if (coupon.type === "parking") return `¥${coupon.value}`;
  return `¥${coupon.value}`;
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="优惠券"
      left-arrow
      fixed
      placeholder
      class="coupon-page__nav"
      @click-left="$router.back()"
    />

    <van-tabs v-model:active="activeTab">
      <van-tab title="可用">
        <van-empty
          v-if="availableCoupons.length === 0"
          description="暂无可用优惠券"
        />
        <van-cell-group v-else inset class="list">
          <van-cell
            v-for="coupon in availableCoupons"
            :key="coupon.couponId"
            :title="coupon.title"
            :label="`${coupon.condition || coupon.type} · 有效期至 ${coupon.expireAt}`"
            :value="formatValue(coupon)"
          />
        </van-cell-group>
      </van-tab>

      <van-tab title="已使用">
        <van-empty
          v-if="usedCoupons.length === 0"
          description="暂无已使用优惠券"
        />
        <van-cell-group v-else inset class="list">
          <van-cell
            v-for="coupon in usedCoupons"
            :key="coupon.couponId"
            :title="coupon.title"
            :label="coupon.condition || coupon.type"
            :value="formatValue(coupon)"
          />
        </van-cell-group>
      </van-tab>

      <van-tab title="将过期">
        <van-empty
          v-if="expiringSoonCoupons.length === 0"
          :description="`近 ${EXPIRING_SOON_DAYS} 天内暂无将过期券`"
        />
        <van-cell-group v-else inset class="list">
          <van-cell
            v-for="coupon in expiringSoonCoupons"
            :key="coupon.couponId"
            :title="coupon.title"
            :label="`有效期至 ${coupon.expireAt}`"
            :value="formatValue(coupon)"
          />
        </van-cell-group>
      </van-tab>
    </van-tabs>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
}

.coupon-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}

.list {
  margin-top: 12px;
}
</style>
