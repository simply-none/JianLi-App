import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
  }
}

export const RouteNames = {
  SETTING: "setting",
  SYSTEM_INFO: "systemInfo",
  HOME_MODE: "homeMode",
  WINDOW_MODE: "windowMode",
  POMODORO_RECORD: "pomodoroRecord",
  APP_CACHE: "appCache",
  FILE_RELA: "fileRela",
  RESOURCE_MANAGE: "resourceManage",
  CLIPBOARD: "clipboard",
  NOTEBOOKAPP: "notebookApp",
  REGISTER_SHORTCUT: "registerShortcut",
  SAFETY_PROTECTION: "safetyProtection",
  NET_REQUEST: "netRequest",
  SQL_TEST: "sqlTest",
  FLOW: "flow",
  FUNCTION: "function",
  WEATHER: "weather",
  ABOUT: "about",
  HOME: "home",
  LAYOUT: "layout",
  SMALL: "small",
  SECOND: "pomodoro",
  JOB_TIP_WINDOW: "jobTipWindow",
  MINI_NOTEBOOK: "miniNotebook",
  CATEGORIZABLE_NOTES: "categorizableNotes",
  ROUTE_SETTING: "routeSetting",
  BROWSER: "browser",
  QUICK_NOTE: "quickNote",
} as const;

export type RouteNameType = typeof RouteNames[keyof typeof RouteNames];

export const DEFAULT_REDIRECT_ROUTE: RouteNameType = RouteNames.HOME;

export const layoutRouters: RouteRecordRaw[] = [
  {
    path: "/setting",
    name: RouteNames.SETTING,
    component: () => import("@/views/setting/index.vue"),
    meta: {
      title: "设置",
    },
  },
  {
    path: "/systemInfo",
    name: RouteNames.SYSTEM_INFO,
    component: () => import("@/views/systemInfo/index.vue"),
    meta: {
      title: "系统信息",
    },
  },
  {
    path: "/routeSetting",
    name: RouteNames.ROUTE_SETTING,
    component: () => import("@/views/routeSetting/index.vue"),
    meta: {
      title: "路由配置",
    },
  },
  {
    path: "/homeMode",
    name: RouteNames.HOME_MODE,
    component: () => import("@/views/homeMode/index.vue"),
    meta: {
      title: "主页模式",
    },
  },
  {
    path: "/windowMode",
    name: RouteNames.WINDOW_MODE,
    component: () => import("@/views/windowMode/index.vue"),
    meta: {
      title: "窗口模式",
    },
  },
  {
    path: "/pomodoroRecord",
    name: RouteNames.POMODORO_RECORD,
    component: () => import("@/views/pomodoroRecord/index.vue"),
    meta: {
      title: "番茄钟记录",
    },
  },
  {
    path: "/appCache",
    name: RouteNames.APP_CACHE,
    component: () => import("@/views/appCache/index.vue"),
    meta: {
      title: "应用缓存",
    },
  },
  {
    path: "/fileRela",
    name: RouteNames.FILE_RELA,
    component: () => import("@/views/fileRela/index.vue"),
    meta: {
      title: "文件关联",
    },
  },
  {
    path: "/resourceManage",
    name: RouteNames.RESOURCE_MANAGE,
    component: () => import("@/views/resourceManage/index.vue"),
    meta: {
      title: "资源管理",
    },
  },
  {
    path: "/clipboard",
    name: RouteNames.CLIPBOARD,
    component: () => import("@/views/clipboard/index.vue"),
    meta: {
      title: "剪贴板",
    },
  },
  {
    path: "/notebookApp",
    name: RouteNames.NOTEBOOKAPP,
    component: () => import("@/views/notebook/index.vue"),
    meta: {
      title: "笔记本",
    },
  },
  {
    path: "/categorizableNotes",
    name: RouteNames.CATEGORIZABLE_NOTES,
    component: () => import("@/views/categorizableNotes/index.vue"),
    meta: {
      title: "可归类的笔记",
    },
  },
  {
    path: "/registerShortcut",
    name: RouteNames.REGISTER_SHORTCUT,
    component: () => import("@/views/registerShortcut/index.vue"),
    meta: {
      title: "快捷键注册",
    },
  },
  {
    path: "/safetyProtection",
    name: RouteNames.SAFETY_PROTECTION,
    component: () => import("@/views/safetyProtection/index.vue"),
    meta: {
      title: "安全防护",
    },
  },
  {
    path: "/netRequest",
    name: RouteNames.NET_REQUEST,
    component: () => import("@/views/netRequest/index.vue"),
    meta: {
      title: "网络请求",
    },
  },
  {
    path: "/sqlTest",
    name: RouteNames.SQL_TEST,
    component: () => import("@/views/sqlTest/index.vue"),
    meta: {
      title: "数据库测试",
    },
  },
  {
    path: "/流程图",
    name: RouteNames.FLOW,
    component: () => import("@/views/flow/index.vue"),
    meta: {
      title: "流程图",
    },
  },
  {
    path: "/小工具",
    name: RouteNames.FUNCTION,
    component: () => import("@/views/function/index.vue"),
    meta: {
      title: "小工具",
    },
  },
  {
    path: "/weather",
    name: RouteNames.WEATHER,
    component: () => import("@/views/weather/index.vue"),
    meta: {
      title: "天气",
    },
  },
  {
    path: "/browser",
    name: RouteNames.BROWSER,
    component: () => import("@/views/browser/index.vue"),
    meta: {
      title: "浏览器",
    },
  },
  {
    path: "/about",
    name: RouteNames.ABOUT,
    component: () => import("@/views/about/index.vue"),
    meta: {
      title: "关于",
    },
  },
];

const routers: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: `/${DEFAULT_REDIRECT_ROUTE}`,
  },
  {
    path: "/home",
    name: RouteNames.HOME,
    component: () => import("@/views/home/index.vue"),
  },
  {
    path: "/",
    name: RouteNames.LAYOUT,
    component: () => import("@/layout/index.vue"),
    children: layoutRouters,
  },
  {
    path: "/small",
    name: RouteNames.SMALL,
    component: () => import("@/views/smallWindow.vue"),
  },
  {
    path: "/pomodoro",
    name: RouteNames.SECOND,
    component: () => import("@/views/pomodoroMiniWindow/index.vue"),
  },
  {
    path: "/jobTipWindow",
    name: RouteNames.JOB_TIP_WINDOW,
    component: () => import("@/views/jobTipWindow/index.vue"),
  },
  {
    path: "/miniNotebook",
    name: RouteNames.MINI_NOTEBOOK,
    component: () => import("@/views/miniNotebook/index.vue"),
  },
  {
    path: "/quickNote",
    name: RouteNames.QUICK_NOTE,
    component: () => import("@/views/quickNote/index.vue"),
  },
];

export default createRouter({
  history: createWebHashHistory(),
  routes: routers,
});