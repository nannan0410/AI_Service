<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { fetchMemberInfo, fetchActivities } from "@/api/business";
import { useAuthStore } from "@/store/authStore";
import { useAssistantStore } from "@/store/assistantStore";
import { useScenicStore } from "@/store/scenicStore";
import { useConversationStore } from "@/store/conversationStore";
import ScenicPickerSheet from "@/components/scenic/ScenicPickerSheet.vue";
import MemberAvatar from "@/components/member/MemberAvatar.vue";
import { DEFAULT_SCENIC_ID } from "@/utils/scenicScope";
import type { Activity, MemberInfo } from "@/types";

const router = useRouter();
const authStore = useAuthStore();
const assistantStore = useAssistantStore();
const scenicStore = useScenicStore();
const conversationStore = useConversationStore();

const member = ref<MemberInfo | null>(null);
const activities = ref<Activity[]>([]);
const scenicPickerVisible = ref(false);

const currentScenicName = computed(
  () => scenicStore.currentScenicName || "选择服务景区",
);

const pickerInitialCityId = computed(() =>
  scenicStore.resolvePickerCityId(scenicStore.currentScenicId),
);

const shortcuts = [
  { title: "AI 聊天", icon: "chat-o", path: "/chat", color: "var(--chat-primary)" },
  { title: "我的订单", icon: "orders-o", path: "/orders", color: "#1989fa" },
  { title: "停车缴费", icon: "logistics", path: "/parking", color: "#ff976a" },
  { title: "优惠券", icon: "coupon-o", path: "/coupon", color: "#ee0a24" },
  { title: "发票申请", icon: "bill-o", path: "/invoice", color: "#7232dd" },
  { title: "园区打卡", icon: "location-o", path: "/checkin", color: "#07c160" },
  { title: "小票上传", icon: "photograph", path: "/receipt", color: "var(--chat-primary)" },
];

function ensureHomeScenic() {
  if (authStore.memberId) {
    scenicStore.bindMember(authStore.memberId);
    conversationStore.bindMember(authStore.memberId);
  }
  scenicStore.loadCatalog();
  conversationStore.loadPersisted();

  const resolved = scenicStore.resolveScenicId(
    null,
    conversationStore.scenicId,
  );
  const scenicId =
    resolved.scenicId ||
    (scenicStore.isValidScenicId(DEFAULT_SCENIC_ID)
      ? DEFAULT_SCENIC_ID
      : scenicStore.enabledScenics[0]?.scenicId);

  if (scenicId) {
    scenicStore.selectScenic(scenicId);
  }
}

async function loadActivities() {
  try {
    const { data: actRes } = await fetchActivities();
    if (actRes.code === 200) {
      activities.value = actRes.data.slice(0, 3);
    }
  } catch {
    activities.value = [];
  }
}

function openScenicPicker() {
  scenicPickerVisible.value = true;
}

function onPickerCityChange(cityId: string) {
  try {
    scenicStore.selectCity(cityId, { persist: true });
  } catch {
    /* ignore */
  }
}

async function onScenicPicked(scenicId: string) {
  scenicPickerVisible.value = false;
  if (scenicStore.currentScenicId === scenicId) return;
  scenicStore.selectScenic(scenicId);
  // 与助手对齐：首页切园同步会话景区，避免进 /chat 仍被旧 conversation 覆盖
  if (authStore.memberId) {
    try {
      conversationStore.bindMember(authStore.memberId);
      conversationStore.ensureConversation(scenicId, {
        personaId: authStore.personaId,
        forceNew: true,
      });
    } catch {
      /* 未登录等场景忽略 */
    }
  }
  await loadActivities();
}

onMounted(async () => {
  ensureHomeScenic();
  void scenicStore.refreshLocatedCity();
  await assistantStore.loadConfig();
  assistantStore.setMotion("wave");
  const [memberRes] = await Promise.all([fetchMemberInfo(), loadActivities()]);
  if (memberRes.data.code === 200) member.value = memberRes.data.data;
});

watch(
  () => scenicStore.currentScenicId,
  (id, prev) => {
    if (id && id !== prev) void loadActivities();
  },
);
</script>

<template>
  <div class="home-page">
    <van-nav-bar fixed placeholder class="home-page__nav">
      <template #title>
        <button
          type="button"
          class="home-page__scenic-btn"
          :aria-label="`当前景区 ${currentScenicName}`"
          @click="openScenicPicker"
        >
          <span class="home-page__scenic-name">{{ currentScenicName }}</span>
          <van-icon name="arrow-down" size="14" />
        </button>
      </template>
      <template #right>
        <van-icon name="user-o" size="20" @click="router.push('/profile')" />
      </template>
    </van-nav-bar>

    <ScenicPickerSheet
      v-model:show="scenicPickerVisible"
      :cities="scenicStore.enabledCities"
      :scenics="scenicStore.enabledScenics"
      :current-scenic-id="scenicStore.currentScenicId"
      :initial-city-id="pickerInitialCityId"
      title="选择服务景区"
      @select="onScenicPicked"
      @update:city-id="onPickerCityChange"
    />

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
          <van-empty
            v-if="!activities.length"
            description="暂无推荐项目"
            image-size="64"
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

.home-page__scenic-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  max-width: 220px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #323233;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
}

.home-page__scenic-btn:active {
  opacity: 0.75;
}

.home-page__scenic-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
