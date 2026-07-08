<script setup lang="ts">
import { DEFAULT_ABILITY_ROWS } from '@/utils/welcomeLayout'

defineProps<{
  nickname: string
  characterUrl: string
  abilityRows?: readonly (readonly [string, string])[]
}>()
</script>

<template>
  <section class="welcome-hero" aria-label="欢迎介绍">
    <div class="welcome-hero__main">
      <div class="welcome-hero__bubble">
        <p class="welcome-hero__greeting">
          我是{{ nickname }} <span aria-hidden="true">✨</span>
        </p>
        <p class="welcome-hero__help">能帮你：</p>
        <div class="welcome-hero__abilities">
          <div
            v-for="(row, rowIndex) in abilityRows ?? DEFAULT_ABILITY_ROWS"
            :key="rowIndex"
            class="welcome-hero__ability-row"
          >
            <span
              v-for="(text, colIndex) in row"
              :key="colIndex"
              class="welcome-hero__ability-item"
            >
              {{ text }}
            </span>
          </div>
        </div>
      </div>
      <div class="welcome-hero__character-wrap">
        <span class="welcome-hero__cloud" aria-hidden="true" />
        <img
          :src="characterUrl"
          :alt="`${nickname}导游形象`"
          class="welcome-hero__character"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.welcome-hero {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin-bottom: 0;
  overflow: visible;
}

.welcome-hero__main {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 10px;
  width: 100%;
  height: 280px;
}

.welcome-hero__cloud {
  position: absolute;
  z-index: 0;
  right: 4px;
  bottom: 72px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff;
  opacity: 0.88;
  filter: drop-shadow(0 4px 12px rgba(120, 168, 210, 0.2));
  box-shadow:
    28px 6px 0 -3px #fff,
    54px 10px 0 -7px rgba(255, 255, 255, 0.96),
    14px -16px 0 -5px rgba(255, 255, 255, 0.94),
    -20px 4px 0 -4px rgba(255, 255, 255, 0.9);
  pointer-events: none;
  animation: welcome-cloud-drift 7s ease-in-out infinite;
}

@keyframes welcome-cloud-drift {
  0%,
  100% {
    transform: translateX(0) translateY(0);
  }
  50% {
    transform: translateX(6px) translateY(-3px);
  }
}

.welcome-hero__bubble {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  align-self: flex-start;
  width: fit-content;
  padding: 20px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 10px 24px rgba(95, 112, 132, 0.1);
  line-height: 1.5;
  animation: welcome-cloud-in 500ms ease both;
}

.welcome-hero__bubble::after {
  content: "";
  position: absolute;
  right: -9px;
  top: 28%;
  margin-top: -8px;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 10px solid rgba(255, 255, 255, 0.92);
  filter: drop-shadow(2px 3px 4px rgba(95, 112, 132, 0.07));
}

.welcome-hero__greeting {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #111;
  line-height: 1.5;
}

.welcome-hero__help {
  margin: 0 0 6px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.welcome-hero__abilities {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}

.welcome-hero__ability-row {
  display: flex;
  align-items: center;
  gap: 32px;
}

.welcome-hero__ability-item {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  line-height: 1.5;
  color: #333;
  white-space: nowrap;
}

.welcome-hero__ability-item::before {
  content: "·";
  flex-shrink: 0;
  margin-right: 4px;
  color: #bbb;
}

.welcome-hero__character-wrap {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  height: 280px;
  overflow: visible;
  pointer-events: none;
  animation: welcome-char-in 800ms ease both;
}

.welcome-hero__character {
  position: relative;
  z-index: 1;
  display: block;
  width: auto;
  height: 280px;
  max-height: 280px;
  object-fit: contain;
  object-position: bottom right;
  filter: drop-shadow(0 10px 18px rgba(145, 103, 68, 0.12));
  animation: welcome-char-float 5s ease-in-out 800ms infinite;
  transform-origin: 50% 100%;
}

@keyframes welcome-cloud-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes welcome-char-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes welcome-char-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@media (max-width: 390px) {
  .welcome-hero__main {
    height: 268px;
    gap: 8px;
  }

  .welcome-hero__bubble {
    padding: 20px;
    border-radius: 20px;
  }

  .welcome-hero__ability-row {
    gap: 28px;
  }

  .welcome-hero__ability-item {
    font-size: 10px;
  }

  .welcome-hero__character-wrap {
    height: 268px;
  }

  .welcome-hero__character {
    height: 268px;
    max-height: 268px;
  }
}
</style>
