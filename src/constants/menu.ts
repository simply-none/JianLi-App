import { layoutRouters, RouteNames } from '@/router';
import { iconMap } from '@/utils';

/**
 * 侧边栏菜单配置的单一数据源。
 *
 * 背景：此前 layout/index.vue（侧边栏）与 views/routeSetting/index.vue（路由配置页）
 * 各维护一份 groupDefs / lockedRoutes / enrichedRouters，两份已经漂移——
 * 新增的 themeConversation、colorPalette、twoFactor、passwordVault、pdfTools、fileVault
 * 只进了侧边栏，没进路由配置页，导致这些功能在配置页里根本看不到开关。
 *
 * 约定：新增/调整菜单项只改本文件，两个消费端自动同步。
 */

/** 侧边栏可配置的路由名：取 RouteNames 的值联合，写错名字会编译报错 */
export type MenuRouteName = typeof RouteNames[keyof typeof RouteNames];

/** 菜单分组定义 */
export interface MenuGroupDef {
  label: string;
  names: MenuRouteName[];
}

/** 菜单分组（顺序即侧边栏展示顺序） */
export const menuGroupDefs: MenuGroupDef[] = [
  {
    label: '通用',
    names: ['setting', 'newTips', 'homeMode', 'windowMode'],
  },
  {
    label: '系统与资源',
    names: [
      'systemInfo',
      'routeSetting',
      'appCache',
      'backup',
      'fileRela',
      'resourceManage',
      'safetyProtection',
      'sync',
      'fileTransfer',
      'ferry',
      'noteSlip',
    ],
  },
  {
    label: '效率工具',
    names: [
      'pomodoroRecord',
      'clipboard',
      'categorizableNotes',
      'themeConversation',
      'todoList',
      'habit',
      'countdown',
      'accounting',
      'stock',
      'earning',
      'resume',
      'registerShortcut',
      'function',
      'weather',
      'browser',
      'ebookReader',
      'screenshot',
      'downloader',
      'colorPalette',
      'qrCode',
      'twoFactor',
      'passwordVault',
      'pdfTools',
      'fileVault',
    ],
  },
  {
    label: '开发工具',
    names: ['netRequest', 'highPerfSql', 'flow', 'ttsTest', 'dataAcquisition', 'devToolbox'],
  },
  {
    label: '关于',
    names: ['about'],
  },
];

/** 不可配置的路由（始终显示，配置页中显示为「锁定」） */
export const lockedRoutes: MenuRouteName[] = ['setting', 'systemInfo', 'routeSetting'];

/**
 * 为每个路由注入图标到 meta（图标来自 utils 的 iconMap，缺省 fallback 为 settings）。
 *
 * ⚠️ 不要给这里加 `RouteRecordRaw` / `MenuRouteItem` 之类的显式类型标注：
 * `RouteRecordRaw` 在 vue-router 4 中是 5 个分支的联合类型（SingleView /
 * SingleViewWithChildren / MultipleViews / MultipleViewsWithChildren / Redirect），
 * 一旦标注、或用它与别的对象做交叉类型，`name` / `path` 这些联合的公有属性就取不到（TS2339）。
 * 保持现状让 TS 自行推断，再在下面用 `typeof enrichedRouters[number]` 反推元素类型。
 */
export const enrichedRouters = layoutRouters.map(r => ({
  ...r,
  meta: { ...r.meta, icon: iconMap[r.name as string] || 'settings' },
}));

/** 注入图标后的路由项（类型由 enrichedRouters 推断而来，勿改成 RouteRecordRaw 交叉类型） */
export type MenuRouteItem = (typeof enrichedRouters)[number];

/** 按 menuGroupDefs 解析出分组 + 路由项，找不到的路由名直接忽略 */
export function resolveMenuGroups(): { label: string; items: MenuRouteItem[] }[] {
  return menuGroupDefs.map(g => ({
    label: g.label,
    items: g.names
      .map(name => enrichedRouters.find(r => r.name === name))
      .filter((r): r is MenuRouteItem => Boolean(r)),
  }));
}

/** 判断路由是否锁定（不可隐藏）；非字符串或未登记一律返回 false */
export function isLockedRoute(name: unknown): boolean {
  if (typeof name !== 'string') {
    return false;
  }
  return (lockedRoutes as string[]).includes(name);
}
