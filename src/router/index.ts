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
    path: '/systemInfo',
    name: 'systemInfo',
    component: () => import("@/views/systemInfo/index.vue"),
    meta: {
      title: "系统信息", 
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
  // 笔记本
  {
    path: '/notebook',
    name:'notebook',
    component: () => import("@/views/notebook/index.vue"),
    meta: {
      title: "笔记本", 
    }
  },
  // 快捷键注册
  {
    path: '/registerShortcut',
    name:'registerShortcut',
    component: () => import("@/views/registerShortcut/index.vue"),
    meta: {
      title: "快捷键注册", 
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
    path: "/netRequest",
    name: "netRequest",
    component: () => import("@/views/netRequest/index.vue"),
    meta: {
      title: "网络请求",
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
  {
    path: "/流程图",
    name: "flow",
    component: () => import("@/views/flow/index.vue"),
    meta: {
      title: "流程图",
    }
  },
  {
    path: "/小工具",
    name: "function",
    component: () => import("@/views/function/index.vue"),
    meta: {
      title: "小工具",
    }
  },
  // 关于
  {
    path: "/about",
    name: "about",
    component: () => import("@/views/about/index.vue"),
    meta: {
      title: "关于", 
    }
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
  },
  {
    path: "/jobTipWindow",
    name: "jobTipWindow",
    component: () => import("@/views/jobTipWindow/index.vue"),
  },
  {
    path: "/miniNotebook",
    name: "miniNotebook",
    component: () => import("@/views/miniNotebook/index.vue"),
  }
];

export default createRouter({
  history: createWebHashHistory(),
  routes: routers,
});
