<script setup lang="ts">
/**
 * H5 提交订单假页
 *
 * 小程序等价路径：/pages/order/submit
 * 参数：draftId（orderDraftId）、productId、visitDate、票数（由草稿携带）
 * 支付：演示版 Mock；产品化接 wx.requestPayment
 */
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showToast } from "vant";
import {
  fetchCommonVisitors,
  fetchOrderDraft,
  submitOrder,
  updateOrderDraftVisitors,
} from "@/api/business";
import type { CommonVisitor, IdType, OrderDraft } from "@/types";
import { resolvePurchaseUnit } from "@/utils/ticketPriceDisplay";

const route = useRoute();
const router = useRouter();

const draftId = computed(() => String(route.query.draftId || route.query.orderDraftId || ""));
const draft = ref<OrderDraft | null>(null);
const visitors = ref<CommonVisitor[]>([]);
const selected = ref<string[]>([]);
const loading = ref(true);
const savingVisitors = ref(false);
const paying = ref(false);
const agreed = ref(false);
const loadError = ref("");

const idTypeLabel: Record<IdType, string> = {
  id_card: "身份证",
  passport: "护照",
  hk_macao_pass: "港澳通行证",
  taiwan_pass: "台湾通行证",
};

const requiredCount = computed(() => draft.value?.requiredVisitorCount ?? 0);

const originalAmount = computed(() => {
  if (!draft.value) return 0;
  return draft.value.originalAmount ?? draft.value.totalAmount + (draft.value.discountAmount ?? 0);
});

const purchaseDisplay = computed(() =>
  draft.value ? resolvePurchaseUnit(draft.value) : null,
);

const visitorsReady = computed(
  () => draft.value?.visitors.length === requiredCount.value && requiredCount.value > 0,
);

watch(
  () => draft.value,
  (value) => {
    selected.value = value?.visitors.map((item) => item.idNumber) ?? [];
  },
  { immediate: true },
);

onMounted(async () => {
  if (!draftId.value) {
    loadError.value = "缺少订单草稿 ID";
    loading.value = false;
    return;
  }
  await loadDraft();
});

async function loadDraft() {
  loading.value = true;
  loadError.value = "";
  try {
    const [{ data: draftRes }, { data: visitorRes }] = await Promise.all([
      fetchOrderDraft(draftId.value),
      fetchCommonVisitors(),
    ]);
    if (draftRes.code !== 200) {
      throw new Error(draftRes.message || "加载订单失败");
    }
    draft.value = draftRes.data;
    if (visitorRes.code === 200) {
      visitors.value = visitorRes.data;
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : "加载订单失败";
  } finally {
    loading.value = false;
  }
}

function maskId(idNumber: string) {
  if (idNumber.length <= 8) return idNumber;
  return `${idNumber.slice(0, 3)}****${idNumber.slice(-4)}`;
}

function toggle(idNumber: string) {
  if (paying.value || savingVisitors.value) return;
  const index = selected.value.indexOf(idNumber);
  if (index >= 0) {
    selected.value.splice(index, 1);
    return;
  }
  if (selected.value.length >= requiredCount.value) return;
  selected.value.push(idNumber);
}

async function saveVisitorsIfNeeded(): Promise<boolean> {
  if (!draft.value) return false;
  if (selected.value.length !== requiredCount.value) {
    showToast(`请选择 ${requiredCount.value} 位实名出行人`);
    return false;
  }

  if (visitorsReady.value) return true;

  savingVisitors.value = true;
  try {
    const { data: res } = await updateOrderDraftVisitors(draft.value.draftId, [...selected.value]);
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || "保存出行人失败");
    }
    draft.value = res.data;
    return true;
  } catch (e) {
    showToast(e instanceof Error ? e.message : "保存出行人失败");
    return false;
  } finally {
    savingVisitors.value = false;
  }
}

async function onPay() {
  if (!draft.value || !agreed.value || paying.value) return;
  const ready = await saveVisitorsIfNeeded();
  if (!ready) return;

  paying.value = true;
  try {
    const { data: res } = await submitOrder(draft.value!.draftId);
    if (res.code !== 200) {
      throw new Error(res.message || "支付失败");
    }

    showToast("支付成功");
    router.replace({ path: "/orders", query: { tab: "1" } });
  } catch (e) {
    showToast(e instanceof Error ? e.message : "支付失败");
  } finally {
    paying.value = false;
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="提交订单"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    />

    <van-skeleton v-if="loading" title :row="6" class="skeleton" />

    <van-empty v-else-if="loadError" :description="loadError">
      <van-button round type="primary" size="small" @click="loadDraft">
        重试
      </van-button>
    </van-empty>

    <template v-else-if="draft">
      <section class="card">
        <h2 class="card__title">{{ draft.ticketName }}</h2>
        <p v-if="draft.visitDate" class="card__meta">计划 {{ draft.visitDate }} 出行</p>
        <p class="card__meta">
          {{ draft.quantity.adult }} 成人
          <template v-if="draft.quantity.child">
            · {{ draft.quantity.child }} 儿童
          </template>
          · 共 {{ requiredCount }} 人
        </p>
        <p v-if="purchaseDisplay" class="card__unit">
          单价 ¥{{ purchaseDisplay.unitPrice }} × {{ purchaseDisplay.purchaseCount }}
          {{ purchaseDisplay.purchaseUnit }}
        </p>
      </section>

      <section class="card">
        <h3 class="section-title">选择实名出行人</h3>
        <p class="section-hint">
          需选择 {{ requiredCount }} 位出行人（已选 {{ selected.length }}/{{ requiredCount }}）
        </p>
        <ul class="visitor-list">
          <li
            v-for="visitor in visitors"
            :key="visitor.idNumber"
            class="visitor-item"
            :class="{ 'visitor-item--selected': selected.includes(visitor.idNumber) }"
            @click="toggle(visitor.idNumber)"
          >
            <span class="visitor-item__check">
              {{ selected.includes(visitor.idNumber) ? "✓" : "" }}
            </span>
            <div class="visitor-item__info">
              <strong>{{ visitor.name }}</strong>
              <span>{{ idTypeLabel[visitor.idType] }} · {{ maskId(visitor.idNumber) }}</span>
            </div>
          </li>
        </ul>
      </section>

      <section class="card">
        <h3 class="section-title">费用明细</h3>
        <div class="fee-row">
          <span>商品金额</span>
          <span>¥{{ originalAmount }}</span>
        </div>
        <div v-if="draft.discountAmount" class="fee-row fee-row--discount">
          <span>优惠券抵扣</span>
          <span>-¥{{ draft.discountAmount }}</span>
        </div>
        <div class="fee-row fee-row--total">
          <span>应付金额</span>
          <strong>¥{{ draft.totalAmount }}</strong>
        </div>
      </section>

      <section class="terms">
        <van-checkbox v-model="agreed" icon-size="16px">
          我已阅读并同意《购票须知》与《退改规则》（演示版）
        </van-checkbox>
      </section>

      <footer class="footer">
        <div class="footer__amount">
          <span>合计</span>
          <strong>¥{{ draft.totalAmount }}</strong>
        </div>
        <van-button
          type="primary"
          round
          class="footer__btn"
          :disabled="!agreed || selected.length !== requiredCount"
          :loading="paying || savingVisitors"
          @click="onPay"
        >
          确认并支付
        </van-button>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: 88px;
  background: #f7f8fa;
}

.skeleton {
  padding: 16px;
}

.card {
  margin: 12px;
  padding: 14px;
  border-radius: 12px;
  background: #fff;
}

.card__title {
  margin: 0 0 6px;
  font-size: 17px;
  color: #323233;
}

.card__meta {
  margin: 0 0 4px;
  font-size: 13px;
  color: #646566;
}

.card__unit {
  margin: 4px 0 0;
  font-size: 13px;
  color: #323233;
}

.section-title {
  margin: 0 0 6px;
  font-size: 14px;
  color: #323233;
}

.section-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #969799;
}

.visitor-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.visitor-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin-bottom: 6px;
  border-radius: 8px;
  border: 1px solid #ebedf0;
  cursor: pointer;
}

.visitor-item--selected {
  border-color: var(--chat-primary, #07c160);
  background: var(--chat-primary-light, #e8f8ef);
}

.visitor-item__check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid #dcdee0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--chat-primary, #07c160);
  flex-shrink: 0;
}

.visitor-item--selected .visitor-item__check {
  border-color: var(--chat-primary, #07c160);
  background: #fff;
}

.visitor-item__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #646566;
}

.visitor-item__info strong {
  font-size: 14px;
  color: #323233;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: #646566;
}

.fee-row--discount {
  color: var(--chat-primary, #07c160);
}

.fee-row--total {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed #ebedf0;
  font-size: 14px;
  color: #323233;
}

.fee-row--total strong {
  font-size: 20px;
  color: #ee0a24;
}

.terms {
  margin: 0 12px 12px;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  font-size: 12px;
  color: #646566;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.footer__amount {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: #969799;
}

.footer__amount strong {
  font-size: 20px;
  color: #ee0a24;
}

.footer__btn {
  min-width: 120px;
  background: var(--chat-primary, #07c160);
  border-color: var(--chat-primary, #07c160);
}
</style>
