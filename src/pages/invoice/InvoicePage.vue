<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchOrders, applyInvoice } from '@/api/business'
import type { Order } from '@/types'

const router = useRouter()
const orders = ref<Order[]>([])

const invoiceable = computed(() => {
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return orders.value.filter((o) => {
    if (o.status !== 'completed' || o.invoiceStatus !== 'none') return false
    const completed = o.completedAt ? new Date(o.completedAt).getTime() : 0
    return completed > 0 && now - completed <= thirtyDays
  })
})

onMounted(async () => {
  const { data: res } = await fetchOrders()
  if (res.code === 200) orders.value = res.data
})

async function onApply(order: Order) {
  const { data: res } = await applyInvoice(order.orderId)
  if (res.code === 200) {
    router.push(`${res.data.redirectUrl}&amount=${order.totalAmount}`)
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="发票申请" left-arrow fixed placeholder @click-left="$router.back()" />
    <van-empty v-if="invoiceable.length === 0" description="暂无可开票订单" />
    <van-cell-group v-else inset class="list">
      <van-cell
        v-for="o in invoiceable"
        :key="o.orderId"
        :title="o.ticketName"
        :label="`${o.orderId} · 完成于 ${o.completedAt?.slice(0, 10)}`"
        :value="`¥${o.totalAmount}`"
        is-link
        @click="onApply(o)"
      >
        <template #right-icon>
          <van-button size="small" type="primary">申请开票</van-button>
        </template>
      </van-cell>
    </van-cell-group>
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
