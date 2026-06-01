<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { fetchMemberInfo } from '@/api/business'
import { useAuthStore } from '@/store/authStore'
import type { MemberInfo } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const member = ref<MemberInfo | null>(null)

onMounted(async () => {
  const { data: res } = await fetchMemberInfo()
  if (res.code === 200) member.value = res.data
})

async function onLogout() {
  await showConfirmDialog({ title: '确认退出登录？' })
  await authStore.logout()
  router.replace('/login')
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="我的" left-arrow fixed placeholder @click-left="$router.back()" />
    <van-cell-group inset class="profile">
      <van-cell title="昵称" :value="authStore.userInfo?.nickname" />
      <van-cell title="会员等级" :value="member?.level" />
      <van-cell title="积分" :value="`${member?.points ?? 0}`" />
      <van-cell title="演示身份" :value="authStore.personaId || '-'" />
      <van-cell title="助手 UI 配置" is-link to="/admin/ui" label="背景、头像、主色" />
    </van-cell-group>
    <div class="actions">
      <van-button block type="danger" plain @click="onLogout">退出登录</van-button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f7f8fa;
}
.profile {
  margin-top: 12px;
}
.actions {
  padding: 24px 16px;
}
</style>
