import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAssistantUi } from '@/api/business'
import defaultUiConfig from '@/mock/assistant/ui_config.json'
import { applyChatTheme } from '@/utils/theme'
import { mergeUiConfig, setAdminUiOverride, type AdminUiPatch } from '@/utils/adminUiConfig'
import type { AssistantMotionId, AssistantUiConfig } from '@/types'

export const useAssistantStore = defineStore('assistant', () => {
  const apiBaseConfig = ref<AssistantUiConfig>(defaultUiConfig as AssistantUiConfig)
  const uiConfig = ref<AssistantUiConfig>(mergeUiConfig(defaultUiConfig as AssistantUiConfig))
  const motion = ref<AssistantMotionId>('idle')
  let motionTimer: ReturnType<typeof setTimeout> | null = null

  const primaryColor = computed(() => uiConfig.value.primaryColor)
  const primaryColorDark = computed(
    () => uiConfig.value.primaryColorDark ?? uiConfig.value.primaryColor,
  )
  const dialogTitle = computed(() => uiConfig.value.dialogTitle)
  const assistantName = computed(() => uiConfig.value.assistantName)
  const assistantNickname = computed(() => uiConfig.value.assistantNickname)
  const assistantAvatarUrl = computed(() => uiConfig.value.assistantAvatarUrl)
  const memberDefaultAvatarUrl = computed(
    () => uiConfig.value.memberDefaultAvatarUrl || '/member/default-avatar.svg',
  )
  const defaultImageUrl = computed(() => uiConfig.value.defaultImageUrl)
  const currentMotionUrl = computed(() => {
    const found = uiConfig.value.motions.find((m) => m.actionId === motion.value)
    return found?.assetUrl || uiConfig.value.assistantAvatarUrl
  })

  function syncUiConfig(base = apiBaseConfig.value) {
    uiConfig.value = mergeUiConfig(base)
    applyChatTheme(uiConfig.value)
    return uiConfig.value
  }

  async function loadConfig(force = false) {
    if (force) {
      const { data: res } = await fetchAssistantUi()
      if (res.code === 200) {
        apiBaseConfig.value = res.data
      }
    }
    return syncUiConfig()
  }

  function applyAdminPatch(patch: AdminUiPatch) {
    setAdminUiOverride(patch)
    syncUiConfig()
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
    primaryColorDark,
    dialogTitle,
    assistantName,
    assistantNickname,
    assistantAvatarUrl,
    memberDefaultAvatarUrl,
    defaultImageUrl,
    currentMotionUrl,
    loadConfig,
    applyAdminPatch,
    clearAdminPatch,
    setMotion,
    resetMotion,
  }
})
