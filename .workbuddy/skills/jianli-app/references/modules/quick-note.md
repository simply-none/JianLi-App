# 快速记录小窗 (quickNote)

## 职责
常驻便签小窗：多笔记管理 + 4 种排版（minimal/glass/sidebar/classic）+ 皮肤切换，数据走通用 `query-data`/`set-data`（非 newSql 三件套），配置受小窗四件套纳管。

## 关键文件
- 小窗：`src/views/quickNote/index.vue`（核心逻辑：加载/保存/关闭/鼠标穿透/皮肤循环）
- 排版：`src/views/quickNote/layouts/`（LayoutMinimal/Glass/Sidebar/Classic）

## 路由
- `RouteNames.QUICK_NOTE` → `/quickNote`

## 用到的 IPC 通道
- `query-data`（渲染→主，拉笔记列表，`index.vue:163`）
- `set-data`（渲染→主，存笔记，`index.vue:228`，旧 data API 而非 newSql）
- `sync-data-to-other-window`（配置/数据变更广播，`:94`）
- `close-new-window`(`quickNote`，`:139`)、`disable/enable-mouse-click-through`(`quickNote`，`:143/:147`)
- `get-store` / `set-store`（读小窗配置 `window-mode:quickNote`）

## 复用 / 集成点
- **小窗四件套**：配置在 `windowSections.ts:194`（key=`quickNote`，含 4 种 layout 预设），store `useWindowMode` 的 `quickNoteWindowConfig`。
- **快捷键联动**：`registerShortcut` 的 `quickNoteShortcut`(type=`open_quick_note`) 由主进程 `registerShortcut.ts` 的 `toggleQuickNoteWindow()` 切换显隐。
- **鼠标穿透控制**：`index.vue` 左右 `mouse-* click-through` 实现拖动/点击区分，常驻需 `mouseEvents:true`。

## 特有坑 / 注意
- **用的是 `query-data`/`set-data` 旧通道**，不是 `new-sql:*` 三件套——这是项目早期的 data API，新增便签逻辑不要误改成 `new-sql`（除非确认已迁移）。
- **小窗必须 `mouseEvents:true`**：`quickNote` 是常驻捕获态，config 缺该字段会进入穿透态（点不动）。
- **皮肤/排版循环**：`cycleSkin`/`cycleLayout` 在本地维护 `currentSkin/currentLayout`，并通过 `sync-data-to-other-window` 广播，保持主窗口设置页与小窗一致。
