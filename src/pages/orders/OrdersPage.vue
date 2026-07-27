<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { fetchOrders } from "@/api/business";
import { listOrderTagsForOrder } from "@/utils/profileTags";
import type { Order, OrderSource, ProfileTag } from "@/types";

const route = useRoute();
const activeTab = ref(0);
const orders = ref<Order[]>([]);

const statusMap: Record<Order["status"], string> = {
  pending: "待支付",
  paid: "待出行",
  completed: "已完成",
  refunded: "已退款",
};

const sourceMap: Record<OrderSource, { label: string; color: string }> = {
  self: { label: "自营", color: "#07c160" },
  ota: { label: "OTA", color: "#ff976a" },
  ta: { label: "TA", color: "#7232dd" },
};

onMounted(async () => {
  const tab = String(route.query.tab ?? "");
  if (tab === "1" || tab === "paid" || tab === "travel") {
    activeTab.value = 1;
  } else if (tab === "2" || tab === "refunded") {
    activeTab.value = 2;
  } else if (tab === "0" || tab === "pending") {
    activeTab.value = 0;
  }

  const { data: res } = await fetchOrders();
  if (res.code === 200) orders.value = res.data;
});

const filteredOrders = computed(() => {
  if (activeTab.value === 0) {
    return orders.value.filter((item) => item.status === "pending");
  }
  if (activeTab.value === 1) {
    return orders.value.filter(
      (item) => item.status === "paid" || item.status === "completed"
    );
  }
  return orders.value.filter((item) => item.status === "refunded");
});

function isThirdParty(order: Order) {
  return order.source === "ota" || order.source === "ta";
}

function sourceInfo(order: Order) {
  return sourceMap[order.source ?? "self"];
}

function quantityLabel(order: Order) {
  const { adult, child } = order.quantity;
  return child > 0 ? `${adult} 成人 ${child} 儿童` : `${adult} 张`;
}

function orderTags(order: Order): ProfileTag[] {
  return listOrderTagsForOrder(order);
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
      <van-tab title="待支付" />
      <van-tab title="待出行/已完成" />
      <van-tab title="已退款" />
    </van-tabs>

    <van-empty
      v-if="filteredOrders.length === 0"
      :description="
        activeTab === 0
          ? '暂无待支付订单'
          : activeTab === 2
            ? '暂无退款订单'
            : '暂无订单'
      "
    />

    <div v-else class="list">
      <article
        v-for="order in filteredOrders"
        :key="order.orderId"
        class="order-item"
      >
        <div class="order-item__head">
          <span
            class="order-item__source"
            :style="{ color: sourceInfo(order).color }"
          >
            {{ sourceInfo(order).label }}
          </span>
          <span class="order-item__status">{{ statusMap[order.status] }}</span>
        </div>

        <h3 class="order-item__title">{{ order.ticketName }}</h3>
        <p class="order-item__meta">
          {{ order.orderId }} · {{ quantityLabel(order) }}
          <template v-if="order.visitDate"> · {{ order.visitDate }} 出行</template>
        </p>

        <div v-if="orderTags(order).length" class="order-item__tags">
          <span
            v-for="tag in orderTags(order)"
            :key="tag.tagId"
            class="order-item__tag"
          >
            {{ tag.name }}
          </span>
        </div>

        <div class="order-item__footer">
          <strong class="order-item__amount">¥{{ order.totalAmount }}</strong>
        </div>

        <p v-if="isThirdParty(order)" class="order-item__hint">
          第三方订单如需改签/退票请联系购买平台
        </p>
      </article>
    </div>
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
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-item {
  padding: 14px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
}

.order-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.order-item__source {
  font-size: 12px;
  font-weight: 600;
}

.order-item__status {
  font-size: 12px;
  color: #969799;
}

.order-item__title {
  margin: 0 0 4px;
  font-size: 16px;
  color: #323233;
}

.order-item__meta {
  margin: 0 0 10px;
  font-size: 12px;
  color: #969799;
}

.order-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: -4px 0 10px;
}

.order-item__tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #07c160;
  background: rgba(7, 193, 96, 0.1);
}

.order-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-item__amount {
  font-size: 18px;
  color: #ee0a24;
}

.order-item__hint {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px dashed #ebedf0;
  font-size: 12px;
  color: #969799;
  line-height: 1.4;
}
</style>
