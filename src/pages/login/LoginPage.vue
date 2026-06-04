<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showToast } from "vant";
import { useAuthStore } from "@/store/authStore";
import { useAssistantStore } from "@/store/assistantStore";
import type { PersonaId } from "@/types";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const assistantStore = useAssistantStore();

const showPersonaSheet = ref(false);
const pageStyle = computed(() => ({
  "--login-primary": assistantStore.primaryColor,
  "--login-primary-light": assistantStore.uiConfig.primaryColorLight,
}));
const avatarUrl = computed(() => assistantStore.assistantAvatarUrl);
const assistantTitle = computed(() => assistantStore.dialogTitle);
const assistantNickname = computed(() => assistantStore.assistantNickname);

const personaOptions: Array<{ id: PersonaId; name: string; desc: string }> = [
  { id: "demo_new", name: "新用户", desc: "零订单、无车牌" },
  { id: "demo_mid", name: "中级会员", desc: "有未游玩订单" },
  { id: "demo_vip", name: "高级会员", desc: "有已完成订单" },
];

async function onSelectPersona(personaId: PersonaId) {
  showPersonaSheet.value = false;
  try {
    await authStore.login(personaId);
    showToast("登录成功");
    const redirect = (route.query.redirect as string) || "/";
    router.replace(redirect);
  } catch (e) {
    showToast(e instanceof Error ? e.message : "登录失败");
  }
}

onMounted(() => {
  assistantStore.loadConfig();
});
</script>

<template>
  <div class="login-page" :style="pageStyle">
    <div class="login-page__content">
      <div class="login-page__hero">
        <img
          :src="avatarUrl"
          :alt="assistantNickname"
          class="login-page__avatar"
        />
        <h1 class="login-page__title">{{ assistantTitle }}</h1>
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
    </div>

    <van-popup
      v-model:show="showPersonaSheet"
      round
      position="bottom"
      safe-area-inset-bottom
    >
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
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(
    180deg,
    var(--login-primary-light, #e8f8ef) 0%,
    #f7f8fa 40%
  );
}

.login-page__content {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-page__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 38px;
  text-align: center;
}

.login-page__avatar {
  display: block;
  width: 88px;
  height: 88px;
  margin: 0 0 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 14px rgba(58, 87, 112, 0.12);
  object-fit: cover;
}

.login-page__title {
  font-size: 23px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 8px;
}

.login-page__subtitle {
  font-size: 13px;
  color: #969799;
  margin: 0;
}

.login-page__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.login-page__wechat-btn {
  background: var(--login-primary) !important;
  border-color: var(--login-primary) !important;
  height: 46px;
  font-size: 16px;
}

.login-page__hint {
  text-align: center;
  font-size: 11px;
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
