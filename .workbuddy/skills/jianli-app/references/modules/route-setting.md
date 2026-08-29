# 路由/菜单开关配置 (routeSetting)

## 职责
让用户自定义侧边栏菜单中哪些路由显示/隐藏（锁定路由始终可见），配置存 `basic_info.routeSetting`，并通过自定义事件通知 layout 刷新菜单。

## 关键文件
- 页面：`src/views/routeSetting/index.vue`（全逻辑在此单文件）
- 数据源：`src/router/index.ts` 的 `layoutRouters`（菜单项来自布局路由）、`RouteNames`
- 图标映射：`src/utils`（iconMap）

## 路由
- `RouteNames.ROUTE_SETTING` → `/routeSetting`

## 用到的 IPC 通道
- `get-store`（`'routeSetting'`，`index.vue:136` 加载配置）
- `set-store`（`'routeSetting'`，`:146` 保存；`:161` 重置）
- 主→渲染事件：`window.dispatchEvent(new CustomEvent('route-setting-changed'))`（`:149/:164`，通知 layout 刷新菜单，**非 IPC**，是页面内事件）

## 复用 / 集成点
- **路由表驱动**：菜单分组 `groupDefs:69` 直接引用 `RouteNames` 字符串，新增路由只要在 `layoutRouters` 注册且加入分组即可出现在配置页。
- **锁定路由不可关**：`lockedRoutes:61`（`setting`/`systemInfo`/`routeSetting`）始终可见且禁用开关。

## 特有坑 / 注意
- **配置是「隐藏集合」语义**：`routeConfig[name]=false` 表示隐藏；未配置（undefined）默认可见（`isRouteVisible():115`）。保存空对象 `{}` 即全部显示。
- **刷新靠自定义事件不是 IPC**：改完必须 `dispatchEvent('route-setting-changed')`，layout 监听此事件重建菜单；若只 `set-store` 不派发事件，菜单不会即时刷新。
- **类型守卫**：`isRouteVisible/toggleRoute` 对 `name` 做了 `typeof === 'string'` 守卫，路由 name 非字符串时直接放行/忽略，新增路由确保 name 为字符串型 `RouteNames.X`。
