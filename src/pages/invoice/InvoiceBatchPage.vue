<script setup lang="ts">
/**
 * H5 批量开票假页
 *
 * 小程序等价路径：/pages/invoice/batch
 * 入口：对话「开发票」引导卡「立即开票」、或快捷推荐发「开发票」后再跳转
 * （不再由 RecommendEntry 直跳本页）
 */
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { showToast } from "vant";
import { applyBatchInvoice, fetchOrders } from "@/api/business";
import type { Order } from "@/types";
import { filterInvoiceableOrders, sumOrderAmounts } from "@/utils/invoiceableOrders";

const router = useRouter();
const orders = ref<Order[]>([]);
const selected = ref<string[]>([]);
const loading = ref(true);
const submitting = ref(false);

const invoiceable = computed(() => filterInvoiceableOrders(orders.value));

const selectedOrders = computed(() =>
  invoiceable.value.filter((order) => selected.value.includes(order.orderId)),
);

const totalAmount = computed(() => sumOrderAmounts(selectedOrders.value));

const allSelected = computed({
  get: () =>
    invoiceable.value.length > 0 && selected.value.length === invoiceable.value.length,
  set: (checked: boolean) => {
    selected.value = checked ? invoiceable.value.map((order) => order.orderId) : [];
  },
});

onMounted(async () => {
  try {
    const { data: res } = await fetchOrders();
    if (res.code === 200) orders.value = res.data;
  } finally {
    loading.value = false;
  }
});

function toggleOrder(orderId: string, checked: boolean) {
  if (checked) {
    if (!selected.value.includes(orderId)) {
      selected.value = [...selected.value, orderId];
    }
    return;
  }
  selected.value = selected.value.filter((id) => id !== orderId);
}

function toggleRow(orderId: string) {
  const checked = selected.value.includes(orderId);
  toggleOrder(orderId, !checked);
}

async function onSubmit() {
  if (selected.value.length === 0) {
    showToast("请至少选择一笔订单");
    return;
  }
  submitting.value = true;
  try {
    const { data: res } = await applyBatchInvoice(selected.value);
    if (res.code !== 200) {
      showToast(res.message || "提交失败");
      return;
    }
    showToast(`已提交 ${res.data.appliedCount} 笔开票申请`);
    router.replace("/invoice");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="批量开发票"
      left-arrow
      class="invoice-batch-page__nav"
      @click-left="$router.back()"
    />

    <van-notice-bar
      left-icon="info-o"
      text="演示版：勾选多笔已完成订单，一次性提交开票申请（Mock）"
    />

    <van-loading v-if="loading" class="invoice-batch-page__loading" vertical>
      加载订单…
    </van-loading>

    <van-empty v-else-if="invoiceable.length === 0" description="暂无可批量开票的订单" />

    <template v-else>
      <div class="invoice-batch-page__body">
        <div class="invoice-batch-page__toolbar">
          <van-checkbox v-model="allSelected">全选（{{ invoiceable.length }} 笔）</van-checkbox>
          <span class="invoice-batch-page__hint">仅展示 30 天内已完成且未开票订单</span>
        </div>

        <van-checkbox-group v-model="selected">
          <van-cell-group inset>
            <van-cell
              v-for="order in invoiceable"
              :key="order.orderId"
              clickable
              @click="toggleRow(order.orderId)"
            >
              <template #title>
                <div class="invoice-batch-page__row">
                  <van-checkbox
                    :name="order.orderId"
                    @click.stop
                  />
                  <div class="invoice-batch-page__info">
                    <div class="invoice-batch-page__name">{{ order.ticketName }}</div>
                    <div class="invoice-batch-page__meta">
                      {{ order.orderId }} · 完成于 {{ order.completedAt?.slice(0, 10) }}
                    </div>
                  </div>
                  <div class="invoice-batch-page__amount">¥{{ order.totalAmount }}</div>
                </div>
              </template>
            </van-cell>
          </van-cell-group>
        </van-checkbox-group>
      </div>

      <div class="invoice-batch-page__footer">
        <div class="invoice-batch-page__summary">
          已选 {{ selectedOrders.length }} 笔，合计
          <strong>¥{{ totalAmount }}</strong>
        </div>
        <van-button
          type="primary"
          block
          round
          :loading="submitting"
          :disabled="selectedOrders.length === 0"
          @click="onSubmit"
        >
          提交批量开票
        </van-button>
      </div>
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

.invoice-batch-page__nav {
  position: sticky;
  top: 0;
  z-index: 100;
}

.invoice-batch-page__loading {
  margin-top: 48px;
}

.invoice-batch-page__body {
  flex: 1;
  padding-bottom: 12px;
}

.invoice-batch-page__toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px 0;
  font-size: 14px;
}

.invoice-batch-page__hint {
  font-size: 12px;
  color: #969799;
}

.invoice-batch-page__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.invoice-batch-page__info {
  flex: 1;
  min-width: 0;
}

.invoice-batch-page__name {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}

.invoice-batch-page__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #969799;
  word-break: break-all;
}

.invoice-batch-page__amount {
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ee0a24;
}

.invoice-batch-page__footer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  width: 100%;
  margin-top: auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.invoice-batch-page__summary {
  margin-bottom: 10px;
  font-size: 14px;
  color: #646566;
}

.invoice-batch-page__summary strong {
  color: #ee0a24;
  font-size: 18px;
}
</style>
