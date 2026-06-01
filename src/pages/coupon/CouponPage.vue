<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchCoupons } from '@/api/business'
import type { Coupon } from '@/types'

const activeTab = ref(0)
const coupons = ref<Coupon[]>([])

onMounted(async () => {
  const { data: res } = await fetchCoupons()
  if (res.code === 200) coupons.value = res.data
})

function filterCoupons(tab: number) {
  if (tab === 0) return coupons.value.filter((c) => c.status === 'available')
  if (tab === 1) return coupons.value.filter((c) => c.status === 'used')
  return coupons.value.filter((c) => c.status === 'expired')
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="优惠券" left-arrow fixed placeholder @click-left="$router.back()" />
    <van-tabs v-model:active="activeTab">
      <van-tab title="可用">
        <van-empty v-if="filterCoupons(0).length === 0" description="暂无可用优惠券" />
        <van-cell-group v-else inset class="list">
          <van-cell
            v-for="c in filterCoupons(0)"
            :key="c.couponId"
            :title="c.title"
            :label="c.condition || c.type"
            :value="c.type === 'dining' && c.value === 0 ? '折扣' : `¥${c.value}`"
          />
        </van-cell-group>
      </van-tab>
      <van-tab title="已使用">
        <van-empty description="暂无" />
      </van-tab>
      <van-tab title="将过期">
        <van-cell-group inset class="list">
          <van-cell
            v-for="c in filterCoupons(0)"
            :key="c.couponId"
            :title="c.title"
            :label="`有效期至 ${c.expireAt}`"
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
.list {
  margin-top: 12px;
}
</style>
