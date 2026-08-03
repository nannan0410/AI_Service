<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog } from "vant";
import { fetchMemberInfo, fetchMemberProfileTags } from "@/api/business";
import { useAuthStore } from "@/store/authStore";
import { useAssistantStore } from "@/store/assistantStore";
import { flattenProfileTags } from "@/utils/profileTags";
import type { MemberInfo, ProfileTag, UserProfileTags } from "@/types";

const router = useRouter();
const authStore = useAuthStore();
const assistantStore = useAssistantStore();
const member = ref<MemberInfo | null>(null);
const profileTags = ref<UserProfileTags | null>(null);

const primaryColor = computed(() => assistantStore.primaryColor);

const categoryLabel: Record<ProfileTag["category"], string> = {
  fact: "事实",
  order: "订单",
  consume: "消费",
  ai: "AI",
};

const displayTags = computed(() => {
  if (!profileTags.value) return [] as ProfileTag[];
  return flattenProfileTags(profileTags.value);
});

onMounted(async () => {
  await assistantStore.loadConfig();
  const { data: res } = await fetchMemberInfo();
  if (res.code === 200) member.value = res.data;
  try {
    const { data: tagRes } = await fetchMemberProfileTags();
    if (tagRes.code === 200 && tagRes.data) profileTags.value = tagRes.data;
  } catch {
    /* 未登录或接口失败时不展示标签 */
  }
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
      class="profile-page__nav"
      @click-left="router.replace('/')"
    />
    <van-cell-group inset class="profile">
      <van-cell title="昵称" :value="authStore.userInfo?.nickname" />
      <van-cell title="会员等级" :value="member?.level" />
      <van-cell title="积分" :value="`${member?.points ?? 0}`" />
      <van-cell title="演示身份" :value="authStore.personaId || '-'" />
      <van-cell
        class="profile__config-cell"
        title="收藏记录"
        is-link
        to="/favorites"
        label="与聊天分开保存；清除聊天不会删除"
      />
      <van-cell
        class="profile__config-cell"
        title="后台配置"
        is-link
        to="/config"
        label="助手 UI、Skill、快捷服务与游游推荐"
      />
    </van-cell-group>

    <van-cell-group v-if="displayTags.length" inset class="profile profile__tags">
      <van-cell title="画像标签" label="只读 · 事实 / 订单 / AI（含对话写回）" />
      <div class="profile__tag-list">
        <span
          v-for="tag in displayTags"
          :key="tag.tagId"
          class="profile__tag"
          :class="`profile__tag--${tag.category}`"
        >
          {{ categoryLabel[tag.category] }} · {{ tag.name
          }}<template v-if="tag.source === 'ai_chat' && tag.evidence"
            >（{{ tag.evidence }}）</template
          >
        </span>
      </div>
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

.profile-page__nav {
  position: sticky;
  top: 0;
  z-index: 100;
}

.profile {
  margin-top: 12px;
}

.profile__tags {
  margin-top: 12px;
}

.profile__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 16px 14px;
}

.profile__tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #323233;
  background: #f2f3f5;
}

.profile__tag--fact {
  color: #1989fa;
  background: rgba(25, 137, 250, 0.1);
}

.profile__tag--order {
  color: #07c160;
  background: rgba(7, 193, 96, 0.1);
}

.profile__tag--ai {
  color: #7232dd;
  background: rgba(114, 50, 221, 0.1);
}

.profile__tag--consume {
  color: #ed6a0c;
  background: rgba(237, 106, 12, 0.1);
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
