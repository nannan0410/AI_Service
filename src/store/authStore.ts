import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { wechatMockLogin, fetchMe, logout as logoutApi } from '@/api/auth'
import { setToken, setAuthUser, clearAuth, getToken, getAuthUser } from '@/utils/auth'
import { createDemoAuthResult, getDemoUserInfo, parsePersonaFromToken } from '@/utils/demoAuth'
import type { PersonaId, UserInfo } from '@/types'

function shouldUseLocalDemoLogin(error: unknown): boolean {
  if (!import.meta.env.DEV) return false
  if (!axios.isAxiosError(error)) return true
  const status = error.response?.status
  return !status || status === 404
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getToken())
  const userInfo = ref<UserInfo | null>(getAuthUser())
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value && !!userInfo.value)
  const memberId = computed(() => userInfo.value?.memberId ?? '')
  const personaId = computed(() => userInfo.value?.personaId ?? null)

  async function login(personaId: PersonaId) {
    loading.value = true
    try {
      let authData
      try {
        const { data: res } = await wechatMockLogin(personaId)
        if (res.code !== 200 || !res.data) {
          throw new Error(res.message || '登录失败')
        }
        authData = res.data
      } catch (error) {
        if (!shouldUseLocalDemoLogin(error)) throw error
        console.warn('[demo] Mock 登录接口不可用，使用本地演示登录', error)
        authData = createDemoAuthResult(personaId)
      }
      token.value = authData.token
      userInfo.value = authData.userInfo
      setToken(authData.token)
      setAuthUser(authData.userInfo)
      return authData
    } finally {
      loading.value = false
    }
  }

  async function restoreSession() {
    if (!token.value) return false
    try {
      const { data: res } = await fetchMe()
      if (res.code !== 200 || !res.data) {
        throw new Error(res.message || '会话无效')
      }
      userInfo.value = res.data
      setAuthUser(res.data)
      return true
    } catch (error) {
      const personaId = token.value ? parsePersonaFromToken(token.value) : null
      if (personaId && shouldUseLocalDemoLogin(error)) {
        userInfo.value = getDemoUserInfo(personaId)
        setAuthUser(userInfo.value)
        return true
      }
      clearAuth()
      token.value = null
      userInfo.value = null
      return false
    }
  }

  async function logout() {
    try {
      await logoutApi()
    } catch {
      // ignore mock logout errors
    }
    clearAuth()
    token.value = null
    userInfo.value = null
  }

  return {
    token,
    userInfo,
    loading,
    isLoggedIn,
    memberId,
    personaId,
    login,
    restoreSession,
    logout,
  }
})
