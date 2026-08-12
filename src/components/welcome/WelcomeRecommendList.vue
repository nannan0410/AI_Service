<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WelcomeQuestionConfig } from '@/types/businessConfig'
import { WELCOME_RECOMMEND_VISIBLE } from '@/utils/welcomeLayout'

const props = withDefaults(
  defineProps<{
    questions: WelcomeQuestionConfig[]
    subtitle?: string
    /** 无订单且未授权定位时的在园自报询问 */
    showInParkAsk?: boolean
  }>(),
  {
    subtitle: undefined,
    showInParkAsk: false,
  },
)

const emit = defineEmits<{
  select: [question: WelcomeQuestionConfig]
  'in-park-answer': [inPark: boolean]
}>()

const expanded = ref(false)

const visibleQuestions = computed(() =>
  props.questions.slice(0, WELCOME_RECOMMEND_VISIBLE),
)

const moreQuestions = computed(() =>
  props.questions.slice(WELCOME_RECOMMEND_VISIBLE),
)

const showMoreButton = computed(() => moreQuestions.value.length > 0)

const showSection = computed(
  () => props.showInParkAsk || props.questions.length > 0,
)

function onSelect(question: WelcomeQuestionConfig) {
  emit('select', question)
}

function onInParkAnswer(inPark: boolean) {
  emit('in-park-answer', inPark)
}

function toggleMore() {
  expanded.value = !expanded.value
}

function actionHint(item: WelcomeQuestionConfig): string {
  if (item.pinTop) {
    const target = item.target || 'chat'
    if (target === 'page' || target === 'h5' || target === 'mini_program') {
      return '置顶推荐 · 点击前往'
    }
    return '置顶推荐 · 点击开聊'
  }
  return ''
}
</script>

<template>
  <section
    v-if="showSection"
    class="welcome-recommend"
    aria-label="游游推荐"
  >
    <header class="welcome-recommend__head">
      <h2 class="welcome-recommend__title">
        游游推荐 <span aria-hidden="true">✨</span>
      </h2>
      <p class="welcome-recommend__subtitle">
        {{ subtitle ?? '试试这些热门问题' }}
      </p>
    </header>

    <div
      v-if="showInParkAsk"
      class="welcome-recommend__inpark"
      role="group"
      aria-label="确认是否在园"
    >
      <p class="welcome-recommend__inpark-text">
        您现在在园里吗？点一下状态，推荐会更准～
      </p>
      <div class="welcome-recommend__inpark-actions">
        <button
          type="button"
          class="welcome-recommend__inpark-btn welcome-recommend__inpark-btn--primary"
          @click="onInParkAnswer(true)"
        >
          我在园内
        </button>
        <button
          type="button"
          class="welcome-recommend__inpark-btn"
          @click="onInParkAnswer(false)"
        >
          还没到园
        </button>
      </div>
    </div>

    <div class="welcome-recommend__feed">
      <button
        v-for="(item, index) in visibleQuestions"
        :key="item.id"
        type="button"
        class="welcome-recommend-card"
        :class="{ 'welcome-recommend-card--pin': item.pinTop }"
        :style="{ animationDelay: `${index * 80}ms` }"
        @click="onSelect(item)"
      >
        <span class="welcome-recommend-card__icon" aria-hidden="true">{{
          item.icon
        }}</span>
        <span class="welcome-recommend-card__body">
          <span class="welcome-recommend-card__title">
            <span v-if="item.pinTop" class="welcome-recommend-card__badge">置顶</span>
            {{ item.text }}
          </span>
          <span v-if="item.desc || actionHint(item)" class="welcome-recommend-card__desc">{{
            item.desc || actionHint(item)
          }}</span>
        </span>
        <span class="welcome-recommend-card__arrow" aria-hidden="true">›</span>
      </button>

      <div v-if="expanded" class="welcome-recommend__more-list">
        <button
          v-for="(item, index) in moreQuestions"
          :key="item.id"
          type="button"
          class="welcome-recommend-card"
          :class="{ 'welcome-recommend-card--pin': item.pinTop }"
          :style="{ animationDelay: `${index * 100}ms` }"
          @click="onSelect(item)"
        >
          <span class="welcome-recommend-card__icon" aria-hidden="true">{{
            item.icon
          }}</span>
          <span class="welcome-recommend-card__body">
            <span class="welcome-recommend-card__title">
              <span v-if="item.pinTop" class="welcome-recommend-card__badge">置顶</span>
              {{ item.text }}
            </span>
            <span v-if="item.desc || actionHint(item)" class="welcome-recommend-card__desc">{{
              item.desc || actionHint(item)
            }}</span>
          </span>
          <span class="welcome-recommend-card__arrow" aria-hidden="true">›</span>
        </button>
      </div>

      <button
        v-if="showMoreButton"
        type="button"
        class="welcome-recommend__more"
        @click="toggleMore"
      >
        {{ expanded ? '收起推荐' : '查看更多推荐' }}
        <span aria-hidden="true">{{ expanded ? '‹' : '›' }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.welcome-recommend {
  margin-top: 8px;
  padding: 0 4px;
}

.welcome-recommend__head {
  margin-bottom: 10px;
}

.welcome-recommend__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1f2a37;
  line-height: 1.3;
}

.welcome-recommend__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8a94a0;
  line-height: 1.4;
}

.welcome-recommend__inpark {
  margin-bottom: 10px;
  padding: 12px 12px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 6px 16px rgba(95, 112, 132, 0.1);
}

.welcome-recommend__inpark-text {
  margin: 0 0 10px;
  font-size: 13px;
  color: #3d4a5c;
  line-height: 1.5;
}

.welcome-recommend__inpark-actions {
  display: flex;
  gap: 8px;
}

.welcome-recommend__inpark-btn {
  flex: 1;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid #ebedf0;
  border-radius: 999px;
  background: #fff;
  color: #323233;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.welcome-recommend__inpark-btn--primary {
  border-color: transparent;
  background: var(--chat-primary, #07c160);
  color: #fff;
}

.welcome-recommend__inpark-btn:active {
  opacity: 0.88;
}

.welcome-recommend__feed {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.welcome-recommend-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 12px 12px 10px;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 6px 16px rgba(95, 112, 132, 0.08);
  text-align: left;
  cursor: pointer;
  animation: welcome-rec-in 420ms ease both;
}

.welcome-recommend-card--pin {
  box-shadow:
    0 0 0 1.5px rgba(7, 193, 96, 0.35),
    0 6px 16px rgba(95, 112, 132, 0.08);
}

.welcome-recommend-card:active {
  opacity: 0.9;
}

.welcome-recommend-card__icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f3f6f8;
  font-size: 18px;
}

.welcome-recommend-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.welcome-recommend-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
  line-height: 1.35;
}

.welcome-recommend-card__badge {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(7, 193, 96, 0.12);
  color: #07c160;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
}

.welcome-recommend-card__desc {
  font-size: 12px;
  color: #8a94a0;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.welcome-recommend-card__arrow {
  flex-shrink: 0;
  color: #c0c5cc;
  font-size: 18px;
  line-height: 1;
}

.welcome-recommend__more-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.welcome-recommend__more {
  margin-top: 2px;
  padding: 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #646566;
  font-size: 13px;
  cursor: pointer;
}

@keyframes welcome-rec-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
