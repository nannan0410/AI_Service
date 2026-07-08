<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const activeTab = computed(() =>
  route.path.includes("/business") ? "business" : "ui"
);

function onTabChange(name: string | number) {
  router.replace(name === "business" ? "/config/business" : "/config/ui");
}

function openChatH5() {
  router.push("/chat");
}
</script>

<template>
  <div class="config-layout">
    <van-nav-bar
      title="后台配置"
      left-arrow
      fixed
      placeholder
      class="config-layout__nav"
      @click-left="router.push('/profile')"
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

.config-layout__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
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
