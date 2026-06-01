<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { fetchPlate, bindPlate, queryParking, payParking } from '@/api/business'

type Mode = 'select' | 'bind' | 'pay'

const mode = ref<Mode>('select')
const plateNo = ref<string | null>(null)
const inputPlate = ref('')
const parkingInfo = ref<{ amount: number; duration: string } | null>(null)
const loading = ref(false)

onMounted(async () => {
  const { data: res } = await fetchPlate()
  if (res.code === 200) plateNo.value = res.data.plateNo
})

function chooseHasPlate() {
  if (!plateNo.value) {
    showToast('当前账号未绑定车牌，请选择「无车牌」')
    return
  }
  mode.value = 'pay'
  loadParkingFee()
}

function chooseNoPlate() {
  if (plateNo.value) {
    showToast('您已绑定车牌，请使用已绑定车牌缴费')
    return
  }
  mode.value = 'bind'
}

async function onBind() {
  const value = inputPlate.value.trim()
  if (!value) {
    showToast('请输入车牌号')
    return
  }
  loading.value = true
  try {
    const { data: res } = await bindPlate(value)
    if (res.code !== 200) {
      showToast(res.message || '绑定失败')
      return
    }
    plateNo.value = res.data.plateNo
    showToast('绑定成功')
    mode.value = 'pay'
    await loadParkingFee()
  } finally {
    loading.value = false
  }
}

async function loadParkingFee() {
  if (!plateNo.value) return
  loading.value = true
  try {
    const { data: res } = await queryParking(plateNo.value)
    if (res.code === 200) {
      parkingInfo.value = { amount: res.data.amount, duration: res.data.duration }
    }
  } finally {
    loading.value = false
  }
}

async function onPay() {
  if (!plateNo.value || !parkingInfo.value) return
  await showConfirmDialog({
    title: '确认支付',
    message: `车牌 ${plateNo.value}，停车费 ¥${parkingInfo.value.amount}`,
  })
  loading.value = true
  try {
    const { data: res } = await payParking({ plateNo: plateNo.value, amount: parkingInfo.value.amount })
    if (res.code === 200) {
      showToast('支付成功')
      mode.value = 'select'
      parkingInfo.value = null
    }
  } finally {
    loading.value = false
  }
}

function backToSelect() {
  mode.value = 'select'
  parkingInfo.value = null
  inputPlate.value = ''
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="停车缴费" left-arrow fixed placeholder @click-left="$router.back()" />

    <div v-if="mode === 'select'" class="content">
      <van-cell-group inset title="请选择">
        <van-cell title="我有车牌（已绑定）" is-link @click="chooseHasPlate" />
        <van-cell title="我还没有绑定车牌" is-link @click="chooseNoPlate" />
      </van-cell-group>
      <p v-if="plateNo" class="hint">当前绑定：{{ plateNo }}</p>
    </div>

    <div v-else-if="mode === 'bind'" class="content">
      <van-cell-group inset title="绑定车牌（仅可绑定一次）">
        <van-field v-model="inputPlate" label="车牌号" placeholder="如：粤B·12345" />
      </van-cell-group>
      <div class="actions">
        <van-button block type="primary" :loading="loading" @click="onBind">确认绑定</van-button>
        <van-button block plain @click="backToSelect">返回</van-button>
      </div>
    </div>

    <div v-else class="content">
      <van-cell-group inset>
        <van-cell title="车牌号" :value="plateNo || '-'" />
        <van-cell title="停车时长" :value="parkingInfo?.duration || '-'" />
        <van-cell title="应付金额" :value="parkingInfo ? `¥${parkingInfo.amount}` : '-'" />
      </van-cell-group>
      <div class="actions">
        <van-button block type="primary" :loading="loading" @click="onPay">确认支付</van-button>
        <van-button block plain @click="backToSelect">返回</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
}
.content {
  padding-top: 12px;
}
.hint {
  text-align: center;
  font-size: 13px;
  color: #969799;
  margin-top: 12px;
}
.actions {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
