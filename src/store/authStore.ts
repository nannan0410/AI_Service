import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wechatMockLogin, fetchMe, logout as logoutApi } from '@/api/auth'
import { setToken, setAuthUser, clearAuth, getToken, getAuthUser } from '@/utils/auth'
import type { PersonaId, UserInfo } from '@/types'

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
      const { data: res } = await wechatMockLogin(personaId)
      if (res.code !== 200 || !res.data) {
        throw new Error(res.message || '登录失败')
      }
      token.value = res.data.token
      userInfo.value = res.data.userInfo
      setToken(res.data.token)
      setAuthUser(res.data.userInfo)
      return res.data
    } finally {
      loading.value = false
    }
  }

  async function restoreSession() {
    if (!token.value) return false
    try {
      const { data: res } = await fetchMe()
      if (res.code !== 200 || !res.data) {
        clearAuth()
        token.value = null
        userInfo.value = null
        return false
      }
      userInfo.value = res.data
      setAuthUser(res.data)
      return true
    } catch {
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
