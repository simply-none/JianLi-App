# 资源管理 (resourceManage)

## 职责
应用内资源管理面板：上传文件、以缩略图/列表浏览资源（图片/视频/音频/文本/PDF 等）、搜索筛选排序、预览（缩放/旋转/上下导航）、批量选择与删除（可选删物理文件）、收藏、统计。资源数据存 **SQLite `resource` 表**，缩略图经 `fileProtocol`（`jlocal:///`）渲染。

## 关键文件（2026-08 重构后结构）
```
src/views/resourceManage/
├── index.vue                      # 页面编排（上传区/工具栏/统计条/列表/预览/删除确认）
├── types.ts                       # ResourceItem / SortField / ViewMode 等类型
├── api/resourceApi.ts             # SQLite 读写封装 + 旧数据迁移 + 文件级 IPC 封装
├── utils/fileType.ts              # 扩展名→类型/标签映射、formatSize
├── composables/useResourceList.ts # 加载/搜索/筛选/排序/多选/增删/统计
├── composables/useResourcePreview.ts # 预览状态/文本加载/导航/缩放旋转
└── components/
    ├── ResourceToolbar.vue        # 搜索/类型筛选/排序/视图切换/批量条
    ├── ResourceStatsBar.vue       # 总数/总大小/类型徽章
    ├── ResourceUploadCard.vue     # 复用 UploadVue（legacy-store=false）
    ├── ResourceGrid.vue           # 网格视图
    ├── ResourceList.vue           # 列表视图（紧凑行）
    ├── ResourceCard.vue           # 卡片（缩略图/信息/悬停操作）
    └── ResourcePreviewDialog.vue  # 预览弹窗（图片缩放旋转/文本/PDF/导航）
```
- 主进程：`electron/main/module/resource.ts`（`initResource()` 在 `electron/main/index.ts` 注册）

## 数据层
- 表 `resource`：`key TEXT PRIMARY KEY`（=落盘绝对路径）/ `name` / `path` / `type` / `size` / `ext` / `is_starred` / `created_at`
- 建表：`resourceApi.ensureResourceTables()` 用 `new-sql:execute` 跑**显式 CREATE TABLE / CREATE INDEX**（DDL 列定义齐全，无自动建表劫持风险）；进程内懒执行一次（ensureReady 模式，同 browserApi）
- 读写红线：读走 `new-sql:query`（SqlStr 直传），写走 `new-sql:upsert`（primaryKey='key'），删走 `new-sql:delete`，收藏走 `new-sql:update`
- **旧数据迁移**：首次调用时读 electron-store 旧键 `imageResource`（[{val,name,origin}]）逐条入库，完成后写标记 `resource:legacy-migrated`（迁移标记存在 basic_info/setStore 体系内）

## 路由
- `RouteNames.RESOURCE_MANAGE` → path `/resourceManage`

## 用到的 IPC 通道
- `resource:read-text-file`（handle，`{path}`）→ 文本预览，主进程限 2MB 截断，返回 `{success, content, truncated, size}`
- `resource:delete-file`（handle，`{path, cacheDir}`）→ 删物理文件，**白名单校验**：仅允许删 fileCachePath 目录内文件；ENOENT 视为成功（幂等）
- `new-sql:query/upsert/delete/update` → 资源数据读写
- `save-file`（upload.vue 内部）→ 分片落盘
- `open-file-in-assets-manager`（send，`{path}`）→ 打开文件位置（dialog.ts）

## upload.vue 的加法改动（共享组件，其他页面不受影响）
- 新增 prop `legacyStore`（默认 true）：false 时不再写旧 electron-store `imageResource`
- 新增 emit `fileSaved`：`{path, name, size}`，资源管理页据此去重 + 入 SQLite

## 业务行为约定
- **上传去重**：同名且同大小的文件已入库时，跳过入库并删除刚落盘的重复文件，提示「已跳过」
- **删除策略**：确认弹窗内勾选「同时删除物理文件」才删磁盘文件；未勾选仅删记录（默认）
- **预览导航**：基于当前筛选排序后的展示列表（displayItems）做上一个/下一个
- **视图模式**持久化：electron-store 键 `resource:view-mode`
- 搜索/筛选/排序均为前端全量过滤（一次查库，不逐交互查库）

## 复用 / 集成点
- 复用 `UploadVue`（注意 legacyStore prop）、`AppDialog` 预览弹窗、`FileIcon`、`LucideIcon`
- 命令面板 REGISTRY 可跳转

## 特有坑 / 注意
- `fileProtocol`（`jlocal:///`）资源路径为本地绝对路径经协议转换；预览图片/视频/音频/PDF 的 src 均为 `fileProtocol + item.path`
- 历史 bug：旧版曾调用 `sendSync('read-file', ...)`，该通道从未在主进程注册（死代码）——已由 `resource:read-text-file` 替代
- 主进程删物理文件必须传 `cacheDir`（取 `useCacheSet` 的 fileCachePathC），白名单防误删系统文件
- `resource:delete-file`/`read-text-file` 内部会 strip `file://` 前缀并 decodeURIComponent，历史脏路径可兼容
