/**
 * 静态部署（无 Node Mock 中间件）时，在浏览器内拦截 /api 请求。
 * 仅用于演示/QA，正式对接真实后端时不要启用。
 */
import { createProdMockServer } from 'vite-plugin-mock/client'
import type { MockMethod } from 'vite-plugin-mock'
import authMock from '../mock/auth'
import businessMock from '../mock/business'
import configMock from '../mock/config'
import conversationMock from '../mock/conversation'
import demoMock from '../mock/demo'
import mapMock from '../mock/map'
import tagsMock from '../mock/tags'

/**
 * 开发中间件按 pathname 严格匹配路由，浏览器版 mock 却是「前缀正则 + 命中最先注册的一条」，
 * 于是 `/api/stars` 会抢走 `/api/stars/match` 的请求（返回明星列表而非单个明星，
 * 卡片渲染成 undefined）。按 url 长度倒序注册，保证子路由永远排在其前缀路由之前。
 */
function sortByUrlSpecificity(list: MockMethod[]): MockMethod[] {
  return [...list].sort((a, b) => (b.url?.length ?? 0) - (a.url?.length ?? 0))
}

export async function setupProdMockServer() {
  await createProdMockServer(
    sortByUrlSpecificity([
      ...authMock,
      ...businessMock,
      ...configMock,
      ...conversationMock,
      ...demoMock,
      ...mapMock,
      ...tagsMock,
    ]),
  )
}
