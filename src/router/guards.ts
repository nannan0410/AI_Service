import type { Router } from 'vue-router'
import { getToken } from '@/utils/auth'
import { useAuthStore } from '@/store/authStore'
import {
  clearChunkReloadFlag,
  isChunkLoadError,
  reloadOnceForChunkError,
} from '@/utils/chunkLoad'

export function setupRouterGuards(router: Router) {
  // 进入任意页成功后清掉「分片失败已刷新」标记，下次再遇新包仍可自动恢复
  router.afterEach(() => {
    clearChunkReloadFlag()
  })

  router.onError((error) => {
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError()
    }
  })

  router.beforeEach(async (to, _from, next) => {
    const isPublic = to.meta.public === true
    const token = getToken()

    if (isPublic) {
      if (to.path === '/login' && token) {
        next({ path: (to.query.redirect as string) || '/' })
        return
      }
      next()
      return
    }

    if (!token) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }

    const authStore = useAuthStore()
    if (!authStore.isLoggedIn) {
      const ok = await authStore.restoreSession()
      if (!ok) {
        next({ path: '/login', query: { redirect: to.fullPath } })
        return
      }
    }

    next()
  })
}
