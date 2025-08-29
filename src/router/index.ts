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
    path: '/windowMode',
    name: 'windowMode',
    component: () => import("@/views/windowMode/index.vue"),
    meta: {
      title: "窗口模式",
    }
  },
  {
    path: "/pomodoroRecord",
    name: "pomodoroRecord",
    component: () => import("@/views/pomodoroRecord/index.vue"),
    meta: {
      title: "番茄钟记录",
    },
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
    path: '/resourceManage',
    name:'resourceManage',
    component: () => import("@/views/resourceManage/index.vue"),
    meta: {
      title: "资源管理", 
    }
  },
  {
    path: '/clipboard',
    name:'clipboard',
    component: () => import("@/views/clipboard/index.vue"),
    meta: {
      title: "剪贴板",
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
    path: "/styleBeauty",
    name: "styleBeauty",
    component: () => import("@/views/styleBeauty/index.vue"),
    meta: {
      title: "样式美化", 
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
  {
    path: "/sqlTest",
    name: "sqlTest",
    component: () => import("@/views/sqlTest/index.vue"),
    meta: {
      title: "数据库测试",
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
  {
    path: "/second",
    name: "second",
    component: () => import("@/views/pomodoroMiniWindow/index.vue"),
  }
];

export default createRouter({
  history: createWebHashHistory(),
  routes: routers,
});
