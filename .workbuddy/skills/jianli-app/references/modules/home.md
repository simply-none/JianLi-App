# 主页 (home)

## 职责
应用首页 / **默认重定向目标**。是一个「主题画廊」：通过 `curComponent` 动态切换多个 UI 风格子组件（仿 Windows 更新、极简时钟、终端风、音乐播放器、桌面风、诗歌展示、搜索引擎等），由全局设置决定当前展示哪个。

## 关键文件
- `src/views/home/index.vue`（`component :is="curComponent"` 行 4；导入各子组件 31–44；`toSetting`、`startLockedFn` 等）
- 子组件：`home/custom.vue`、`imitationWindowsUpdate.vue`、`minimalClock.vue`、`githubTheme.vue`、`motivationalQuote.vue`、`terminalTheme.vue`、`musicPlayerTheme.vue`、`windowsDesktop.vue`、`macOSDesktop.vue`、`newsReader.vue`、`codeEditorTheme.vue`、`searchEngine.vue`、`poetryHome.vue`、`showImage.vue`、`translucentPoemDisplay.vue`
- store：`src/store/useGlobalSetting.ts`（决定 `curComponent` 等全局外观）

## 路由
- `RouteNames.HOME` → path `/home`
- `src/router/index.ts` 中 `DEFAULT_REDIRECT_ROUTE = RouteNames.HOME`（访问 `/` 重定向到此）

## 用到的 IPC 通道
- `poet-data`（`sendSync`，`home/imitationWindowsUpdate.vue:63`）→ 诗词数据（`poetData.ts`）
- `get-bing-image`（`handlePromise`，`home/minimalClock.vue:274`）→ 每日壁纸（`bing.ts`，与 weather 模块共用）

## 复用 / 集成点
- `get-bing-image`、`poet-data` 与主进程共享，其它模块可直接复用。
- 子组件是 UI 风格样例库，新增主题只需在 `home/index.vue` 注册并接 `useGlobalSetting`。
- 命令面板 REGISTRY 的 `PREFERRED_ROUTES` 首项即 `home`。

## 特有坑 / 注意
- 主页是重定向终点，新增「默认进入页」需改 `DEFAULT_REDIRECT_ROUTE`，不要硬编码 `/home`。
- 子组件较多，`curComponent` 切换用的是 `shallowRef`/动态 `component`，注意每个子组件的 IPC 订阅生命周期（进入/离开时正确 remove 监听）。
- 锁屏态（`currentStateKey === 'lock'`）等业务状态由 `useTipsRuntime` 驱动，主页仅做展示与切换入口。

## 性能红线（2026-09-28 修复：主页驻留 + 快速移动鼠标卡顿）

**症状**：只停留在 `/home` 页面、不做任何操作，快速移动鼠标时会出现偶发卡顿（约一周前无此问题）。

**根因链**（`idleNow` 每秒定时器 → 主页 watch 深遍历 + 全量深拷贝）：

1. `useGlobalSetting.ts` 的 `idleNow` 由 `setInterval(…, 1000)` 每**秒**刷新；
2. → `isIdleNow`（computed）失效重算 → `activeHomeModeKey` 重算；
3. → `home/index.vue` 与 `components/importSmallComponents.vue` 两处 `watch` 的 getter 依赖上述 computed，**每秒重新求值**；
4. → 两处 watch 均带 **`deep: true`**，getter 又返回 `homeMode[key]`（含 `widgets` 数组 / `style` 对象 / `mode` 深层对象）⇒ **每秒做一次完整递归遍历**；
5. → `importSmallComponents.vue` 的 handler 内还执行 **`JSON.parse(JSON.stringify(整个 homeMode))` 全量深拷贝** + `modeData.value = md` 触发重渲染；
6. → `home/index.vue` 的 handler 还有 `console.log(n, o, ...)` 打印整个响应式对象（DevTools 深度序列化）。
7. 叠加：`f0b1337`(2026-09-24) 把 `setStore` 迁到 `setStoreAsync`（走 `new-sql:upsert`），而 `upsert` 每次都在事务内调 `ensureTableColumns` —— 该函数**原本无缓存**，每次写都白跑 `SELECT sql FROM sqlite_master` + `PRAGMA table_info` 2 次元数据 IO。

**已实施修复**：

| 位置 | 改动 |
|---|---|
| `store/useGlobalSetting.ts` | `idleNow` 刷新间隔 **1s → 15s**（`IDLE_CLOCK_INTERVAL`）。空闲判定精度只到「分钟」(`utils/idleTime.ts` 用 `getHours/getMinutes`)，每秒刷新纯冗余；15s 对免打扰场景无感 |
| `store/useGlobalSetting.ts` | 删除末尾 `watchEffect` 里的 3 个 `console.log`（打印 reactive 对象 ⇒ DevTools 深度序列化） |
| `views/home/index.vue` | watch getter 改为返回**原始值** `curHomeModeValue`（条目 `value`，即模式编号字符串），去掉 `deep: true`、去掉 `console.log`。对象字面量在 key 缺失时每次新建 `{}`，浅比较恒不等会致 handler 空转，故必须返回原始值 |
| `components/importSmallComponents.vue` | watch 源改为 `[activeHomeModeKey, homeModeC]` 两个浅值，去掉 `deep: true` |
| `electron/main/module/newSql.ts` | `ensureTableColumns` 增加 `ensuredColumnSets` 缓存（键 = 表名\|主键\|写入列签名），结构无变更才写缓存；命中直接短路，省去 2 次元数据 IO。**改主进程须重启 Electron** |

**维护约定（务必遵守）**：
- **`deep: true` 不要与「依赖秒级时钟的 computed」搭配**。`homeMode` 的所有写入（`setHomeMode` / `alignHomeModeKeys`）都是**整体替换对象引用**，浅比较足够感知配置变更，永远不需要 deep 遍历。
- **watch getter 不要返回新造的对象/数组字面量**（`|| {}`、`[a]`、`.map()`），浅比较会恒不相等导致 handler 空转，应返回原始值或提升为 computed。
- 登录页/主页等**常驻页面**里禁止保留打印深层 reactive 对象的 `console.log`。
- 新增「需要实时刷新」的全局时钟类 ref 前先确认下游真正需要的**时间精度**；精度到分钟就不要用 1s 定时器驱动响应式。
- `electron/main/module/newSql.ts` 的任何 `ensure*` 元数据检查都应有缓存，否则会随调用频率线性放大 IO（`upsert` 在热路径上尤其敏感）。

