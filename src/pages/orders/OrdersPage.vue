<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchOrders } from "@/api/business";
import type { Order } from "@/types";

const activeTab = ref(0);
const orders = ref<Order[]>([]);

const statusMap: Record<string, string> = {
  pending: "待支付",
  paid: "待游玩",
  completed: "已完成",
  refunded: "已退款",
};

onMounted(async () => {
  const { data: res } = await fetchOrders();
  if (res.code === 200) orders.value = res.data;
});

function filterByTab(tab: number) {
  if (tab === 0) return orders.value.filter((o) => o.status === "pending");
  if (tab === 1)
    return orders.value.filter(
      (o) => o.status === "paid" || o.status === "completed"
    );
  return orders.value.filter((o) => o.status === "refunded");
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="我的订单"
      left-arrow
      fixed
      placeholder
      class="order-page__nav"
      @click-left="$router.back()"
    />
    <van-tabs v-model:active="activeTab">
      <van-tab title="待支付">
        <van-empty
          v-if="filterByTab(0).length === 0"
          description="暂无待支付订单"
        />
        <van-cell-group v-else inset class="list">
          <van-cell
            v-for="o in filterByTab(0)"
            :key="o.orderId"
            :title="o.ticketName"
            :label="o.orderId"
            :value="`¥${o.totalAmount}`"
          />
        </van-cell-group>
      </van-tab>
      <van-tab title="已完成">
        <van-empty v-if="filterByTab(1).length === 0" description="暂无订单" />
        <van-cell-group v-else inset class="list">
          <van-cell
            v-for="o in filterByTab(1)"
            :key="o.orderId"
            :title="o.ticketName"
            :label="`${o.orderId} · ${statusMap[o.status]}`"
            :value="`¥${o.totalAmount}`"
          />
        </van-cell-group>
      </van-tab>
      <van-tab title="已退款">
        <van-empty
          v-if="filterByTab(2).length === 0"
          description="暂无退款订单"
        />
        <van-cell-group v-else inset class="list">
          <van-cell
            v-for="o in filterByTab(2)"
            :key="o.orderId"
            :title="o.ticketName"
            :value="`¥${o.totalAmount}`"
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
.order-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}
.list {
  margin-top: 12px;
}
</style>
