<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchOrders, applyInvoice } from "@/api/business";
import type { Order } from "@/types";
import { filterInvoiceableOrders } from "@/utils/invoiceableOrders";

const router = useRouter();
const orders = ref<Order[]>([]);

const invoiceable = computed(() => filterInvoiceableOrders(orders.value));

onMounted(async () => {
  const { data: res } = await fetchOrders();
  if (res.code === 200) orders.value = res.data;
});

async function onApply(order: Order) {
  const { data: res } = await applyInvoice(order.orderId);
  if (res.code === 200) {
    router.push(`${res.data.redirectUrl}&amount=${order.totalAmount}`);
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="发票申请"
      left-arrow
      fixed
      placeholder
      class="invoice-page__nav"
      @click-left="$router.back()"
    />
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
.invoice-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}
.list {
  margin-top: 12px;
}
</style>
