<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchMemberInfo, fetchActivities } from "@/api/business";
import { useAuthStore } from "@/store/authStore";
import { useAssistantStore } from "@/store/assistantStore";
import AssistantAvatar from "@/components/assistant/AssistantAvatar.vue";
import type { Activity, MemberInfo } from "@/types";

const router = useRouter();
const authStore = useAuthStore();
const assistantStore = useAssistantStore();

const member = ref<MemberInfo | null>(null);
const activities = ref<Activity[]>([]);

const shortcuts = [
  { title: "AI 聊天", icon: "chat-o", path: "/chat", color: "#07c160" },
  { title: "我的订单", icon: "orders-o", path: "/orders", color: "#1989fa" },
  { title: "停车缴费", icon: "logistics", path: "/parking", color: "#ff976a" },
  { title: "优惠券", icon: "coupon-o", path: "/coupon", color: "#ee0a24" },
  { title: "发票申请", icon: "bill-o", path: "/invoice", color: "#7232dd" },
  { title: "小票上传", icon: "photograph", path: "/receipt", color: "#07c160" },
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
    <van-nav-bar title="欢乐景区" fixed placeholder>
      <template #right>
        <van-icon name="user-o" size="20" @click="router.push('/profile')" />
      </template>
    </van-nav-bar>

    <div class="home-page__welcome">
      <AssistantAvatar :size="56" show-name />
      <div class="home-page__welcome-text">
        <p class="home-page__hi">Hi，{{ authStore.userInfo?.nickname }}</p>
        <p class="home-page__level">
          {{ member?.level }} · {{ member?.points ?? 0 }} 积分
        </p>
      </div>
    </div>

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

    <div class="home-page__section">
      <div class="home-page__section-title">推荐活动</div>
      <van-cell-group inset>
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

    <div class="home-page__fab">
      <van-button
        type="primary"
        round
        icon="chat"
        @click="router.push('/chat')"
      >
        开始对话
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 80px;
}

.home-page__welcome {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 16px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
}

.home-page__welcome-text {
  flex: 1;
}

.home-page__hi {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  color: #323233;
}

.home-page__level {
  font-size: 13px;
  color: #ff976a;
  margin: 0;
}

.home-page__shortcuts {
  margin: 8px 0;
}

.home-page__section {
  margin-top: 8px;
}

.home-page__section-title {
  padding: 12px 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}

.home-page__fab {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
