<script setup lang="ts">
import { ref } from "vue";
import { showToast } from "vant";
import { ocrReceipt } from "@/api/business";
import { useAuthStore } from "@/store/authStore";
import {
  getUserStorage,
  setUserStorage,
  STORAGE_SUFFIX,
} from "@/utils/storage";
import type { ReceiptOcrResult } from "@/types";

const authStore = useAuthStore();
const fileList = ref<{ url: string }[]>([]);
const ocrResult = ref<ReceiptOcrResult | null>(null);
const loading = ref(false);

async function afterRead() {
  loading.value = true;
  try {
    const { data: res } = await ocrReceipt();
    if (res.code === 200) {
      ocrResult.value = res.data;
      if (authStore.memberId) {
        const records = getUserStorage<ReceiptOcrResult[]>(
          authStore.memberId,
          STORAGE_SUFFIX.RECEIPTS,
          []
        );
        records.push(res.data);
        setUserStorage(authStore.memberId, STORAGE_SUFFIX.RECEIPTS, records);
      }
      showToast(`识别成功，+${res.data.pointsAwarded} 积分`);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="小票上传"
      left-arrow
      fixed
      placeholder
      class="receipt-page__nav"
      @click-left="$router.back()"
    />
    <div class="content">
      <van-uploader
        v-model="fileList"
        :max-count="1"
        :after-read="afterRead"
        accept="image/*"
      />
      <p class="hint">演示版：上传任意图片触发 Mock OCR</p>

      <van-cell-group v-if="ocrResult" inset title="识别结果">
        <van-cell title="商户" :value="ocrResult.merchantName" />
        <van-cell title="金额" :value="`¥${ocrResult.amount}`" />
        <van-cell title="日期" :value="ocrResult.receiptDate" />
        <van-cell title="小票号" :value="ocrResult.receiptNo" />
        <van-cell title="获得积分" :value="`${ocrResult.pointsAwarded}`" />
      </van-cell-group>
      <van-loading v-if="loading" class="loading">识别中…</van-loading>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
}
.receipt-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}
.content {
  padding: 16px;
}
.hint {
  font-size: 12px;
  color: #969799;
  margin: 12px 0;
}
.loading {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
