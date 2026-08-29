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
