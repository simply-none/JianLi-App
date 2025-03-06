import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
  }
}

export const layoutRouters: RouteRecordRaw[] = [
  {
    path: "/setting",
    name: "setting",
    component: () => import("@/views/setting/index.vue"),
    meta: {
      title: "设置", 
    }
  },
  {
    path: '/homeMode',
    name: 'homeMode',
    component: () => import("@/views/homeMode/index.vue"),
    meta: {
      title: "主页模式", 
    }
  },
  {
    path: "/appCache",
    name: "appCache",
    component: () => import("@/views/appCache/index.vue"),
    meta: {
      title: "应用缓存",
    },
  },
  {
    path: "/fileRela",
    name: "fileRela",
    component: () => import("@/views/fileRela/index.vue"), 
    meta: {
      title: "文件关联", 
    }
  },
  {
    path: '/safetyProtection',
    name:'safetyProtection',
    component: () => import("@/views/safetyProtection/index.vue"),
    meta: {
      title: "安全防护", 
    }
  },
  {
    path: "/test",
    name: "test",
    component: () => import("@/views/test.vue"),
    meta: {
      title: "测试",
    },
  },
  
];

const routers: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "home",
    component: () => import("@/views/home/index.vue"),
  },
  // 所有路由都引用Layout组件
  {
    path: "/",
    name: "layout",
    component: () => import("@/layout/index.vue"),
    children: layoutRouters,
  },
  {
    path: "/small",
    name: "small",
    component: () => import("@/views/smallWindow.vue"),
  },
];

export default createRouter({
  history: createWebHashHistory(),
  routes: routers,
});
