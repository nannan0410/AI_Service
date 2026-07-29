import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { setToastDefaultOptions } from 'vant'
import App from './App.vue'
import router from './router'
import 'vant/lib/index.css'
import './styles/global.css'

async function bootstrap() {
  // 公司服务器静态托管时没有 vite mock 中间件，需在浏览器内启用演示 API
  if (import.meta.env.PROD) {
    const { setupProdMockServer } = await import('./mockProdServer')
    await setupProdMockServer()
  }

  setToastDefaultOptions({
    zIndex: 20000,
    duration: 2000,
    position: 'middle',
  })

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

bootstrap().catch((error) => {
  console.error('[app] 启动失败', error)
})
