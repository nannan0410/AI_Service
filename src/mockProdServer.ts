/**
 * 静态部署（无 Node Mock 中间件）时，在浏览器内拦截 /api 请求。
 * 仅用于演示/QA，正式对接真实后端时不要启用。
 */
import { createProdMockServer } from 'vite-plugin-mock/client'
import authMock from '../mock/auth'
import businessMock from '../mock/business'
import configMock from '../mock/config'
import conversationMock from '../mock/conversation'
import demoMock from '../mock/demo'
import mapMock from '../mock/map'
import tagsMock from '../mock/tags'

export async function setupProdMockServer() {
  await createProdMockServer([
    ...authMock,
    ...businessMock,
    ...configMock,
    ...conversationMock,
    ...demoMock,
    ...mapMock,
    ...tagsMock,
  ])
}
