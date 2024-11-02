import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(''),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/home.vue')
    },
    {
      path: '/setting',
      name: 'setting',
      component: () => import('../views/setting.vue')
    },
  ]
})