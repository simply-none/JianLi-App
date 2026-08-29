# 资源管理 (resourceManage)

## 职责
应用内资源管理面板：上传文件、以缩略图/列表浏览资源（图片/视频等）、预览、打开文件所在位置、删除。资源以协议（`fileProtocol`）暴露给 `<el-image>` 等组件渲染。

## 关键文件
- `src/views/resourceManage/index.vue`（预览 `previewFile` 行 ~30、读取 `read-file` 行 246、`open-file-in-assets-manager` 行 257）
- store：`src/store/useResourceManage.ts`
- 主进程相关：`electron/main/module/dialog.ts`（`open-file-in-assets-manager` 行 867）、`store.ts`（资源落地）

## 路由
- `RouteNames.RESOURCE_MANAGE` → path `/resourceManage`

## 用到的 IPC 通道
- `read-file`（`sendSync`，`fullPath`）→ 读取文件内容/预览（**见下「坑」**）
- `open-file-in-assets-manager`（`send`，`{path}`）→ 在资源管理器/文件中打开位置（`dialog.ts`）
- 上传/列表主要走 store（`useResourceManage`）与 `fileProtocol` 协议，不直接依赖额外 IPC。

## 复用 / 集成点
- 复用 `UploadVue` 上传组件、`AppDialog` 预览弹窗、`FileIcon` 文件类型图标。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- **代码与约定不符（遗留项）**：`index.vue:246` 调用 `sendSync('read-file', fullPath)`，但全仓库**未在主进程注册 `read-file` 通道**（grep 仅在 `resourceManage/index.vue` 出现，无 `ipcMain.on/handle`）。该调用目前必然失败/无响应，疑似死代码或应改用 `ebook:read-file-bytes` / `ebook:read-file-range`。需确认或修复。
- `fileProtocol`（如 `jlocal://` 自定义协议）由主进程 `protocol.ts` 注册，dev/打包行为一致，但资源路径需是本地绝对路径经协议转换。
- 删除资源若需同步清理 DB 记录，需确认 store 内是否调用了 `new-sql:delete`，不要只删文件。
