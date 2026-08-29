# 应用缓存管理 (appCache)

## 职责
查看/导出/替换应用的本地缓存（来自 `basic_info` 等存储）。提供全局 KV 存储的浏览、导出为 JSON、在资源管理器打开、整体替换等运维能力。

## 关键文件
- `src/views/appCache/index.vue`（行 84 `get-stort-all`、91 `export-data-to-json`、111 `open-file-in-assets-manager`、149 `replace-store`）
- store：`src/store/useCacheSet.ts`
- 主进程：`electron/main/module/store.ts`（`get-stort-all` 行 119、`set-store` 139、`replace-store` 209、`clear-store` 252）、`dialog.ts`（`export-data-to-json` 863、`open-file-in-assets-manager` 867）

## 路由
- `RouteNames.APP_CACHE` → path `/appCache`

## 用到的 IPC 通道
- `get-stort-all`（`sendSync`，`''`）→ 读取全部存储（**注意拼写：是 `stort` 不是 `store`**）
- `export-data-to-json`（`sendSync`，`{data, path}`）→ 导出 JSON（`dialog.ts`）
- `open-file-in-assets-manager`（`send`，`{path}`）→ 打开文件位置（`dialog.ts`）
- `replace-store`（`sendSync`，`data`）→ 整体替换存储（`store.ts`）
- 常规单键读写仍走 `set-store` / `get-store`（`common.ts` 封装）

## 复用 / 集成点
- 复用 `store.ts` 的全局 KV 通道；与 `resourceManage` 共用 `open-file-in-assets-manager`。
- 命令面板 REGISTRY 可跳转。

## 特有坑 / 注意
- **通道名拼写坑**：读取全部用的是 `get-stort-all`（typo），不是 `get-store-all`，新增代码别写错。
- `replace-store` 是整库替换、破坏性强，调用前务必二次确认，避免清空用户数据。
- `get-stort-all` / `replace-store` 为 `sendSync` 同步调用，数据量大时会阻塞渲染端。
