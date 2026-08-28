import { createApp } from 'vue'
import type { Component } from 'vue'
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
import AppDialog from './components/AppDialog.vue'
import VirtualList from './components/VirtualList.vue'

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
app.component('AppDialog', AppDialog)
// VirtualList 是泛型组件，全局注册类型不兼容，此处做一次断言（仅影响注册处，模板使用不受影响）
app.component('VirtualList', VirtualList as unknown as Component)

app.mount('#app').$nextTick(() => {
  postMessage({ payload: 'removeLoading' }, '*')
})
