<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useAuthStore } from '@/store/authStore'
import type { PersonaId } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const showPersonaSheet = ref(false)

const personaOptions: Array<{ id: PersonaId; name: string; desc: string }> = [
  { id: 'demo_new', name: '新用户', desc: '零订单、无车牌' },
  { id: 'demo_mid', name: '中级会员', desc: '有未游玩订单' },
  { id: 'demo_vip', name: '高级会员', desc: '有已完成订单' },
]

async function onSelectPersona(personaId: PersonaId) {
  showPersonaSheet.value = false
  try {
    await authStore.login(personaId)
    showToast('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e) {
    showToast(e instanceof Error ? e.message : '登录失败')
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-page__hero">
      <img src="/assistant/avatar-idle.svg" alt="小景" class="login-page__avatar" />
      <h1 class="login-page__title">景区 AI 助手</h1>
      <p class="login-page__subtitle">智慧景区运营入口 · 演示版</p>
    </div>

    <div class="login-page__actions">
      <van-button
        type="primary"
        block
        round
        class="login-page__wechat-btn"
        :loading="authStore.loading"
        @click="showPersonaSheet = true"
      >
        微信一键登录
      </van-button>
      <p class="login-page__hint">演示版请选择体验账号</p>
    </div>

    <van-popup v-model:show="showPersonaSheet" round position="bottom" safe-area-inset-bottom>
      <div class="persona-sheet">
        <h3 class="persona-sheet__title">选择演示身份</h3>
        <van-cell-group>
          <van-cell
            v-for="p in personaOptions"
            :key="p.id"
            :title="p.name"
            :label="p.desc"
            is-link
            @click="onSelectPersona(p.id)"
          />
        </van-cell-group>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 32px 24px;
  background: linear-gradient(180deg, #e8f8ef 0%, #f7f8fa 40%);
}

.login-page__hero {
  text-align: center;
  margin-bottom: 48px;
}

.login-page__avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 3px solid #07c160;
  background: #fff;
  margin-bottom: 16px;
}

.login-page__title {
  font-size: 24px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 8px;
}

.login-page__subtitle {
  font-size: 14px;
  color: #969799;
  margin: 0;
}

.login-page__actions {
  padding: 0 8px;
}

.login-page__wechat-btn {
  background: #07c160 !important;
  border-color: #07c160 !important;
  height: 48px;
  font-size: 16px;
}

.login-page__hint {
  text-align: center;
  font-size: 12px;
  color: #969799;
  margin-top: 16px;
}

.persona-sheet {
  padding: 16px 0 24px;
}

.persona-sheet__title {
  text-align: center;
  font-size: 16px;
  margin: 0 0 12px;
  color: #323233;
}
</style>
