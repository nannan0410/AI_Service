<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { showToast } from "vant";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useAssistantStore } from "@/store/assistantStore";
import { useAiExecutionStore } from "@/store/aiExecutionStore";
import { sendChatMessage } from "@/ai/llm";
import MessageBubble from "@/components/chat/MessageBubble.vue";
import ToolProcessPanel from "@/components/chat/ToolProcessPanel.vue";
import welcomeTemplates from "@/mock/assistant/welcome_templates.json";
import type { LlmMessage, PersonaId } from "@/types";

interface WelcomeAction {
  id: string;
  icon: string;
  text: string;
  prompt: string;
  color?: string;
}

interface WelcomeQuestion {
  id: string;
  icon: string;
  text: string;
  prompt: string;
  badgeColor?: string;
}

interface ChatWelcomeTemplate {
  personaId: PersonaId;
  title: string;
  subtitle: string;
  body: string;
  highlights: string[];
  suggestedQuestions?: WelcomeQuestion[];
  quickActions?: WelcomeAction[];
}

const authStore = useAuthStore();
const chatStore = useChatStore();
const assistantStore = useAssistantStore();
const aiStore = useAiExecutionStore();

const input = ref("");
const listRef = ref<HTMLElement | null>(null);
const pendingPrompt = ref<string | null>(null);
const templates = welcomeTemplates as ChatWelcomeTemplate[];

const pageStyle = computed(() => {
  const bg = assistantStore.uiConfig?.chatBackgroundUrl;
  return bg
    ? {
        "--chat-bg-image": `url(${bg})`,
      }
    : {};
});

const todayKey = computed(() => new Date().toDateString());
const assistantNickname = computed(() => assistantStore.assistantNickname);
const assistantTitle = computed(() => assistantStore.dialogTitle);
const avatarUrl = computed(() => assistantStore.assistantAvatarUrl);
const characterUrl = computed(() => assistantStore.defaultImageUrl);
const inputPlaceholder = computed(
  () => `有问题，问${assistantNickname.value}吧~`
);
const currentWelcomeTemplate = computed(() => {
  const personaId = authStore.personaId || "demo_new";
  return templates.find((item) => item.personaId === personaId) ?? templates[0];
});
const welcomeBody = computed(() => {
  const fallbackBody = assistantStore.uiConfig.greeting.trim();
  const templateBody = currentWelcomeTemplate.value?.body?.trim();
  return (fallbackBody || templateBody).replace(
    /\{\{\s*(nickname|assistantNickname)\s*\}\}/g,
    assistantNickname.value
  );
});
const suggestedQuestions = computed(
  () => currentWelcomeTemplate.value?.suggestedQuestions ?? []
);
const quickActions = computed(
  () => currentWelcomeTemplate.value?.quickActions ?? []
);
const hasTodayConversation = computed(() =>
  chatStore.messages.some((message) => {
    if (message.type !== "text") return false;
    if (message.role !== "user" && message.role !== "assistant") return false;
    return new Date(message.createdAt).toDateString() === todayKey.value;
  })
);
const showWelcome = computed(() => !hasTodayConversation.value);

onMounted(async () => {
  await assistantStore.loadConfig(true);
  if (authStore.memberId) {
    chatStore.loadForUser(authStore.memberId, assistantNickname.value);
  }
  assistantStore.setMotion("wave", 2200);
});

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  });
}

function onRestoreChat() {
  input.value = "";
  pendingPrompt.value = null;
  chatStore.sending = false;
  chatStore.clearMessages(assistantNickname.value);
  assistantStore.setMotion("wave", 2200);
}

function buildHistory(): LlmMessage[] {
  return chatStore.messages
    .filter(
      (m) =>
        m.type === "text" &&
        (m.role === "user" || m.role === "assistant") &&
        m.content
    )
    .slice(-10)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content!,
    }));
}

async function onStartChat(prompt?: string) {
  if (prompt) {
    pendingPrompt.value = prompt;
    await nextTick();
    input.value = prompt;
    await onSend();
  }
}

async function onSend() {
  const text = (pendingPrompt.value || input.value).trim();
  pendingPrompt.value = null;
  if (!text || chatStore.sending) return;

  chatStore.addUserMessage(text);
  input.value = "";
  scrollToBottom();

  chatStore.sending = true;
  assistantStore.setMotion("thinking");
  aiStore.start(["理解用户意图", "调用 AI 模型", "组织回复"]);

  try {
    aiStore.completeStep(0);
    const reply = await sendChatMessage(
      buildHistory(),
      text,
      assistantStore.uiConfig
    );
    aiStore.completeStep(1);
    aiStore.completeStep(2);
    chatStore.addAssistantMessage(reply);
    aiStore.finish(true);
    assistantStore.setMotion("nod");
  } catch (e) {
    aiStore.finish(false);
    assistantStore.setMotion("shake");
    showToast(e instanceof Error ? e.message : "发送失败");
  } finally {
    chatStore.sending = false;
    scrollToBottom();
  }
}
</script>

<template>
  <div class="chat-page" :style="pageStyle">
    <header class="chat-page__topbar">
      <button class="chat-page__back" type="button" @click="$router.back()">
        <van-icon name="arrow-left" size="20" />
      </button>

      <button
        v-if="!showWelcome"
        class="chat-page__restore"
        type="button"
        aria-label="一键开启新对话"
        @click="onRestoreChat"
      >
        <img src="/restore.svg" alt="" class="chat-page__restore-icon" />
      </button>

      <div class="chat-page__brand">
        <div class="chat-page__avatar-shell">
          <img
            :src="avatarUrl"
            :alt="assistantNickname"
            class="chat-page__avatar"
          />
        </div>
        <div class="chat-page__brand-text">
          <div class="chat-page__name-row">
            <strong>{{ assistantNickname }}</strong>
            <span>✨</span>
          </div>
          <p>{{ assistantTitle }}</p>
        </div>
      </div>
    </header>

    <main v-if="showWelcome" class="chat-page__welcome">
      <section class="chat-page__hero" aria-label="欢迎介绍">
        <div class="chat-page__cloud">
          <p>{{ welcomeBody }}</p>
        </div>
        <img
          :src="characterUrl"
          :alt="`${assistantNickname}导游形象`"
          class="chat-page__character"
        />
      </section>

      <section class="chat-page__suggest-card">
        <div class="chat-page__section-title">
          <strong>猜你想问</strong>
          <span>💡</span>
        </div>
        <button
          v-for="(item, index) in suggestedQuestions"
          :key="item.id"
          type="button"
          class="chat-page__question"
          @click="onStartChat(item.prompt)"
        >
          <span
            class="chat-page__question-index"
            :style="{ background: item.badgeColor }"
          >
            {{ index + 1 }}
          </span>
          <span class="chat-page__question-text">{{ item.text }}</span>
          <span class="chat-page__question-icon">{{ item.icon }}</span>
          <van-icon name="arrow" color="#888" size="14" />
        </button>
      </section>
    </main>

    <template v-else>
      <ToolProcessPanel />

      <div ref="listRef" class="chat-page__messages">
        <MessageBubble
          v-for="msg in chatStore.messages"
          :key="msg.id"
          :message="msg"
        />
      </div>
    </template>

    <footer class="chat-page__footer">
      <div class="chat-page__quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.id"
          type="button"
          class="chat-page__quick-action"
          :style="{ '--action-color': action.color }"
          @click="onStartChat(action.prompt)"
        >
          <span class="chat-page__quick-action-icon">{{ action.icon }}</span>
          <span class="chat-page__quick-action-text">{{ action.text }}</span>
        </button>
      </div>

      <div class="chat-page__input-bar">
        <van-field
          v-model="input"
          :placeholder="inputPlaceholder"
          :disabled="chatStore.sending"
          @keyup.enter="onSend"
        >
          <template #left-icon>
            <van-icon name="smile-o" />
          </template>
          <template #button>
            <button
              type="button"
              class="chat-page__send-btn"
              :disabled="chatStore.sending"
              @click="onSend"
            >
              <van-loading v-if="chatStore.sending" size="16" color="#fff" />
              <van-icon v-else name="guide-o" size="22" />
            </button>
          </template>
        </van-field>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.chat-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: #f6fbff;
  background-image: var(--chat-bg-image, none);
  background-size: cover;
  background-position: center top;
  color: #202124;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

.chat-page::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: "";
  background: radial-gradient(
      circle at 18% 10%,
      rgba(255, 255, 255, 0.9),
      transparent 28%
    ),
    linear-gradient(
      180deg,
      rgba(215, 241, 255, 0.76) 0%,
      rgba(255, 248, 237, 0.92) 62%,
      #fffaf1 100%
    );
  pointer-events: none;
}

.chat-page__topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 74px;
  padding: calc(env(safe-area-inset-top) + 10px) 18px 10px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(10px);
}

.chat-page__back {
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 14px;
  color: #222;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 8px 22px rgba(58, 87, 112, 0.12);
}

.chat-page__restore {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 8px 22px rgba(58, 87, 112, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-page__restore-icon {
  width: 23px;
  height: 23px;
}

.chat-page__restore:active {
  opacity: 0.88;
}

.chat-page__brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
  padding-right: 44px; /* 预留右侧“新对话”按钮空间 */
}

.chat-page__avatar-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 4px 14px rgba(58, 87, 112, 0.12);
}

.chat-page__avatar {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 50%;
}

.chat-page__brand-text {
  min-width: 0;
}

.chat-page__name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 16px;
  line-height: 1.2;
  color: #111;
}

.chat-page__brand-text p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.2;
  color: #414a53;
}

.chat-page__welcome {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 18px 96px;
}

.chat-page__hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 26%) minmax(0, 74%);
  align-items: start;
  flex: 1;
  min-height: 0;
  padding: 8px 0 0;
}

.chat-page__cloud {
  position: relative;
  top: 10px;
  width: 160px;
  z-index: 1;
  padding: 16px;
  color: #202124;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 26px 26px 10px 26px;
  box-shadow: 0 12px 30px rgba(95, 112, 132, 0.13);
  backdrop-filter: blur(10px);
}

.chat-page__cloud::after {
  position: absolute;
  right: -10px;
  bottom: 28px;
  width: 22px;
  height: 22px;
  content: "";
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 12px 10px 0 rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
}

.chat-page__cloud p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.chat-page__character {
  position: relative;
  z-index: 2;
  align-self: end;
  justify-self: end;
  width: 260px;
  object-fit: contain;
  margin: 18px -26px 0 0;
  filter: drop-shadow(0 14px 22px rgba(145, 103, 68, 0.16));
  animation: youyou-wave 2.2s ease-in-out 0.25s 2;
  transform-origin: 50% 100%;
}

.chat-page__suggest-card {
  z-index: 9 !important;
  position: relative;
  z-index: 1;
  margin-top: -12px;
  padding: 13px 13px 10px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  box-shadow: 0 14px 32px rgba(77, 95, 117, 0.12);
  backdrop-filter: blur(10px);
}

.chat-page__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding-left: 4px;
  font-size: 14px;
  color: #333;
}

.chat-page__question {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 28px 14px;
  align-items: center;
  width: 100%;
  height: 36px;
  line-height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 14px;
  color: #333;
  text-align: left;
  background: transparent;
  border-bottom: 1px solid #f6f6f6;
}

.chat-page__question:last-child {
  border-bottom: none;
}

.chat-page__question-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: #fff;
  font-size: 12px;
  border-radius: 50%;
}

.chat-page__question-text {
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.chat-page__question-icon {
  font-size: 16px;
  text-align: center;
}

.chat-page__messages {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 12px 0 118px;
}

.chat-page__footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  padding: 8px 18px calc(env(safe-area-inset-bottom) + 10px);
  background: linear-gradient(
    180deg,
    rgba(255, 250, 241, 0),
    rgba(255, 250, 241, 0.96) 20%,
    #fffaf1 100%
  );
}

.chat-page__quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.chat-page__quick-actions::-webkit-scrollbar {
  display: none;
}

.chat-page__quick-action {
  flex: 0 0 calc((100% - 24px) / 4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 4px 6px;
  border: none;
  border-radius: 14px;
  color: #fff;
  background: var(--action-color, var(--chat-primary));
}

.chat-page__quick-action-icon {
  flex-shrink: 0;
  font-size: 13px;
}

.chat-page__quick-action-text {
  font-size: 11px;
  line-height: 15px;
}

.chat-page__input-bar {
  overflow: hidden;
  background: #fff;
  border-radius: 23px;
  box-shadow: 0 10px 24px rgba(73, 85, 100, 0.14);
}

.chat-page__input-bar :deep(.van-cell) {
  align-items: center;
  padding: 3px 8px 3px 13px;
  background: transparent;
}

.chat-page__input-bar :deep(.van-field__left-icon) {
  margin-right: 8px;
  color: var(--chat-primary);
  font-size: 22px;
}

.chat-page__input-bar :deep(.van-field__control) {
  font-size: 13px;
  color: #333;
}

.chat-page__input-bar :deep(.van-field__control::placeholder) {
  color: #acacac;
}

.chat-page__send-btn {
  margin: 1px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: var(--action-color, var(--chat-primary));
  box-shadow: 0 8px 18px rgba(255, 126, 69, 0.15);
}

.chat-page__send-btn:disabled {
  opacity: 0.72;
}

@keyframes youyou-wave {
  0%,
  100% {
    transform: rotate(0deg) translateY(0);
  }

  25% {
    transform: rotate(-4deg) translateY(-2px);
  }

  50% {
    transform: rotate(4deg) translateY(0);
  }

  75% {
    transform: rotate(-3deg) translateY(-1px);
  }
}

@media (max-width: 390px) {
  .chat-page__welcome {
    padding-right: 14px;
    padding-left: 14px;
  }

  .chat-page__cloud {
    padding: 17px 15px;
  }

  .chat-page__quick-actions {
    gap: 6px;
  }

  .chat-page__quick-action strong {
    font-size: 11px;
  }
}
</style>
