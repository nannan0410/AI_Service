<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchMemberInfo, fetchActivities } from "@/api/business";
import { useAuthStore } from "@/store/authStore";
import { useAssistantStore } from "@/store/assistantStore";
import MemberAvatar from "@/components/member/MemberAvatar.vue";
import type { Activity, MemberInfo } from "@/types";

const router = useRouter();
const authStore = useAuthStore();
const assistantStore = useAssistantStore();

const member = ref<MemberInfo | null>(null);
const activities = ref<Activity[]>([]);

const shortcuts = [
  { title: "AI 聊天", icon: "chat-o", path: "/chat", color: "var(--chat-primary)" },
  { title: "我的订单", icon: "orders-o", path: "/orders", color: "#1989fa" },
  { title: "停车缴费", icon: "logistics", path: "/parking", color: "#ff976a" },
  { title: "优惠券", icon: "coupon-o", path: "/coupon", color: "#ee0a24" },
  { title: "发票申请", icon: "bill-o", path: "/invoice", color: "#7232dd" },
  { title: "园区打卡", icon: "location-o", path: "/checkin", color: "#07c160" },
  { title: "小票上传", icon: "photograph", path: "/receipt", color: "var(--chat-primary)" },
];

onMounted(async () => {
  await assistantStore.loadConfig();
  assistantStore.setMotion("wave");
  const [memberRes, actRes] = await Promise.all([
    fetchMemberInfo(),
    fetchActivities(),
  ]);
  if (memberRes.data.code === 200) member.value = memberRes.data.data;
  if (actRes.data.code === 200) activities.value = actRes.data.data.slice(0, 3);
});
</script>

<template>
  <div class="home-page">
    <van-nav-bar title="欢乐景区" fixed placeholder class="home-page__nav">
      <template #right>
        <van-icon name="user-o" size="20" @click="router.push('/profile')" />
      </template>
    </van-nav-bar>

    <div class="home-page__body">
      <div class="home-page__welcome">
        <MemberAvatar :size="56" />
        <div class="home-page__welcome-text">
          <p class="home-page__hi">Hi，{{ authStore.userInfo?.nickname }}</p>
          <p class="home-page__level">
            {{ member?.level }} · {{ member?.points ?? 0 }} 积分
          </p>
        </div>
      </div>

      <div class="home-page__shortcuts-card">
        <van-grid :column-num="3" :border="false" class="home-page__shortcuts">
          <van-grid-item
            v-for="item in shortcuts"
            :key="item.path"
            :icon="item.icon"
            :text="item.title"
            :icon-color="item.color"
            @click="router.push(item.path)"
          />
        </van-grid>
      </div>

      <div class="home-page__section">
        <div class="home-page__section-title">推荐项目</div>
        <van-cell-group inset class="home-page__activity-card">
          <van-cell
            v-for="act in activities"
            :key="act.activityId"
            :title="act.name"
            :label="`${act.location} · ${act.timeRange}`"
            is-link
            @click="router.push('/activity')"
          />
        </van-cell-group>
      </div>

      <div class="home-page__footer">
        <van-button
          type="primary"
          round
          block
          icon="chat"
          class="home-page__chat-btn"
          @click="router.push('/chat')"
        >
          开始对话
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  background: #f7f8fa;
}

.home-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}

.home-page__body {
  width: 100%;
  padding: 0 16px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.home-page__welcome {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 16px;
  overflow: hidden;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

.home-page__welcome-text {
  flex: 1;
  min-width: 0;
}

.home-page__hi {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.home-page__level {
  margin: 0;
  font-size: 13px;
  color: var(--chat-primary);
}

.home-page__shortcuts-card {
  margin-top: 12px;
  overflow: hidden;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

.home-page__shortcuts {
  margin: 0;
}

.home-page__shortcuts-card :deep(.van-grid-item__content) {
  background: transparent;
}

.home-page__section {
  margin-top: 16px;
}

.home-page__section-title {
  padding: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}

.home-page__activity-card {
  margin: 0 !important;
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

.home-page__footer {
  display: flex;
  justify-content: center;
  margin-top: 30px;
  width: 100%;
}

.home-page__chat-btn {
  width: 124px;
  height: 48px;
  font-size: 16px;
  background: var(--chat-primary) !important;
  border-color: var(--chat-primary) !important;
}
</style>
