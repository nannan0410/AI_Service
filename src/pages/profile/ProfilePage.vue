<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog } from "vant";
import { fetchMemberInfo } from "@/api/business";
import { useAuthStore } from "@/store/authStore";
import { useAssistantStore } from "@/store/assistantStore";
import type { MemberInfo } from "@/types";

const router = useRouter();
const authStore = useAuthStore();
const assistantStore = useAssistantStore();
const member = ref<MemberInfo | null>(null);

const primaryColor = computed(() => assistantStore.primaryColor);

onMounted(async () => {
  const [{ data: res }] = await Promise.all([
    fetchMemberInfo(),
    assistantStore.loadConfig(),
  ]);
  if (res.code === 200) member.value = res.data;
});

async function onLogout() {
  await showConfirmDialog({
    title: "确认退出登录？",
    width: 240,
    cancelButtonColor: primaryColor.value,
    className: "profile-logout-dialog",
  });
  await authStore.logout();
  router.replace("/login");
}
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="我的"
      left-arrow
      fixed
      placeholder
      class="profile-page__nav"
      @click-left="$router.back()"
    />
    <van-cell-group inset class="profile">
      <van-cell title="昵称" :value="authStore.userInfo?.nickname" />
      <van-cell title="会员等级" :value="member?.level" />
      <van-cell title="积分" :value="`${member?.points ?? 0}`" />
      <van-cell title="演示身份" :value="authStore.personaId || '-'" />
      <van-cell
        class="profile__config-cell"
        title="后台配置"
        is-link
        to="/config"
        label="助手 UI、Skill、快捷服务与游游推荐"
      />
    </van-cell-group>
    <div class="actions">
      <van-button block plain class="profile__logout-btn" @click="onLogout">
        退出登录
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  background: #f7f8fa;
}

.profile-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}

.profile {
  margin-top: 12px;
}

.profile__config-cell {
  align-items: center;
}

.profile__config-cell :deep(.van-cell__right-icon) {
  display: flex;
  align-items: center;
  align-self: center;
  height: auto;
  line-height: 1;
}

.actions {
  padding: 24px 16px;
}

.profile__logout-btn.van-button--plain {
  height: 44px;
  color: var(--chat-primary) !important;
  background: #fff;
  border: 1px solid var(--chat-primary) !important;
  border-radius: 999px;
}

.profile__logout-btn.van-button--plain:active {
  color: var(--chat-primary-dark) !important;
  border-color: var(--chat-primary-dark) !important;
}
</style>

<style>
.profile-logout-dialog .van-dialog {
  width: 240px !important;
  max-width: 240px;
  border-radius: 12px;
  overflow: hidden;
}

.profile-logout-dialog .van-dialog__header {
  padding: 26px 12px 22px;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  color: #323233;
  text-align: center;
}

.profile-logout-dialog .van-dialog__footer {
  display: flex;
  overflow: hidden;
  border: 1px solid #ebedf0;
}

.profile-logout-dialog .van-dialog__cancel,
.profile-logout-dialog .van-dialog__confirm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 0;
  padding: 0;
  border: none !important;
  border-radius: 0;
  text-align: center;
  font-weight: 500;
}

.profile-logout-dialog .van-dialog__confirm {
  border-left: 1px solid #ebedf0 !important;
}

.profile-logout-dialog .van-dialog__cancel {
  color: var(--chat-primary) !important;
}

.profile-logout-dialog .van-dialog__confirm {
  color: #323233;
}
</style>
