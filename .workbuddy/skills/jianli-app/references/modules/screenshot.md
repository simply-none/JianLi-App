# 截图工具 (screenshot) ［含 screenshotSelect 选区窗、sticker 贴图］

## 职责
全屏/区域截图、标注、复制到剪贴板、保存到本地、管理历史截图；`screenshotSelect` 是独立选区/标注浮窗；`sticker` 是把截图钉在桌面的常驻浮动窗口（Snipaste 风格，由本模块统一管理）。

## 关键文件
- `src/views/screenshot/index.vue`（主面板：历史列表、快捷键、来源面板；调用见行 366–844）
- `src/views/screenshotSelect/index.vue`（选区/标注窗，`screenshot:select-ready/cancel/capture-region/copy-text`）
- `src/views/sticker/index.vue`（贴图窗：`sticker:get` / `sticker:close`）
- 主进程：`electron/main/module/screenshot.ts`（全部 `screenshot:*`、`sticker:*` 的 `ipcMain.handle/on`）

## 路由
- `RouteNames.SCREENSHOT` → path `/screenshot`
- `RouteNames.SCREENSHOT_SELECT` → path `/screenshotSelect`
- `RouteNames.STICKER` → path `/sticker`

## 用到的 IPC 通道
- `screenshot:start`（`handle`，开始截图）、`screenshot:result`（主→渲染，回推整屏数据）
- `screenshot:select-ready` / `screenshot:select-cancel`（选区窗↔主）、`screenshot:select-rect`（选区坐标裁剪）
- `screenshot:capture-region`（`{dataUrl, action:'copy'|'save'|'sticker'}`）
- `screenshot:copy` / `screenshot:copy-text` / `screenshot:save` / `screenshot:persist`（落库+剪贴板/保存）
- `screenshot:get-displays` / `screenshot:capture-sources`（多显示器/窗口缩略图）
- `screenshot:get-shortcut` / `screenshot:set-shortcut` / `screenshot:clear-shortcut`（全局快捷键）
- `screenshot:open-path` / `screenshot:delete-screenshot`（历史管理）
- 历史记录经 `newSql`：`new-sql:query` / `new-sql:insert` / `new-sql:update`
- `sticker:get` / `sticker:list` / `sticker:open` / `sticker:close` / `sticker:close-by-id` / `sticker:close-all`

## 复用 / 集成点
- 选区窗、贴图窗均为独立路由小窗，遵循「小窗四件套」；常驻贴图窗须 `mouseEvents:true` 否则点击穿透（见 `small-window.md`）。

## 特有坑 / 注意
- **坐标缩放**：选区坐标需按 `getTargetDisplay().scaleFactor` 换算（`screenshot.ts` 内 `toCropRect`），高分屏下不做缩放会裁错区域。
- **常驻贴图穿透**：`sticker` 浮动窗若未在主进程 `createOtherWindow` 时带 `mouseEvents:true`，鼠标事件会穿透到桌面（`newWindow.ts:193` 判定）。
- `screenshot:result` / `screenshot:select-error` 是主进程主动 `webContents.send` 到对应窗口，渲染端要用 `ipcRenderer.on` 接收并妥善移除监听。
- 钉屏状态存 `screenshots` 表的 `sticker_status`（`visible`/`closed`），重启后按状态恢复，删除只改状态不删 DB 行。
