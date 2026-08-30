# IPC 通道契约（ipc-channels）

> 渲染端统一经 `src/utils/common.ts` 的 `getStore` / `setStore` / `send` / `sendSync` / `invoke` → `window.ipcRenderer.*`。通道名多为字符串常量，分三类：请求-响应（invoke/handle）、单向通知（send/on）、主→渲染推送（webContents.send / ipcRenderer.on）。

## 数据层 / 存储
| 通道 | 方向 | 用途 |
|---|---|---|
| `new-sql:query` | 渲染→主 | 通用查询（支持顶层 `SqlStr` 或 `conditions.SqlStr`） |
| `new-sql:count` | 渲染→主 | 计数 |
| `new-sql:insert` / `upsert` / `update` / `delete` | 渲染→主 | 增 / 按主键覆盖 / 改 / 删 |
| `new-sql:record-pomodoro` | 渲染→主 | 番茄钟记录写入 |
| `new-sql:execute` | 渲染→主 | ❌ 危险，**禁用** |
| `new-sql:explain` / `transaction` / `get-table-list` | 渲染→主 | 执行计划 / 事务 / 表列表 |
| `get-store` / `set-store` / `replace-store` / `clear-store` / `get-stort-all` | 双向 | electron-store 读写（注意 `get-stort-all` 疑似拼写错误） |

## 提醒引擎 newReminder
| 通道 | 方向 | 用途 |
|---|---|---|
| `get-tips` / `tips-save` / `tips-delete` | 双向 | 读取 / 保存 / 删除提醒 |
| `tips-force-state` / `tips-inject-state` / `tips-end-injected-state` | 渲染→主 | 状态注入 / 强置 |
| `request-tips-state` / `tips-reload` | 渲染→主 | 请求状态 / 重载引擎 |
| `tips-trigger` | 主→渲染 | 提醒到点（`App.vue` 接住弹通知，习惯类唤起打卡小窗） |
| `tips-state-change` / `tips-state-sync` | 主→渲染 | 状态进入（弹通知）/ 同步补偿（不弹） |

## 小窗管理 newWindow
| 通道 | 方向 | 用途 |
|---|---|---|
| `open-new-window` / `close-new-window` / `hide-new-window` / `close-win` | 渲染→主 | 打开 / 关闭 / 隐藏 / 按名关 |
| `sync-data-to-other-window` | 双向 | 跨窗口广播配置与数据 |
| `enable-mouse-click-through` / `disable-mouse-click-through` | 双向 | 透明窗鼠标穿透开关 |
| `get-window-bounds` / `set-window-bounds` | 双向 | JS 拖拽移动坐标 |

## 功能类（主进程模块）
- **备份与恢复**：`backup:get-info` / `backup:create` / `backup:list` / `backup:restore` / `backup:select-backup-file` / `backup:restore-path` / `backup:delete` / `backup:open-dir` / `backup:get-auto-config` / `backup:set-auto-config`；导出：`export:get-modules` / `export:select-dir` / `export:run`（见 `modules/backup.md`）
- **快捷键**：`register-shortcut`（`globalShortcutFn` 分发 `open_habit_window` / `open_todo_window` / `open_pomodoro_window` / `open_clipboard_window` / `open_command_palette` / `open_quick_note` / `show_app` / `open_match_page`）
- **待办 / 番茄**：`update-todo-reminders` / `start-job` / `stop-job`（→主）；`job-start-tip` / `job-end-tip`（主→渲染）
- **天气 / 定位 / Bing**：`get-weather` / `get-weather-broadcast` / `get-current-position` / `get-bing-image`
- **系统 / 文件**：`get-fonts` / `get-default-file-path` / `open-file-by-default-app` / `get-installed-apps`；`start-scan` / `copy-files` / `copy-folder` / `rename-files`(+ `-reversed`) / `delete-files`（带 `-progress` 进度）
- **TTS**：`tts:speak` / `tts:stop` / `tts:get-voices` / `tts:is-available` 及 `tts:system:*`
- **电子书**：`ebook:*` 约 40 个（preload 封装，见 `preload/index.ts:54-389`）
- **截图 / 贴纸**：`screenshot:*` / `sticker:*`
- **股票**：`stock:*` 约 30 个（TickFlow，含缓存 / TTL / 自选）
- **加密**：`encrypt-pwd` / `decrypt-pwd` / `compare-pwd`
- **更新**：`get-app-version` / `check-for-update` / `download-update` / `install-update` / `open-external-url`（`download-progress` 主→渲染）
- **主窗口**：`quit-app` / `max` / `set-startup` / `hide-app` / `palette-navigate` / `open-match-page`(主→渲染) / `confirm-hide-app`(主→渲染)

## 命名空间（preload 暴露）
- `tts.*` / `ebook.*` / `clipboard.*` 为封装后的高阶 API；新增 IPC 优先在 preload 加封装再给渲染用。

## ⚠️ 死 / 未接通道（封装前核实）
渲染端发出但主进程未找到 handler：`save-file`、`get-file-list`、`save-debug-data`（可能走 worker 或已废弃）。

## 何时读本文档
需要新增 / 对接任一 IPC 通道，或排查「发了没反应」时。
