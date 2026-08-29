# 贴纸小窗 (sticker)

## 职责
由截图模块（screenshot）管理的「钉屏贴图」浮动窗口：把截图以半透明浮动窗口钉在桌面，支持滚轮缩放、双击/Esc 关闭。自身不配置、不持久化，完全由主进程 `screenshot.ts` 创建与回收。

## 关键文件
- 小窗：`src/views/sticker/index.vue`（仅渲染图片 + 缩放/关闭；无独立 store、无路由配置项）
- 管理方主进程：`electron/main/module/screenshot.ts`（`stickerWindows` Map `:92`、`sticker:get/open/close-*`、`loadRoute(win,'sticker'):500`）

## 路由
- `RouteNames.STICKER` → `/sticker`（路径须与主进程 `loadRoute(win,'sticker')` 一致）

## 用到的 IPC 通道
- `sticker:get`（渲染→主，按 `webContents.id` 反查本窗口要显示的贴图 dataUrl，`index.vue:35`；主进程用 sender 匹配 `stickerWindows`）
- `sticker:close`（渲染→主，关闭当前钉屏，`index.vue:43`）
- 关联通道（screenshot 侧）：`sticker:list` / `sticker:open` / `sticker:close-by-id` / `sticker:close-all`、`screenshot:capture-region`(action=`sticker`)、`screenshot:persist`

## 复用 / 集成点
- **由 screenshot 全权管理**：贴纸不是「小窗四件套」成员，没有 `windowSections` 条目、`useWindowMode` 里也没有配置；它的开关/位置/恢复全部在 `screenshot.ts`（启动时按 `screenshots` 表 `action='sticker'` 且 `sticker_status='visible'` 自动重建所有钉屏）。
- **截图动作入口**：截图标注后选「贴图」→ `finalizeCapture()`:416 落库 + 打开浮动窗口。

## 特有坑 / 注意
- **无 `mouseEvents` 配置项**：贴纸窗口由主进程直接 `createOtherWindow` 类逻辑创建，穿透/拖动由 CSS `-webkit-app-region: drag`（`.sticker-frame:94`）控制，不要在 `windowSections`/`useWindowMode` 里补配置。
- **数据按窗口匹配**：`sticker:get` 依赖主进程 `sender` 的 `webContents.id` 反查（`screenshot.ts:94`），多贴图同时存在靠 `recordId` 区分；渲染端拿不到「全部贴图列表」，只能取自己这一窗的图。
- **关闭不删库**：`sticker:close` 只是隐藏/关闭浮动窗口，DB 记录仍在（可经 `sticker:open` 重新钉屏）；真正删除要走截图管理。
- **改主进程需重启**：`screenshot.ts` 属主进程，改动必须重启 Electron。
