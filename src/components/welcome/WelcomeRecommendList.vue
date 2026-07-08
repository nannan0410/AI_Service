<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WelcomeQuestionConfig } from '@/types/businessConfig'
import { WELCOME_RECOMMEND_VISIBLE } from '@/utils/welcomeLayout'

const props = defineProps<{
  questions: WelcomeQuestionConfig[]
  subtitle?: string
}>()

const emit = defineEmits<{
  select: [prompt: string]
}>()

const expanded = ref(false)

const visibleQuestions = computed(() =>
  props.questions.slice(0, WELCOME_RECOMMEND_VISIBLE),
)

const moreQuestions = computed(() =>
  props.questions.slice(WELCOME_RECOMMEND_VISIBLE),
)

const showMoreButton = computed(() => moreQuestions.value.length > 0)

function onSelect(prompt: string) {
  emit('select', prompt)
}

function toggleMore() {
  expanded.value = !expanded.value
}
</script>

<template>
  <section v-if="questions.length" class="welcome-recommend" aria-label="游游推荐">
    <header class="welcome-recommend__head">
      <h2 class="welcome-recommend__title">
        游游推荐 <span aria-hidden="true">✨</span>
      </h2>
      <p class="welcome-recommend__subtitle">
        {{ subtitle ?? '试试这些热门问题' }}
      </p>
    </header>

    <div class="welcome-recommend__feed">
      <button
        v-for="(item, index) in visibleQuestions"
        :key="item.id"
        type="button"
        class="welcome-recommend-card"
        :style="{ animationDelay: `${index * 80}ms` }"
        @click="onSelect(item.prompt)"
      >
        <span class="welcome-recommend-card__icon" aria-hidden="true">{{
          item.icon
        }}</span>
        <span class="welcome-recommend-card__body">
          <span class="welcome-recommend-card__title">{{ item.text }}</span>
          <span v-if="item.desc" class="welcome-recommend-card__desc">{{
            item.desc
          }}</span>
        </span>
        <span class="welcome-recommend-card__arrow" aria-hidden="true">›</span>
      </button>

      <div
        v-if="expanded"
        class="welcome-recommend__more-list"
      >
        <button
          v-for="(item, index) in moreQuestions"
          :key="item.id"
          type="button"
          class="welcome-recommend-card"
          :style="{ animationDelay: `${index * 100}ms` }"
          @click="onSelect(item.prompt)"
        >
          <span class="welcome-recommend-card__icon" aria-hidden="true">{{
            item.icon
          }}</span>
          <span class="welcome-recommend-card__body">
            <span class="welcome-recommend-card__title">{{ item.text }}</span>
            <span v-if="item.desc" class="welcome-recommend-card__desc">{{
              item.desc
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
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: -26px;
}

.welcome-recommend__head {
  margin-bottom: 6px;
  padding: 0 2px;
}

.welcome-recommend__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 2px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.3;
}

.welcome-recommend__subtitle {
  margin: 0;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.welcome-recommend__feed {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  padding-bottom: 4px;
}

.welcome-recommend-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  max-height: 88px;
  padding: 14px 16px;
  border: none;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 6px 20px rgba(77, 95, 117, 0.07);
  text-align: left;
  cursor: pointer;
  animation: welcome-recommend-fade-in 400ms ease both;
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    background 220ms ease;
}

.welcome-recommend-card:active {
  transform: scale(0.985);
  background: rgba(255, 255, 255, 0.96);
}

.welcome-recommend-card__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  border-radius: 14px;
  background: rgba(247, 248, 250, 0.95);
}

.welcome-recommend-card__body {
  flex: 1;
  min-width: 0;
}

.welcome-recommend-card__title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.welcome-recommend-card__desc {
  margin-top: 3px;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.welcome-recommend-card__arrow {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 300;
  color: #c8ced4;
  line-height: 1;
}

.welcome-recommend__more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  margin-top: 2px;
  padding: 8px 0 4px;
  border: none;
  background: none;
  font-size: 13px;
  color: #999;
  cursor: pointer;
}

.welcome-recommend__more-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@keyframes welcome-recommend-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 390px) {
  .welcome-recommend-card {
    padding: 12px 14px;
    min-height: 68px;
  }

  .welcome-recommend-card__icon {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }
}
</style>
