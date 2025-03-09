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

const isSecondWindow = location.href.includes('isSecondWindow=true')
if (!isSecondWindow) {
  initDevtools() 
}

const pinia = createPinia()

createApp(App)
  .use(ElementPlus)
  .use(router)
  .use(pinia)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })
