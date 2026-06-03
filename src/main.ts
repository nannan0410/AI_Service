import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { setToastDefaultOptions } from 'vant'
import App from './App.vue'
import router from './router'
import 'vant/lib/index.css'
import './styles/global.css'

setToastDefaultOptions({
  zIndex: 20000,
  duration: 2000,
  position: 'middle',
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
