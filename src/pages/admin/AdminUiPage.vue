<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useAssistantStore } from '@/store/assistantStore'
import {
  getAdminUiOverride,
  readFileAsDataUrl,
  MAX_IMAGE_SIZE_BYTES,
  type AdminUiPatch,
} from '@/utils/adminUiConfig'

const router = useRouter()
const assistantStore = useAssistantStore()

const primaryColor = ref('#07c160')
const primaryColorLight = ref('#e8f8ef')
const chatBackgroundUrl = ref('')
const assistantAvatarUrl = ref('')

const bgPreview = computed(() => chatBackgroundUrl.value || undefined)
const avatarPreview = computed(() => assistantAvatarUrl.value || '/assistant/avatar-idle.svg')

const previewStyle = computed(() => ({
  '--preview-primary': primaryColor.value,
  '--preview-primary-light': primaryColorLight.value,
  backgroundImage: bgPreview.value ? `url(${bgPreview.value})` : undefined,
}))

onMounted(async () => {
  await assistantStore.loadConfig(true)
  const cfg = assistantStore.uiConfig
  const override = getAdminUiOverride()
  if (cfg) {
    primaryColor.value = override?.primaryColor ?? cfg.primaryColor
    primaryColorLight.value = override?.primaryColorLight ?? cfg.primaryColorLight ?? '#e8f8ef'
    chatBackgroundUrl.value = override?.chatBackgroundUrl ?? cfg.chatBackgroundUrl
    assistantAvatarUrl.value =
      override?.assistantAvatarUrl ?? cfg.assistantAvatarUrl ?? cfg.defaultImageUrl
  }
})

async function onPickBackground(file: File | undefined) {
  if (!file) return
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    showToast('图片过大，请小于 800KB')
    return
  }
  chatBackgroundUrl.value = await readFileAsDataUrl(file)
}

async function onPickAvatar(file: File | undefined) {
  if (!file) return
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    showToast('图片过大，请小于 800KB')
    return
  }
  assistantAvatarUrl.value = await readFileAsDataUrl(file)
}

function onBackgroundRead(item: { file?: File } | { file?: File }[]) {
  const file = Array.isArray(item) ? item[0]?.file : item.file
  onPickBackground(file)
}

function onAvatarRead(item: { file?: File } | { file?: File }[]) {
  const file = Array.isArray(item) ? item[0]?.file : item.file
  onPickAvatar(file)
}

function buildPatch(): AdminUiPatch {
  return {
    primaryColor: primaryColor.value,
    primaryColorLight: primaryColorLight.value,
    chatBackgroundUrl: chatBackgroundUrl.value,
    assistantAvatarUrl: assistantAvatarUrl.value,
    defaultImageUrl: assistantAvatarUrl.value,
  }
}

function onSave() {
  assistantStore.applyAdminPatch(buildPatch())
  showToast('已保存，聊天页将使用新配置')
}

async function onReset() {
  await showConfirmDialog({ title: '恢复默认配置？', message: '将清除本地覆盖并读取 JSON 默认项' })
  await assistantStore.clearAdminPatch()
  const cfg = assistantStore.uiConfig
  if (cfg) {
    primaryColor.value = cfg.primaryColor
    primaryColorLight.value = cfg.primaryColorLight ?? '#e8f8ef'
    chatBackgroundUrl.value = cfg.chatBackgroundUrl
    assistantAvatarUrl.value = cfg.assistantAvatarUrl
  }
  showToast('已恢复默认')
}

function goPreviewChat() {
  onSave()
  router.push('/chat')
}
</script>

<template>
  <div class="admin-ui">
    <van-nav-bar title="助手 UI 配置" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-notice-bar
      left-icon="info-o"
      text="演示版：配置保存在浏览器 LocalStorage，换设备或清缓存后需重新设置"
    />

    <div class="admin-ui__preview" :style="previewStyle">
      <p class="admin-ui__preview-label">实时预览</p>
      <div class="admin-ui__preview-card">
        <img :src="avatarPreview" alt="avatar" class="admin-ui__preview-avatar" />
        <p class="admin-ui__preview-title">景区 AI 助手</p>
        <van-button size="small" round type="primary" class="admin-ui__preview-btn">发送</van-button>
        <div class="admin-ui__preview-bubble">您好，有什么可以帮您？</div>
      </div>
    </div>

    <van-cell-group inset title="主色配置">
      <van-field v-model="primaryColor" label="主色" placeholder="#07c160">
        <template #button>
          <input v-model="primaryColor" type="color" class="admin-ui__color-input" />
        </template>
      </van-field>
      <van-field v-model="primaryColorLight" label="浅色背景" placeholder="#e8f8ef">
        <template #button>
          <input v-model="primaryColorLight" type="color" class="admin-ui__color-input" />
        </template>
      </van-field>
    </van-cell-group>

    <van-cell-group inset title="图片配置">
      <van-cell title="聊天背景">
        <template #label>建议 9:16，JPG/PNG，&lt; 800KB</template>
      </van-cell>
      <div class="admin-ui__uploader-row">
        <van-uploader :after-read="onBackgroundRead" :max-count="1" accept="image/*">
          <van-button icon="photograph" size="small" type="primary">上传背景</van-button>
        </van-uploader>
        <van-field v-model="chatBackgroundUrl" placeholder="或粘贴图片 URL / data URL" />
      </div>
      <van-cell v-if="bgPreview" title="背景预览">
        <template #value>
          <img :src="bgPreview" alt="bg" class="admin-ui__thumb" />
        </template>
      </van-cell>

      <van-cell title="助手头像">
        <template #label>用于欢迎页与对话头像（idle 态）</template>
      </van-cell>
      <div class="admin-ui__uploader-row">
        <van-uploader :after-read="onAvatarRead" :max-count="1" accept="image/*">
          <van-button icon="photograph" size="small" type="primary">上传头像</van-button>
        </van-uploader>
        <van-field v-model="assistantAvatarUrl" placeholder="或粘贴图片 URL / data URL" />
      </div>
      <van-cell v-if="avatarPreview" title="头像预览">
        <template #value>
          <img :src="avatarPreview" alt="avatar" class="admin-ui__thumb admin-ui__thumb--round" />
        </template>
      </van-cell>
    </van-cell-group>

    <div class="admin-ui__actions">
      <van-button block type="primary" @click="onSave">保存配置</van-button>
      <van-button block plain type="primary" @click="goPreviewChat">保存并预览聊天页</van-button>
      <van-button block plain @click="onReset">恢复 JSON 默认</van-button>
    </div>
  </div>
</template>

<style scoped>
.admin-ui {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 32px;
}

.admin-ui__preview {
  margin: 12px 16px;
  padding: 16px;
  border-radius: 12px;
  background-color: #f0f2f5;
  background-size: cover;
  background-position: center;
}

.admin-ui__preview-label {
  margin: 0 0 8px;
  font-size: 12px;
  color: #969799;
}

.admin-ui__preview-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.admin-ui__preview-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--preview-primary, #07c160);
  object-fit: cover;
}

.admin-ui__preview-title {
  margin: 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.admin-ui__preview-btn {
  background: var(--preview-primary, #07c160) !important;
  border-color: var(--preview-primary, #07c160) !important;
}

.admin-ui__preview-bubble {
  margin-top: 12px;
  text-align: left;
  display: inline-block;
  padding: 8px 12px;
  background: #fff;
  border-radius: 8px;
  font-size: 13px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.admin-ui__color-input {
  width: 36px;
  height: 28px;
  padding: 0;
  border: none;
  background: none;
}

.admin-ui__uploader-row {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-ui__thumb {
  width: 80px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
}

.admin-ui__thumb--round {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.admin-ui__actions {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
