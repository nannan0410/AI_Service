<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const activeTab = computed(() => {
  if (route.path.includes("/business") || route.path.includes("/route-check"))
    return "business";
  if (route.path.includes("/data")) return "data";
  return "ui";
});

const isWideTab = computed(
  () => activeTab.value === "data" || route.path.includes("/route-check"),
);

function onTabChange(name: string | number) {
  const map: Record<string, string> = {
    ui: "/config/ui",
    business: "/config/business",
    data: "/config/data",
  };
  router.replace(map[String(name)] ?? "/config/ui");
}

function openChatH5() {
  router.push("/chat");
}
</script>

<template>
  <div class="config-layout" :class="{ 'config-layout--wide': isWideTab }">
    <van-nav-bar
      :title="route.path.includes('/route-check') ? '路由冲突检查' : '后台配置'"
      left-arrow
      fixed
      placeholder
      class="config-layout__nav"
      @click-left="
        route.path.includes('/route-check')
          ? router.push('/config/business')
          : router.push('/profile')
      "
    >
      <template #right>
        <button type="button" class="config-layout__h5-btn" @click="openChatH5">
          AI 客服 H5
        </button>
      </template>
    </van-nav-bar>

    <van-tabs :active="activeTab" shrink class="config-layout__tabs" @change="onTabChange">
      <van-tab title="助手 UI" name="ui" />
      <van-tab title="业务场景" name="business" />
      <van-tab title="数据与接口" name="data" />
    </van-tabs>

    <router-view />
  </div>
</template>

<style scoped>
.config-layout {
  width: 100%;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  background: #f5f6f8;
}

.config-layout--wide {
  max-width: min(960px, 100%);
}

.config-layout__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: inherit;
}

.config-layout__h5-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--chat-primary, #07c160);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
}

.config-layout__h5-btn:active {
  opacity: 0.7;
}

.config-layout__tabs :deep(.van-tabs__wrap) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
</style>
