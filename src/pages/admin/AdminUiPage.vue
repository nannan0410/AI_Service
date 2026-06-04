<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { showConfirmDialog } from "vant";
import { appToast } from "@/utils/toast";
import { useAssistantStore } from "@/store/assistantStore";
import {
  getAdminUiOverride,
  readFileAsDataUrl,
  MAX_IMAGE_SIZE_BYTES,
  type AdminUiPatch,
} from "@/utils/adminUiConfig";

const DEFAULT_GREETING =
  "嗨！我是游游~无论是买票、领券、查项目、看排队，还是规划路线，都可以交给我！";

const router = useRouter();
const assistantStore = useAssistantStore();

const primaryColor = ref("#07c160");
const primaryColorLight = ref("#e8f8ef");
const chatBackgroundUrl = ref("");
const assistantAvatarUrl = ref("");
const assistantCharacterUrl = ref("");
const welcomeMessage = ref(DEFAULT_GREETING);

const bgPreview = computed(() => chatBackgroundUrl.value || undefined);
const avatarPreview = computed(
  () => assistantAvatarUrl.value || "/assistant/youyou_wave.png"
);
const characterPreview = computed(
  () => assistantCharacterUrl.value || "/assistant/youyou.png"
);

const previewStageStyle = computed(() => ({
  backgroundImage: bgPreview.value ? `url(${bgPreview.value})` : undefined,
  backgroundColor: bgPreview.value ? undefined : primaryColorLight.value,
}));

const themeVars = computed(() => ({
  "--admin-primary": primaryColor.value,
  "--admin-primary-light": primaryColorLight.value,
}));

/** 配置页统一展示昵称 */
const displayNickname = "游游";

function onPickImage(
  file: File | undefined,
  target: { value: string },
  label: string
) {
  if (!file) return;
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    appToast(`${label}过大，请小于 800KB`);
    return;
  }
  readFileAsDataUrl(file).then((url) => {
    target.value = url;
  });
}

onMounted(async () => {
  await assistantStore.loadConfig(true);
  const cfg = assistantStore.uiConfig;
  const override = getAdminUiOverride();
  if (cfg) {
    primaryColor.value = override?.primaryColor ?? cfg.primaryColor;
    primaryColorLight.value =
      override?.primaryColorLight ?? cfg.primaryColorLight ?? "#e8f8ef";
    chatBackgroundUrl.value =
      override?.chatBackgroundUrl ?? cfg.chatBackgroundUrl;
    assistantAvatarUrl.value =
      override?.assistantAvatarUrl ??
      cfg.assistantAvatarUrl ??
      cfg.defaultImageUrl;
    assistantCharacterUrl.value =
      override?.assistantCharacterUrl ?? cfg.assistantCharacterUrl ?? "";
    welcomeMessage.value =
      override?.greeting ?? cfg.greeting ?? DEFAULT_GREETING;
  }
});

function onBackgroundRead(item: { file?: File } | { file?: File }[]) {
  const file = Array.isArray(item) ? item[0]?.file : item.file;
  onPickImage(file, chatBackgroundUrl, "背景图");
}

function onAvatarRead(item: { file?: File } | { file?: File }[]) {
  const file = Array.isArray(item) ? item[0]?.file : item.file;
  onPickImage(file, assistantAvatarUrl, "头像");
}

function onCharacterRead(item: { file?: File } | { file?: File }[]) {
  const file = Array.isArray(item) ? item[0]?.file : item.file;
  onPickImage(file, assistantCharacterUrl, "形象图");
}

function buildPatch(): AdminUiPatch {
  return {
    primaryColor: primaryColor.value,
    primaryColorLight: primaryColorLight.value,
    chatBackgroundUrl: chatBackgroundUrl.value,
    assistantAvatarUrl: assistantAvatarUrl.value,
    assistantCharacterUrl: assistantCharacterUrl.value,
    defaultImageUrl: assistantAvatarUrl.value,
    greeting: welcomeMessage.value,
    assistantName: displayNickname,
    assistantNickname: displayNickname,
  };
}

function onSave() {
  try {
    assistantStore.applyAdminPatch(buildPatch());
    appToast("已保存，聊天页将使用新配置");
  } catch (e) {
    appToast(e instanceof Error ? e.message : "保存失败");
  }
}

async function onReset() {
  await showConfirmDialog({
    title: "恢复默认配置？",
    message: "将清除本地覆盖并读取 JSON 默认项",
  });
  await assistantStore.clearAdminPatch();
  const cfg = assistantStore.uiConfig;
  if (cfg) {
    primaryColor.value = cfg.primaryColor;
    primaryColorLight.value = cfg.primaryColorLight ?? "#e8f8ef";
    chatBackgroundUrl.value = cfg.chatBackgroundUrl;
    assistantAvatarUrl.value = cfg.assistantAvatarUrl;
    assistantCharacterUrl.value = cfg.assistantCharacterUrl ?? "";
    welcomeMessage.value = cfg.greeting ?? DEFAULT_GREETING;
  }
  appToast("已恢复默认");
}

function goPreviewChat() {
  try {
    assistantStore.applyAdminPatch(buildPatch());
    appToast({
      message: "已保存，正在打开聊天页…",
      duration: 1200,
      onClose: () => router.push("/chat"),
    });
  } catch (e) {
    appToast(e instanceof Error ? e.message : "保存失败");
  }
}
</script>

<template>
  <div class="admin-ui" :style="themeVars">
    <van-nav-bar
      title="助手 UI 配置"
      left-arrow
      fixed
      placeholder
      class="admin-page__nav"
      @click-left="$router.back()"
    />

    <van-notice-bar
      left-icon="info-o"
      text="演示版：配置保存在浏览器 LocalStorage，换设备或清缓存后需重新设置"
    />

    <section class="admin-ui__block">
      <p class="admin-ui__block-title">实时预览</p>
      <div
        class="admin-ui__panel admin-ui__preview-stage"
        :style="previewStageStyle"
      >
        <header class="admin-ui__preview-topbar">
          <div class="admin-ui__preview-brand">
            <div class="admin-ui__preview-avatar-shell">
              <img
                :src="avatarPreview"
                :alt="displayNickname"
                class="admin-ui__preview-avatar"
              />
            </div>
            <div class="admin-ui__preview-brand-text">
              <div class="admin-ui__preview-name-row">
                <strong>{{ displayNickname }}</strong>
                <span>✨</span>
              </div>
              <p>景区 AI 助手</p>
            </div>
          </div>
        </header>
        <div class="admin-ui__preview-body">
          <div class="admin-ui__preview-bubble">{{ welcomeMessage }}</div>
        </div>
      </div>
    </section>

    <section class="admin-ui__block">
      <p class="admin-ui__block-title">主色配置</p>
      <div class="admin-ui__panel admin-ui__panel--card">
        <van-field v-model="primaryColor" label="主色" placeholder="#07c160">
          <template #button>
            <input
              v-model="primaryColor"
              type="color"
              class="admin-ui__color-input"
            />
          </template>
        </van-field>
        <van-field
          v-model="primaryColorLight"
          label="浅色背景"
          placeholder="#e8f8ef"
        >
          <template #button>
            <input
              v-model="primaryColorLight"
              type="color"
              class="admin-ui__color-input"
            />
          </template>
        </van-field>
      </div>
    </section>

    <section class="admin-ui__block">
      <p class="admin-ui__block-title">欢迎语</p>
      <div class="admin-ui__panel admin-ui__panel--card">
        <van-field
          v-model="welcomeMessage"
          type="textarea"
          rows="3"
          autosize
          maxlength="200"
          show-word-limit
          placeholder="输入欢迎语"
        />
      </div>
    </section>

    <section class="admin-ui__block">
      <p class="admin-ui__block-title">图片配置</p>
      <div class="admin-ui__panel admin-ui__panel--card">
        <div class="admin-ui__img-block">
          <div class="admin-ui__img-head">
            <span class="admin-ui__item-label">聊天背景</span>
            <span class="admin-ui__item-hint"
              >建议 9:16，JPG/PNG，&lt; 800KB</span
            >
          </div>
          <div class="admin-ui__img-actions">
            <van-uploader
              :after-read="onBackgroundRead"
              :max-count="1"
              accept="image/*"
            >
              <van-button icon="photograph" size="small" round type="primary">
                上传背景
              </van-button>
            </van-uploader>
          </div>
          <img
            v-if="bgPreview"
            :src="bgPreview"
            alt="背景预览"
            class="admin-ui__thumb admin-ui__thumb--wide"
          />
        </div>

        <div class="admin-ui__img-block">
          <div class="admin-ui__img-head">
            <span class="admin-ui__item-label">助手头像</span>
            <span class="admin-ui__item-hint"
              >用于对话头像，建议方形，JPG/PNG，&lt; 800KB</span
            >
          </div>
          <div class="admin-ui__img-actions">
            <van-uploader
              :after-read="onAvatarRead"
              :max-count="1"
              accept="image/*"
            >
              <van-button icon="photograph" size="small" round type="primary">
                上传头像
              </van-button>
            </van-uploader>
          </div>
          <img
            v-if="avatarPreview"
            :src="avatarPreview"
            alt="头像预览"
            class="admin-ui__thumb admin-ui__thumb--round"
          />
        </div>

        <div class="admin-ui__img-block admin-ui__img-block--last">
          <div class="admin-ui__img-head">
            <span class="admin-ui__item-label">助手形象</span>
            <span class="admin-ui__item-hint"
              >用于欢迎页，建议 9:16，JPG/PNG，&lt; 800KB</span
            >
          </div>
          <div class="admin-ui__img-actions">
            <van-uploader
              :after-read="onCharacterRead"
              :max-count="1"
              accept="image/*"
            >
              <van-button icon="photograph" size="small" round type="primary">
                上传形象
              </van-button>
            </van-uploader>
          </div>
          <img
            v-if="characterPreview"
            :src="characterPreview"
            alt="形象预览"
            class="admin-ui__thumb admin-ui__thumb--character"
          />
        </div>
      </div>
    </section>

    <div class="admin-ui__actions">
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--primary"
        @click="onSave"
      >
        保存配置
      </button>
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--light"
        @click="goPreviewChat"
      >
        保存并预览聊天页
      </button>
      <button
        type="button"
        class="admin-ui__btn admin-ui__btn--outline"
        @click="onReset"
      >
        恢复 JSON 默认
      </button>
    </div>
  </div>
</template>

<style scoped>
.admin-ui {
  min-height: 100vh;
  padding-bottom: 32px;
  background: #f5f6f8;
}

.admin-page__nav:deep(.van-nav-bar) {
  width: 100%;
  max-width: 430px;
}

.admin-ui__block {
  margin: 12px 16px 10px;
}

.admin-ui__block-title {
  margin: 14px 0 10px;
  padding-left: 4px;
  font-size: 16px;
  font-weight: 600;
  color: #646566;
  line-height: 1.4;
}

.admin-ui__panel {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

.admin-ui__panel--card {
  background: #fff;
}

.admin-ui__panel--card :deep(.van-cell),
.admin-ui__panel--card :deep(.van-field) {
  font-size: 14px;
  line-height: 1.5;
  background: #fff;
}

.admin-ui__panel--card :deep(.van-field__label) {
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.admin-ui__panel--card :deep(.van-field__control),
.admin-ui__panel--card :deep(.van-field__control::placeholder) {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.admin-ui__panel--card :deep(.van-field__word-limit) {
  font-size: 12px;
  color: #969799;
}

.admin-ui__item-label {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  line-height: 1.5;
}

.admin-ui__item-hint {
  font-size: 11px;
  color: #969799;
  font-weight: 400;
  line-height: 1.4;
}

.admin-ui__preview-stage {
  position: relative;
  min-height: 180px;
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}

.admin-ui__preview-topbar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 74px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(10px);
}

.admin-ui__preview-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.admin-ui__preview-avatar-shell {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 4px 14px rgba(58, 87, 112, 0.12);
}

.admin-ui__preview-avatar {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 50%;
}

.admin-ui__preview-brand-text {
  min-width: 0;
}

.admin-ui__preview-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 16px;
  line-height: 1.2;
  color: #111;
}

.admin-ui__preview-brand-text p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.2;
  color: #414a53;
}

.admin-ui__preview-body {
  position: relative;
  z-index: 1;
  min-height: 106px;
  padding: 16px 14px;
  display: flex;
  align-items: flex-start;
}

.admin-ui__preview-bubble {
  max-width: 82%;
  padding: 9px 12px;
  background: #fff;
  border-radius: 14px;
  border-top-left-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  text-align: left;
}

.admin-ui__color-input {
  width: 38px;
  height: 25px;
  padding: 0;
  border: none;
  outline: none;
  background: none;
  border-radius: 6px;
  box-shadow: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.admin-ui__color-input::-webkit-color-swatch-wrapper {
  padding: 0;
  border: none;
}

.admin-ui__color-input::-webkit-color-swatch {
  border: none;
  border-radius: 8px;
}

.admin-ui__color-input::-moz-color-swatch {
  border: none;
  border-radius: 8px;
}

.admin-ui__img-block {
  padding: 14px 16px 12px;
  border-bottom: 1px solid #f0f1f3;
}

.admin-ui__img-block--last {
  border-bottom: none;
}

.admin-ui__img-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-bottom: 10px;
}

.admin-ui__img-actions {
  display: flex;
  align-items: flex-start;
}

.admin-ui__thumb {
  margin-top: 12px;
  object-fit: cover;
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}

.admin-ui__thumb--wide {
  width: 100%;
  max-height: 72px;
}

.admin-ui__thumb--round {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 14px rgba(58, 87, 112, 0.12);
}

.admin-ui__thumb--character {
  width: 72px;
  height: 128px;
  object-fit: cover;
}

.admin-ui__actions {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-ui__btn {
  display: block;
  width: 100%;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 19px;
  font-size: 14px;
  font-weight: 500;
  line-height: 36px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
}

.admin-ui__btn:active {
  opacity: 0.88;
}

.admin-ui__btn--primary {
  background: var(--admin-primary, #07c160);
  color: #fff;
}

.admin-ui__btn--light {
  background: var(--admin-primary-light, #e8f8ef);
  color: var(--admin-primary, #07c160);
  border: 1px solid var(--admin-primary, #07c160);
}

.admin-ui__btn--outline {
  background: #fff;
  /* border: 1px solid var(--admin-primary, #07c160); */
  color: var(--admin-primary, #07c160);
  box-shadow: none;
}
</style>
