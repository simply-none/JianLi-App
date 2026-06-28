import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { createPinia } from 'pinia'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import './utils/devtools'
import './style.scss'
import './lib/heti.min.css'

import { initDevtools } from './utils/devtools'

import LucideIcon from './components/LucideIcon.vue'

const isSecondWindow = location.href.includes('isSecondWindow=true')
if (!isSecondWindow) {
  initDevtools()
}

const pinia = createPinia()

let app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.use(pinia)
app.component('LucideIcon', LucideIcon)

app.mount('#app').$nextTick(() => {
  postMessage({ payload: 'removeLoading' }, '*')
})
