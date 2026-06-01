<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useAssistantStore } from '@/store/assistantStore'
import { useAiExecutionStore } from '@/store/aiExecutionStore'
import { sendChatMessage } from '@/ai/llm'
import { isWelcomeDismissed, setWelcomeDismissed } from '@/utils/theme'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import ToolProcessPanel from '@/components/chat/ToolProcessPanel.vue'
import WelcomePanel from '@/components/chat/WelcomePanel.vue'
import AssistantAvatar from '@/components/assistant/AssistantAvatar.vue'
import type { LlmMessage } from '@/types'

const authStore = useAuthStore()
const chatStore = useChatStore()
const assistantStore = useAssistantStore()
const aiStore = useAiExecutionStore()

const input = ref('')
const listRef = ref<HTMLElement | null>(null)
const showWelcome = ref(true)
const pendingPrompt = ref<string | null>(null)

const pageStyle = computed(() => {
  const bg = assistantStore.uiConfig?.chatBackgroundUrl
  return bg
    ? {
        '--chat-bg-image': `url(${bg})`,
      }
    : {}
})

const navTitle = computed(() => assistantStore.dialogTitle)

onMounted(async () => {
  if (authStore.memberId) {
    chatStore.loadForUser(authStore.memberId)
    showWelcome.value = !isWelcomeDismissed(authStore.memberId)
  }
  await assistantStore.loadConfig(true)
})

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  })
}

function buildHistory(): LlmMessage[] {
  return chatStore.messages
    .filter((m) => m.type === 'text' && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-10)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content!,
    }))
}

function dismissWelcome() {
  showWelcome.value = false
  if (authStore.memberId) {
    setWelcomeDismissed(authStore.memberId, true)
  }
}

async function onStartChat(prompt?: string) {
  dismissWelcome()
  if (prompt) {
    pendingPrompt.value = prompt
    await nextTick()
    input.value = prompt
    await onSend()
  }
}

async function onSend() {
  const text = (pendingPrompt.value || input.value).trim()
  pendingPrompt.value = null
  if (!text || chatStore.sending) return

  chatStore.addUserMessage(text)
  input.value = ''
  scrollToBottom()

  chatStore.sending = true
  assistantStore.setMotion('thinking')
  aiStore.start(['理解用户意图', '调用 AI 模型', '组织回复'])

  try {
    aiStore.completeStep(0)
    const reply = await sendChatMessage(buildHistory(), text)
    aiStore.completeStep(1)
    aiStore.completeStep(2)
    chatStore.addAssistantMessage(reply)
    aiStore.finish(true)
    assistantStore.setMotion('nod')
  } catch (e) {
    aiStore.finish(false)
    assistantStore.setMotion('shake')
    showToast(e instanceof Error ? e.message : '发送失败')
  } finally {
    chatStore.sending = false
    scrollToBottom()
  }
}
</script>

<template>
  <div class="chat-page" :style="pageStyle">
    <van-nav-bar :title="navTitle" left-arrow fixed placeholder @click-left="$router.back()" />

    <WelcomePanel v-if="showWelcome" @start-chat="onStartChat" />

    <template v-else>
      <div class="chat-page__header">
        <AssistantAvatar :motion="assistantStore.motion" :size="40" show-name />
      </div>

      <ToolProcessPanel />

      <div ref="listRef" class="chat-page__messages">
        <MessageBubble v-for="msg in chatStore.messages" :key="msg.id" :message="msg" />
      </div>

      <div class="chat-page__input-bar">
        <van-field
          v-model="input"
          placeholder="问我购票、停车、推荐…"
          :disabled="chatStore.sending"
          @keyup.enter="onSend"
        >
          <template #button>
            <van-button
              size="small"
              type="primary"
              class="chat-page__send-btn"
              :loading="chatStore.sending"
              @click="onSend"
            >
              发送
            </van-button>
          </template>
        </van-field>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f2f5;
  background-image: var(--chat-bg-image, none);
  background-size: cover;
  background-position: center top;
}

.chat-page__header {
  display: flex;
  justify-content: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid #eee;
}

.chat-page__messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0 8px;
}

.chat-page__input-bar {
  background: #fff;
  border-top: 1px solid #eee;
  padding-bottom: env(safe-area-inset-bottom);
}

.chat-page__send-btn {
  background: var(--chat-primary, #07c160) !important;
  border-color: var(--chat-primary, #07c160) !important;
}
</style>
