<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchWelcomePage, fetchRecommendEntries } from '@/api/business'
import { useAssistantStore } from '@/store/assistantStore'
import type { RecommendEntry, WelcomePageData } from '@/types'

const emit = defineEmits<{
  startChat: [prompt?: string]
}>()

const router = useRouter()
const assistantStore = useAssistantStore()
const loading = ref(true)
const welcome = ref<WelcomePageData | null>(null)
const entries = ref<RecommendEntry[]>([])

const ui = computed(() => assistantStore.uiConfig ?? welcome.value?.ui)

const bgStyle = computed(() => {
  const url = ui.value?.chatBackgroundUrl
  return url
    ? {
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }
    : {}
})

const themeStyle = computed(() => ({
  '--welcome-primary': ui.value?.primaryColor ?? '#07c160',
  '--welcome-primary-light': ui.value?.primaryColorLight ?? '#e8f8ef',
}))

const avatarUrl = computed(
  () => ui.value?.defaultImageUrl ?? ui.value?.assistantAvatarUrl ?? '/assistant/avatar-idle.svg',
)

onMounted(async () => {
  try {
    await assistantStore.loadConfig(true)
    const [welcomeRes, entriesRes] = await Promise.all([
      fetchWelcomePage(),
      fetchRecommendEntries(),
    ])
    if (welcomeRes.data.code === 200) welcome.value = welcomeRes.data.data
    if (entriesRes.data.code === 200) entries.value = entriesRes.data.data
  } finally {
    loading.value = false
  }
})

function onStartChat() {
  emit('startChat')
}

function onEntryClick(entry: RecommendEntry) {
  if (entry.target === 'page' && entry.targetPath) {
    router.push(entry.targetPath)
    return
  }
  emit('startChat', entry.promptHint)
}
</script>

<template>
  <div class="welcome-panel" :style="[bgStyle, themeStyle]">
    <van-loading v-if="loading" class="welcome-panel__loading" />

    <template v-else-if="welcome">
      <div class="welcome-panel__overlay">
        <div class="welcome-panel__card">
          <img
            :src="avatarUrl"
            :alt="welcome.ui.assistantNickname"
            class="welcome-panel__avatar"
          />
          <h2 class="welcome-panel__title">{{ welcome.title }}</h2>
          <p class="welcome-panel__subtitle">{{ welcome.subtitle }}</p>
          <p class="welcome-panel__body">{{ welcome.body }}</p>

          <div v-if="welcome.highlights.length" class="welcome-panel__highlights">
            <van-tag
              v-for="item in welcome.highlights"
              :key="item"
              round
              class="welcome-panel__tag"
            >
              {{ item }}
            </van-tag>
          </div>

          <div v-if="entries.length" class="welcome-panel__entries">
            <p class="welcome-panel__entries-label">为您推荐</p>
            <div class="welcome-panel__entry-grid">
              <button
                v-for="entry in entries"
                :key="entry.entryId"
                type="button"
                class="welcome-panel__entry"
                @click="onEntryClick(entry)"
              >
                <van-icon :name="entry.icon" size="22" />
                <span>{{ entry.title }}</span>
              </button>
            </div>
          </div>

          <van-button
            block
            round
            type="primary"
            class="welcome-panel__cta"
            @click="onStartChat"
          >
            开始对话
          </van-button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.welcome-panel {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.welcome-panel__loading {
  display: flex;
  justify-content: center;
  padding-top: 80px;
}

.welcome-panel__overlay {
  min-height: 100%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(247, 248, 250, 0.95) 45%,
    #f0f2f5 100%
  );
  padding: 16px 16px 24px;
}

.welcome-panel__card {
  background: #fff;
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  text-align: center;
}

.welcome-panel__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 3px solid var(--welcome-primary, #07c160);
  margin: 0 auto 12px;
  background: var(--welcome-primary-light, #e8f8ef);
}

.welcome-panel__title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: #323233;
}

.welcome-panel__subtitle {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--welcome-primary, #07c160);
  font-weight: 500;
}

.welcome-panel__body {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #646566;
  text-align: left;
}

.welcome-panel__highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
}

.welcome-panel__tag {
  background: var(--welcome-primary-light, #e8f8ef) !important;
  color: var(--welcome-primary, #07c160) !important;
  border: none !important;
}

.welcome-panel__entries {
  margin-bottom: 20px;
  text-align: left;
}

.welcome-panel__entries-label {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #323233;
}

.welcome-panel__entry-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.welcome-panel__entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 1px solid #eee;
  border-radius: 12px;
  background: #fafafa;
  font-size: 12px;
  color: #323233;
  cursor: pointer;
}

.welcome-panel__entry:active {
  background: var(--welcome-primary-light, #e8f8ef);
  border-color: var(--welcome-primary, #07c160);
}

.welcome-panel__entry .van-icon {
  color: var(--welcome-primary, #07c160);
}

.welcome-panel__cta {
  background: var(--welcome-primary, #07c160) !important;
  border-color: var(--welcome-primary, #07c160) !important;
}
</style>
