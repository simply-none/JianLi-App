# 系统信息采集 (systemInfo)

## 职责
采集并实时展示本机系统信息（CPU、内存、磁盘、网络流量等）。渲染端发指令，主进程在 **worker 线程** 跑采集逻辑，避免阻塞主线程，结果经 `webContents.send` 回推渲染端。

## 关键文件
- `src/views/systemInfo/index.vue`（`system-info`/`system-info-static` 的 send 与 on 监听，行 491–549）
- `src/views/systemInfo/systemInfo.vue`、`form.vue`（展示/配置子组件）
- 主进程：`electron/main/module/systemInfo.ts`（原 `apiTest.ts` 重构拆分而来，`initSystemInfo()`；`ipcMain.on('system-info'…)`、`system-info-static`；`new Worker(systemInfoWorkerPath)`）
- worker 脚本路径：`electron/main/variables.ts` 的 `systemInfoWorkerPath`（dev：`public/worker/systemInfo.cjs`，打包：`dist/worker/systemInfo.cjs`）

## 路由
- `RouteNames.SYSTEM_INFO` → path `/systemInfo`

## 用到的 IPC 通道
- `system-info`（渲染→主，`send`，`{type:'start'|'stop'}`）启动/停止实时采集
- `system-info-static`（渲染→主，`send`，`{type:'summary'|'extended'}`）一次性静态信息
- `system-info` / `system-info-static`（主→渲染，`webContents.send` 回推结果，渲染端用 `ipcRenderer.on` 接收）
- 进度预通知：`system-info` / `system-info-static` 带 `{type:'start-pre', data: systemInfoWorkerPath}`

## 复用 / 集成点
- worker 线程模式是整个「系统采集」类功能的范式（另见 `sys.ts` 的 `defaultAppWorker`）。
- 命令面板 REGISTRY（`src/views/commandPalette`）可跳转该路由。

## 特有坑 / 注意
- 必须用 worker 线程采集，切勿在主进程/渲染端同步跑重逻辑。
- worker 路径有 **dev / 打包差异**：dev 读 `public/worker/systemInfo.cjs`，打包读 `dist/worker/systemInfo.cjs`；改 worker 后要重新构建 `dist/worker`。
- 渲染端用 `ipcRenderer.on` 收结果，组件卸载时要 `removeAllListeners`，否则重复订阅导致多次回调。
