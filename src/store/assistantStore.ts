import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAssistantUi } from '@/api/business'
import { applyChatTheme } from '@/utils/theme'
import { mergeUiConfig, setAdminUiOverride, type AdminUiPatch } from '@/utils/adminUiConfig'
import type { AssistantMotionId, AssistantUiConfig } from '@/types'

export const useAssistantStore = defineStore('assistant', () => {
  const uiConfig = ref<AssistantUiConfig | null>(null)
  const motion = ref<AssistantMotionId>('idle')
  let motionTimer: ReturnType<typeof setTimeout> | null = null

  const primaryColor = computed(() => uiConfig.value?.primaryColor ?? '#07c160')
  const dialogTitle = computed(() => uiConfig.value?.dialogTitle ?? 'AI 助手')

  async function loadConfig(force = false) {
    if (uiConfig.value && !force) return uiConfig.value
    const { data: res } = await fetchAssistantUi()
    if (res.code === 200) {
      uiConfig.value = mergeUiConfig(res.data)
      applyChatTheme(uiConfig.value)
    }
    return uiConfig.value
  }

  function applyAdminPatch(patch: AdminUiPatch) {
    setAdminUiOverride(patch)
    if (uiConfig.value) {
      uiConfig.value = mergeUiConfig(uiConfig.value)
      applyChatTheme(uiConfig.value)
    } else {
      loadConfig(true)
    }
  }

  function clearAdminPatch() {
    setAdminUiOverride(null)
    return loadConfig(true)
  }

  const config = computed(() => uiConfig.value)

  function setMotion(actionId: AssistantMotionId, autoResetMs?: number) {
    motion.value = actionId
    if (motionTimer) clearTimeout(motionTimer)
    const motionConfig = uiConfig.value?.motions.find((m) => m.actionId === actionId)
    const duration = autoResetMs ?? motionConfig?.durationMs
    if (duration && actionId !== 'idle' && actionId !== 'thinking') {
      motionTimer = setTimeout(() => {
        motion.value = uiConfig.value?.defaultMotion ?? 'idle'
      }, duration)
    }
  }

  function resetMotion() {
    if (motionTimer) clearTimeout(motionTimer)
    motion.value = uiConfig.value?.defaultMotion ?? 'idle'
  }

  return {
    uiConfig,
    config,
    motion,
    primaryColor,
    dialogTitle,
    loadConfig,
    applyAdminPatch,
    clearAdminPatch,
    setMotion,
    resetMotion,
  }
})
