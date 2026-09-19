# 模块：小纸条（noteSlip，P1-6）

> 双端同名【小纸条】。定位：**PC ⇄ 手机 的文字 / 链接速传**（单条 ≤8000 字）。
> 大文件、图片、视频仍走「文件互传」（`modules/file-transfer.md`），不要在这里扩文件能力。

## 1. 定位与边界

| 项 | 值 |
|---|---|
| 路由 | `/noteSlip`（`RouteNames.NOTE_SLIP`，菜单「系统与资源」组，图标 `StickyNotePlus`） |
| 主进程 | `electron/main/module/noteSlip.ts`（`initNoteSlip()`） |
| 渲染端 | `src/views/noteSlip/`（types / api / components）+ `src/store/useNoteSlip.ts` |
| 表 | `note_slip`（**不入同步白名单**） |
| 传输 | **复用 47124 数据面**（`registerDataRoute`），**不新开端口、不新写协议**；发现复用 47123 |
| 移动端对称实现 | `jianli-mobile-app/lib/features/note_slip/`（路由 `/slip`） |

⚠️ **改主进程必须重启 Electron**。

## 2. 协议契约（双端必须逐字对齐）

端点（PC 与手机**互为主从**，两端都注册同样两个端点）：

| 方法 | 路径 | 作用 | 载荷 |
|---|---|---|---|
| GET | `/slip/ping` | 能力探测（排错用） | 响应 `{ok:true, role:'pc'|'app', support:true}` |
| POST | `/slip/push` | 推送一条 | 请求 `{id, from:{name,platform}, kind:'text'\|'url', content, ts}`；响应 `{ok:true}` 或 `{ok:false,error}` |

- **`id` 即幂等键**：对端重复推送同 `id` 只更新记录、**不重复弹通知**（`PC` 用 `query` 查 key 是否存在判 `fresh`；移动端同理）。
- `platform`：PC = `win32-electron`，手机 = `android` / `ios`。**这是两端筛选对端的唯一依据**
  —— PC 的 `slip:scan` 过滤掉 `platform` 含 `electron` 的项（PC 之间互发无意义）；
  移动端页面反过来只列 PC。
- `kind` 由 `isUrl()` 启发式判定：无换行、无空格且以 `http(s)://` 开头 → `url`，否则 `text`。
- 上限 `MAX_CHARS = 8000`（与移动端 `kSlipMaxChars` 一致）；超限 PC 返回 `413`、移动端拒收。
- 404（对端未注册 `/slip/*`）→ PC 返回 `unsupported:true`，UI 提示「请更新到最新版」。

## 3. 表 `note_slip`（双端同构）

| 列 | 类型 | 说明 |
|---|---|---|
| `key` | TEXT **主键** | 幂等键 `${ts}-${rand}` |
| `direction` | TEXT | `in` 收到 / `out` 发出 |
| `kind` | TEXT | `text` / `url` |
| `title` | TEXT | 首行摘要（≤40 字，超长加 `…`） |
| `content` | TEXT | 全文 |
| `peer_name` | TEXT | 对端设备名 |
| `peer_ip` | TEXT | 对端 IP |
| `read` | INTEGER | 0 未读 / 1 已读（发出的恒为 1） |
| `created_at` | INTEGER | 毫秒时间戳 |

- PC：`ensureTableExists("note_slip", NOTE_SLIP_COLUMNS, "key", { primaryKeyType: "TEXT" })`（与 file_transfer 同款）。
- 移动端：`lib/core/db/tables/note_slip.dart`，`schemaVersion 5→6` + `onUpgrade`，**须跑**
  `dart run build_runner build -d`。
- **不入同步白名单**：三处（`kSyncableTables` / `SYNCABLE_TABLES`+`tablePk` / `SYNC_TABLES`）**都不动**。
  收发记录是本机行为，同步会把两端记录互相灌进对方收件箱。
- 只保留最近 `KEEP_ROWS = 300` 条（`trim()`，写一条后调用）。

## 4. IPC 与事件

| 通道 | 方向 | 说明 |
|---|---|---|
| `slip:scan` | 渲染→主 | 扫描局域网**手机**（剔除 electron 平台），顺手把扫到的手机记入目标清单 |
| `slip:targets` | 渲染→主 | 已记忆的发送目标（`electron-store` 键 `_slip_targets`，最多 8 个） |
| `slip:last-peer` | 渲染→主 | 最近一次成功发送的目标 IP（`_slip_last_peer`），空串 = 还没发过 |
| `slip:send` | 渲染→主 | `{ip?, text, peerName?}`；`ip` 省略时用最近目标 |
| `slip:send-clipboard` | 渲染→主 | `{ip?}` 把当前系统剪贴板文本发到目标 |
| `slip:list` | 渲染→主 | 本机收发记录（`created_at` 倒序） |
| `slip:read` | 渲染→主 | `{key}` 标记已读 |
| `slip:delete` | 渲染→主 | `{key}` 删除单条 |
| `slip:clear` | 渲染→主 | 清空全部（先 `query` 拿全部 key 再逐条 `del`——**`del` 的 condition 不可空**） |
| `slip:received` | 主→渲染 | `{key, content, kind, from}` 收到新纸条 |

导出：`sendClipboardSlip(ip?)`（供 IPC / 全局快捷键 / 托盘三处共用）。

## 5. 三个发送入口（用户拍板）

| 入口 | 位置 | 行为 |
|---|---|---|
| 页面输入 | `src/views/noteSlip/components/SlipCompose.vue` | 目标下拉 + 扫描 + 手动 IP；`Ctrl+Enter` 发送；另有「发剪贴板」按钮 |
| 全局快捷键 | `registerShortcut` 表 type = `send_clipboard_slip` | 默认 `Ctrl+Alt+S`，用户在「注册快捷键」页可改；回执走 `notifyTrayBalloon` |
| 托盘菜单 | `electron/main/module/tray.ts`「发小纸条（剪贴板）」 | 同上，气泡回执 |

⚠️ **Electron 读不到别的进程的文本选区**，只能读系统剪贴板，所以「选中文字即发送」不存在；
「先模拟 Ctrl+C 再读」会覆盖用户剪贴板，默认不做。

## 6. 渲染端结构

```
src/views/noteSlip/
  types.ts                      NoteSlipItem / SlipPeer / SlipTarget / SLIP_MAX_CHARS
  api/noteSlipApi.ts            唯一 IPC 出口（window.ipcRenderer.handlePromise）
  components/SlipCompose.vue    发送区（目标 + 输入 + 计数 + 发送）
  components/SlipList.vue       记录列表（方向徽标 / 复制 / 打开链接 / 删除 / 点行标已读）
  index.vue                     薄壳（说明条 + 发送卡 + 记录卡）
src/store/useNoteSlip.ts        Pinia setup store（状态 + 动作 + slip:received 订阅）
```

- 全局通知：`src/layout/index.vue` 监听 `slip:received` → `ElNotification`（内容摘要 ≤80 字），
  **点击直达 `/noteSlip`**。这样不在小纸条页也能看到。
- 图标：`iconMap.noteSlip = 'StickyNotePlus'`；本模块用到 `ClipboardCopy` / `ArrowDownLeft` /
  `ArrowUpRight` 三个新图标，已在 `src/components/LucideIcon.vue` 的 import 与 `nameMap` **两处**登记
  （⚠️ 只加一处会 fallback 成 CloudAlert）。

## 7. 主进程注册位置

`electron/main/index.ts` 的 `runDeferredInits()` 步骤表：

```
['sync', initSync], ['transfer', initTransfer], ['ferry', initFerry],
['remoteControl', initRemoteControl],
['noteSlip', initNoteSlip],   // ⚠️ 必须排在 sync 之后（依赖 registerDataRoute）
```

`registerShortcut.ts` 与 `tray.ts` 都 `import { sendClipboardSlip }` —— 快捷键/托盘可能早于
`initNoteSlip()` 注册，但只在用户触发时才调用（那时早已初始化完），无循环依赖风险。

## 8. 移动端接收时机（双开关，用户拍板）

`lib/features/note_slip/note_slip_bootstrap.dart`：basic_info `slip_always_on`

- `'1'` 冷启动常驻：首帧即 `startServer + startResponder`。
- `'0'`（默认）仅开页面时可收：进 `/slip` 才拉起。

⚠️ 数据面是**全局共享**的（同步页 / 互传页也会拉起），所以即便选「仅开页面时」，
只要开过同步页/互传页服务同样在跑、照样能收到 —— 既有机制的自然结果，不是 bug，不要去「强行关闭」。

另外两条移动端铁律：
1. `registerRouteHandler` **必须幂等注册**（静态守卫布尔），否则一次请求被处理两遍、弹两条通知。
2. 通知渠道 `slip`（High + `NotificationPrivacy.Public`）——**渠道重要性创建后锁定**，键名不可再改。

## 9. 验证清单

1. `vue-tsc --noEmit` 零错误（已过）。移动端 `dart analyze lib/features/note_slip ...` 零 issue（已过）。
2. 手机开小纸条页 → PC 扫描应看到手机 → 发一条 → 手机通知栏弹出、页面出现 `in` 记录。
3. 反向：手机发 → PC 右下角 `ElNotification` 弹出，点击跳到 `/noteSlip`。
4. 快捷键 `Ctrl+Alt+S`（复制一段文字后）→ 托盘气泡「小纸条已发送」。
5. 重复推送同 `id`（可临时改 id 固定复现）→ 只更新不重复弹通知。
6. 模拟器：`adb forward tcp:47125 tcp:47124` 后手动填 `127.0.0.1:47125`。
