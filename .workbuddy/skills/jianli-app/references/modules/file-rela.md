# 文件关联 / 扫描 / 重命名 / 删除 (fileRela)

## 职责
文件工具集：目录/文件扫描、按规则批量重命名（含反向重命名）、文件复制/移动（文件传输）、按规则批量删除，以及默认打开程序配置。主进程 `dialog.ts` 提供底层文件操作与扫描 worker。

## 关键文件
- `src/views/fileRela/index.vue`（入口，聚合子页）
- `fileScan.vue` + `fileScan/*`（扫描，`start-scan` 行 108）、`fileRename.vue`（重命名，`rename-files` 行 378 / `reverse-rename` 389）、`fileDelete.vue` + `fileDelete/*`（删除，`delete-files` 行 109）、`fileTransfer.vue`（复制/移动，`copy-folder` 546 / `copy-files` / `open-folder` 491）、`defaultApp.vue`（默认程序，`get-default-file-path` 行 51）、`rename/*`（重命名规则引擎 `engine.ts` + 规则组件）
- 主进程：`electron/main/module/dialog.ts`（`get-file-list` 行 827、`list-folder` 882、`rename-files` 892、`reverse-rename` 897、`copy-folder` 853、`copy-files` 858、`open-folder` 872、`delete-files` 877、`start-scan` 918、`cancel-scan` 926）、`sys.ts`（`get-default-file-path` 行 28、`open-file-by-default-app` 67）

## 路由
- `RouteNames.FILE_RELA` → path `/fileRela`

## 用到的 IPC 通道
- `get-file-list`（`sendSync`，`'select-dir'`）→ 目录选择
- `list-folder`（`sendSync`，`{dir, recursive?, includeDirs?}`）→ 列目录
- `rename-files`（`send`，`{items, strategy}`）；回推 `rename-files` / `rename-files-progress` / `rename-files-reversed`
- `reverse-rename`（`send`，`{items}`）
- `copy-folder`（`send`）；回推 `copy-folder` / `copy-folder-progress`
- `copy-files`（`send`）；回推 `copy-files` / `copy-files-progress`
- `open-folder`（`send`，`{path}`）
- `delete-files`（`send`，`{...}`）；回推 `delete-files` / `delete-files-progress`
- `start-scan`（`send`，`{startPath, extensions, options}`）；回推 `start-scan`（扫描结果，行 147 监听）
- `cancel-scan`（`handle`）
- `get-default-file-path`（`send`，`{ext}`）；回推 `get-default-file-path`
- `open-file-by-default-app`（`handlePromise`，`{filePath, defaultAppPath}`）

## 复用 / 集成点
- 扫描走 `scanWorkerPath`（`variables.ts`：dev 读 `public/worker.mjs`，打包读 `dist/worker.mjs`）的 worker 线程，避免阻塞主线程（同 systemInfo 范式）。
- 复用 `AppDialog` 等通用组件做确认弹窗。

## 特有坑 / 注意
- **扫描 worker 路径 dev/打包差异**：`scanWorkerPath` 在 dev 指向 `public/worker.mjs`，打包指向 `dist/worker.mjs`，改 worker 后需重新构建。
- 进度类通道（`*-progress`/`*-reversed`）是主进程 `webContents.send` 主动推送，渲染端用 `ipcRenderer.on` 接收，务必在 `onUnmounted` 移除监听，否则重复回调。
- `rename-files` 的 `strategy`（`'overwrite'|'skip'|'rename'`）由主进程 `dialog.ts` 实现冲突策略，前端只传枚举。
