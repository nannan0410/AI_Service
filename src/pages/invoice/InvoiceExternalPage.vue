<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'

const route = useRoute()
const router = useRouter()

const title = ref('')
const taxNo = ref('')
const orderId = route.query.orderId as string
const amount = route.query.amount as string

function onSubmit() {
  if (!title.value.trim()) {
    showToast('请填写发票抬头')
    return
  }
  showToast('开票申请已提交')
  router.replace('/invoice')
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="第三方开票" left-arrow fixed placeholder @click-left="$router.back()" />
    <van-notice-bar left-icon="info-o" text="此为模拟第三方开票页面" />
    <van-cell-group inset class="form">
      <van-cell title="订单号" :value="orderId" />
      <van-cell title="开票金额" :value="amount ? `¥${amount}` : '-'" />
      <van-field v-model="title" label="发票抬头" placeholder="个人或公司名称" required />
      <van-field v-model="taxNo" label="税号" placeholder="企业开票时填写" />
    </van-cell-group>
    <div class="actions">
      <van-button block type="primary" @click="onSubmit">提交开票</van-button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
}
.form {
  margin-top: 12px;
}
.actions {
  padding: 16px;
}
</style>
