<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { WELCOME_AI_STATUS_LINES } from '@/utils/welcomeLayout'

const statusText = ref<string>(WELCOME_AI_STATUS_LINES[0])
const fading = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let index = 0

function rotateStatus() {
  fading.value = true
  window.setTimeout(() => {
    index = (index + 1) % WELCOME_AI_STATUS_LINES.length
    statusText.value = WELCOME_AI_STATUS_LINES[index]!
    fading.value = false
  }, 220)
}

onMounted(() => {
  timer = setInterval(rotateStatus, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <p
    class="welcome-ai-status"
    :class="{ 'welcome-ai-status--fading': fading }"
    aria-live="polite"
  >
    {{ statusText }}
  </p>
</template>

<style scoped>
.welcome-ai-status {
  min-height: 20px;
  margin: 0 4px 8px;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  transition: opacity 220ms ease;
}

.welcome-ai-status--fading {
  opacity: 0;
}
</style>
