# 内置浏览器 (browser)

## 职责
应用内内置浏览器面板，承载网页浏览/内嵌网页内容（区别于 `netRequest` 的自动化爬虫，本模块是「给人看的」常规浏览）。

## 关键文件
- `src/views/browser/index.vue`（主面板）
- store：`src/store/useBrowser.ts`（浏览状态/历史/标签等由该 store 维护）
- 主进程相关：`electron/main/module/newWindow.ts`（`open-new-window` 等）、`autoUpdate.ts` 的 `open-external-url`（外链可走此通道）

## 路由
- `RouteNames.BROWSER` → path `/browser`

## 用到的 IPC 通道
- 渲染端 `index.vue` **未发现直接 `send`/`sendSync`/`invoke` 调用**：浏览能力主要靠 `useBrowser` store 与内嵌 `<webview>`/渲染层实现。
- 如需打开外部链接，复用 `open-external-url`（`autoUpdate.ts`，`shell.openExternal`）；小窗承载可复用 `open-new-window`（`newWindow.ts`）。

## 复用 / 集成点
- 复用 `useBrowser` store 作为状态中枢；命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- 本模块渲染端不直接走 IPC，新增「调用系统能力」（下载、打开外部、转发到主进程）时务必经 `src/utils/common.ts` 的 `send/sendSync`，并确认主进程已 `ipcMain.on/handle` 对应通道，切勿在渲染端 `import electron/*`。
- 内嵌网页需关注 `webview` 权限/`contextIsolation` 设置与打包后路径差异（dev 用 `VITE_DEV_SERVER_URL`，打包用 `dist`）。
