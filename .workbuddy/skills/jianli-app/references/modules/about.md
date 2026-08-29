# 关于 + 自动更新 (about)

## 职责
展示应用版本、关于信息，并提供自动更新能力：检查更新、下载更新包、安装更新、打开发布页外链。

## 关键文件
- `src/views/about/index.vue`（关于信息）
- `src/views/about/autoUpdate.vue`（更新逻辑：行 121 `check-for-update`、164 `download-update`、189 `install-update`、202 `open-external-url`、232 `get-app-version`、238 监听 `download-progress`）
- 主进程：`electron/main/module/autoUpdate.ts`（`get-app-version` 147、`check-for-update` 152、`download-update` 182、`install-update` 208、`open-external-url` 219）

## 路由
- `RouteNames.ABOUT` → path `/about`

## 用到的 IPC 通道
- `get-app-version`（`invoke`）→ 当前版本号
- `check-for-update`（`handlePromise`）→ 检测是否有新版本
- `download-update`（`handlePromise`，`{downloadUrl, fileName}`）→ 下载更新包
- `install-update`（`handlePromise`，`{filePath}`）→ 安装并重启
- `open-external-url`（`handlePromise`，`{url}`）→ `shell.openExternal` 打开外链
- `download-progress`（主→渲染，`webContents.send`）→ 下载进度推送（渲染端 `on` 监听）

## 复用 / 集成点
- `open-external-url` 是通用外链通道，其他模块（如浏览器、公告）打开外部 URL 也走它。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- **下载进度通道**：进度不是 `handlePromise` 返回值，而是主进程持续 `webContents.send('download-progress', ...)` 推给渲染端，需 `ipcRenderer.on('download-progress')` 接收并在卸载时移除监听。
- `download-update` 入参需 `{downloadUrl, fileName}`（见 `autoUpdate.ts:182`），传参缺失会失败。
- 自动更新涉及重启应用，开发期调试时注意区分 dev/打包行为；安装包由 `electron-builder.json5` 控制。
