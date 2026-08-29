# 剪贴板历史 (clipboard)

## 职责
后台监听系统剪贴板，自动落库文本/富文本/图片历史；提供查询、筛选（全部/文本/链接/图片）、分页、去重、删除、写回系统剪贴板与「快速粘贴」面板。文本相同内容合并为一条并置顶，图片每次独立新增。

## 关键文件
- 主页面：`src/views/clipboard/index.vue`、`components/ClipboardList.vue`、`components/ClipboardItem.vue`、`api/clipboardApi.ts`（封装 clipboard:*）、`composables/`、`types.ts`
- 小窗：`src/views/clipboardMiniWindow/index.vue` + `QuickPastePanel.vue`、`QuickPasteItem.vue`
- 关联主进程：`electron/main/module/clipboard.ts`（`initClipboard`：建表 + `setInterval` 每秒监控落库；无独立 store，**数据落库发生在主进程，渲染端只读/回写**）
- 小窗开关：`src/store/useWindowMode.ts` 的 `clipboardWindowConfig` / `setShowClipboardWindow`

## 路由
- `RouteNames.CLIPBOARD` → `/clipboard`
- `RouteNames.CLIPBOARD_MINI_WINDOW` → `/clipboardMiniWindow`

## 用到的 IPC 通道
- `clipboard:query`（关键词+时间范围+类型筛选+分页；`clipboardApi.ts:19`）
- `clipboard:delete` / `clipboard:delete-many` / `clipboard:clear` / `clipboard:delete-by-condition` / `clipboard:dedup`
- `clipboard:write`（写回系统剪贴板，`mode:'raw'` 保留格式 / `'text'` 纯文本，并累加 `use_count`）
- `clipboard:simulate-paste`（仅 Windows；`clipboard.ts:214` 用 WScript SendKeys `^v`，小窗隐藏后发送）
- 主进程监控无渲染端触发；图片经 `clipboard.readImage().toDataURL()` 落库。

## 复用 / 集成点
- **小窗四件套**：`windowSections.ts:240`（key=`clipboard`，storeKey=`clipboardMiniWindow`），`useWindowModeSetting.ts` 三映射（storeConfig/showSetter/storeVisible），`useWindowMode` store，router `/clipboardMiniWindow`；常驻需 `mouseEvents:true`（穿透见坑）。
- **VirtualList**：`ClipboardList.vue:4` 长列表虚拟化。
- **命令面板**：未进 REGISTRY（noteSource 只覆盖 `note_book` 表）。

## 特有坑 / 注意
- **图片体积上限**：`clipboard_history` 中图片 dataURL 超过 `MAX_IMAGE_DATAURL_LENGTH`（2MB）只存占位文本「[图片过大，未保存]」，不存原图（`clipboard.ts:12/323`）。
- **合并语义**：纯文本/富文本相同 `text` 合并一条并置顶；图片不合并，每次新增。
- **主进程用 `newSqlExecute`（参数化）**做分页/去重/清空——这是主进程合法用法；渲染端业务增删改统一走 `clipboardApi` 封装的 `clipboard:*` handle，**不要**在渲染端裸 `new-sql:execute`。
- 小窗需 `mouseEvents:true`，否则点击穿透到下层窗口。
