# 路由/菜单开关配置 (routeSetting)

## 职责
让用户自定义侧边栏菜单中哪些路由显示/隐藏（锁定路由始终可见），配置存 `basic_info.routeSetting`，并通过自定义事件通知 layout 刷新菜单。

## 关键文件
- 页面：`src/views/routeSetting/index.vue`（配置页逻辑）
- 侧边栏消费端：`src/layout/index.vue`
- **菜单单一数据源：`src/constants/menu.ts`**（2026-09-10 收口，分组/图标/锁定名单只此一份）
- 数据源：`src/router/index.ts` 的 `layoutRouters`（菜单项来自布局路由）、`RouteNames`
- 图标映射：`src/utils`（iconMap）

## 路由
- `RouteNames.ROUTE_SETTING` → `/routeSetting`

## 用到的 IPC 通道
- `get-store`（`'routeSetting'`，`index.vue:93` 加载配置）
- `set-store`（`'routeSetting'`，`:103` 保存；`:118` 重置）
- 主→渲染事件：`window.dispatchEvent(new CustomEvent('route-setting-changed'))`（`:106/:121`，通知 layout 刷新菜单，**非 IPC**，是页面内事件）

## 复用 / 集成点
- **新增菜单项三步**（顺序别漏）：① `src/router/index.ts` 的 `layoutRouters` 注册路由 + `RouteNames` 加 key；
  ② **`src/constants/menu.ts` 的 `menuGroupDefs` 对应分组 `names` 加名**；③ 可选：`src/utils` 的 `iconMap` 加图标（不加则 fallback `settings`）。
  侧边栏与配置页两个消费端**自动同步**，无需分别改。
- `constants/menu.ts` 导出：`menuGroupDefs`（分组定义）、`lockedRoutes`（锁定名单）、`enrichedRouters`（注入图标后的路由项）、
  `resolveMenuGroups()`（分组+路由项）、`isLockedRoute(name)`、类型 `MenuRouteName`/`MenuRouteItem`。
- **类型安全**：`names` 类型是 `MenuRouteName[]`（= `RouteNames` 值的联合），写错路由名**编译报错**；配置页模板变量为 `menuGroups`（静态常量，非 computed）。
- **锁定路由不可关**：`lockedRoutes`（`setting`/`systemInfo`/`routeSetting`）始终可见且禁用开关。

## 特有坑 / 注意
- ⚠️ **禁止再在消费端各自维护分组名单**（2026-09-10 事故）：此前 `layout/index.vue` 与 `routeSetting/index.vue` 各存一份
  `groupDefs`/`lockedRoutes`/`enrichedRouters`，两份漂移——新增的 `themeConversation`/`colorPalette`/`twoFactor`/
  `passwordVault`/`pdfTools`/`fileVault` 只进了侧边栏，**配置页里根本没有这些开关**。已统一到 `constants/menu.ts` 修复。
- **配置是「隐藏集合」语义**：`routeConfig[name]=false` 表示隐藏；未配置（undefined）默认可见（`isRouteVisible():61`）。保存空对象 `{}` 即全部显示。
- **刷新靠自定义事件不是 IPC**：改完必须 `dispatchEvent('route-setting-changed')`，layout 监听此事件重建菜单；若只 `set-store` 不派发事件，菜单不会即时刷新。
- **类型守卫**：`isRouteVisible/toggleRoute` 对 `name` 做了 `typeof === 'string'` 守卫，路由 name 非字符串时直接放行/忽略，新增路由确保 name 为字符串型 `RouteNames.X`。
- ⚠️ **`enrichedRouters` 不要加 `RouteRecordRaw` / `MenuRouteItem` 显式类型标注**（2026-09-10 踩坑）：vue-router 4 的 `RouteRecordRaw` 是 5 分支联合类型（SingleView / SingleViewWithChildren / MultipleViews / MultipleViewsWithChildren / Redirect）。一旦给 map 结果标注 `: RouteRecordRaw[]` 或写 `type X = RouteRecordRaw & {...}`，`name`/`path` 这些联合公有属性会取不到（TS2339）；想拿 `MenuRouteItem` 类型用 `(typeof enrichedRouters)[number]` 反推，并让 map 保持 TS 自行推断（原写法 `meta: { ...r.meta, icon }` 即可）。
