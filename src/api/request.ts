import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getToken, clearAuth } from '@/utils/auth'
import router from '@/router'
import { useScenicStore } from '@/store/scenicStore'
import { useConversationStore } from '@/store/conversationStore'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
})

request.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  try {
    const scenicStore = useScenicStore()
    const conversationStore = useConversationStore()
    if (scenicStore.currentScenicId) {
      config.headers['X-Scenic-Id'] = scenicStore.currentScenicId
    }
    if (conversationStore.conversationId) {
      config.headers['X-Conversation-Id'] = conversationStore.conversationId
    }
  } catch {
    /* Pinia 尚未就绪时跳过上下文头 */
  }

  return config
})

request.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearAuth()
      const redirect = router.currentRoute.value.fullPath
      router.replace({ path: '/login', query: { redirect: redirect !== '/login' ? redirect : '/' } })
    }
    return Promise.reject(error)
  },
)

export default request
