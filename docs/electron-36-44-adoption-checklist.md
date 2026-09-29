# Electron 36 → 44 特性接入清单（待决策）

> **状态：全部未执行。** 本文只做「可行性登记 + 决策台账」，供后续需要时逐项翻牌。
> 未动手的原因：已评估的收益项要么改动面跨模块、要么属"新增功能"而非"替换实现"，需要产品侧判断；
> 不建议项已写明确否依据，目的是**避免将来重复评估**。
>
> 建档日期：2026-09-29 ｜ 建档时的基线 commit：`0616969`

## 〇、前提：本仓已在 44 上

| 项 | 值 |
|---|---|
| `electron` | **44.4.5**（`node_modules/electron/package.json` 实测） |
| 升级提交 | `0616969 chore(deps): 升级 Electron 36→44 并迁移剪贴板异步 API，全量清零类型错误` |
| 内嵌 Node / Chromium / V8 | 24.18.1 / 152.0.7977.54 / 15.2 |
| `electron-builder` | 26.17.0 ｜ **`asar: false`** ｜ win 目标 **仅 x64** nsis |

**关键认知**：36→44 这次是**机械式平移**（修类型 + 迁剪贴板 API），**没有接入任何新能力**。
因此本文盘点的是「44 已经在机器里、但代码还没用上的能力」，而**不是**「要不要升级」。

## 一、已经白拿（零代码，升级即生效）— 无需任何行动

- [x] **E43 启动性能工程**：主进程改从内嵌 Node.js startup snapshot 启动；框架包与 preload 缓存为编译后 V8 bytecode；sandboxed renderer 启动数据在导航前推送（不再走阻塞 IPC）。preload 堆栈现在能显示正确文件路径与行号。
- [x] **ThinLTO + PGO**：Linux/Windows release 包启用 ThinLTO；V8 builtins（Array/String/RegExp 等）启用 profile-guided 优化；E44 起消费 Electron 自产 PGO profile。**未启用 wasm trap handlers**（在 `WasmTrapHandlers` fuse 后）。
- [x] **E44 IPC / 初始化性能优化**与运行时性能改进。
- [x] **Chromium 136 → 152 的全部安全修复**。
- [x] **E42 供应链加固**：electron 不再用 postinstall 下载二进制，改为首次运行 bin 时动态下载。本仓 `scripts/fetch-electron.cjs` + `npm run fetch-electron` 正是配套产物（另见 `electronDownload` 镜像配置）。

> ⚠️ **踩坑提示**：E42 同时**移除了 `ELECTRON_SKIP_BINARY_DOWNLOAD` 环境变量**。若将来在 CI 里用该变量跳过下载，会失效，须改用新机制。

---

## 二、待决策清单（按优先级）

### ✅ P0-1 —— `net.WebSocket` 替换 `globalThis.WebSocket`

- [ ] **决策**：接入 / 不接入 / 暂缓（勾选）
- [ ] 实施
- [ ] 验证

**这是代码里已自陈的明确缺口，推荐优先做。**

| 项 | 内容 |
|---|---|
| 新增版本 | E42 引入，E44 稳定（`#51593`，同时在 42/43/44） |
| 落点 | `electron/main/module/netRequest.ts:245-246`（`net-request:ws-open` 处理器） |
| 现状 | `const ws = new (globalThis as any).WebSocket(url);` —— 用 Node undici 全局，`as any` 绕过类型 |
| **缺口证据** | 该文件第 8 行注释原文：「**WebSocket 连接管理（Node 22 内置全局 WebSocket，暂不支持自定义握手 Header）**」 |
| **正解证据** | `electron.d.ts:19905` `interface WebSocketOptions` 含 `headers?: Record<string, string>`（"Extra HTTP headers to send with the opening handshake"）、`origin`、`session`、`partition`、`protocols` |
| 类型来源 | `electron.d.ts:10358` `interface Net { WebSocket: typeof WebSocket }`；类定义 `:19800` |

**可获收益（4 项）**

1. **补上握手 Header 能力** —— 可对需要鉴权头的 WS 服务端发起连接（当前做不到）。
2. **去掉 `as any`** —— 拿到真实类型（`net.WebSocket` 是正式导出），且不再依赖"全局是否存在"的运行时假设。
   ⚠️ 与本项目红线 #5 同源：`as any` 绕过报错 ≠ API 存在。这里恰好相反——**官方提供了正规 API，应当从"绕过"改为"接入"**。
3. **`binaryType` 默认 `'nodebuffer'`**（Electron 扩展）—— 二进制消息**直接是 `Buffer`**，主进程侧免转换。当前用 undici 全局时二进制落到 `Blob`/`ArrayBuffer`，需自行转换。
4. **走 Chromium 网络栈 + 可绑 `session`** —— 可继承会话 Cookie/代理/证书设置。潜在价值：`dataAcquisition/browser.ts` 目前是**手工把登录 Cookie 存进 electron-store**，若 WS 需要登录态，可改为绑定同一 session 自动携带。

**改动面**：仅 `netRequest.ts` 一个模块（3 个 handler：`ws-open` / `ws-send` / `ws-close`）。
`wsClients` 的表类型、`wsPush` 推送逻辑均可保留；`onmessage` 的 `ev.data` 取值不变。

**风险 / 注意**

- 走 Chromium 网络栈意味着**受系统代理与证书设置影响**。若用户配了代理，`ws://` 局域网场景可能受影响 —— **局域网推送类需求（小纸条/局域互传）应保持用原生 socket，不要盲目改**。
- 需确认 `new net.WebSocket()` 的**异常时机**（构造即抛 vs `error` 事件），保持现有 try/catch 语义不漂移。

**验证方式**

1. `tsc -p tsconfig.node.json --noEmit` exit 0。
2. 真机起 dev，选一个**需要自定义 Header 的** `wss://` 端点，确认握手成功（这是新能力，也只能这样证伪"没生效"）。
3. 对现有已能用 WS 端点做**回归**：连接 / 收消息 / 发消息 / 关闭四条路径，外加二进制消息确认拿到 `Buffer`。

---

### ✅ P0-2 —— `webContents.setZoomMode('isolated')`（缩放隔离）

- [ ] **实测确认触发路径**（前置，见下）
- [ ] **决策**：主窗口用 `disabled` / `isolated` / 不动
- [ ] **决策**：浏览器 webview 侧是否改为 `isolated`
- [ ] 实施
- [ ] 验证

| 项 | 内容 |
|---|---|
| 新增版本 | E44（`#49962`） |
| 落点 A | 主窗口 + 小窗 + 锁屏窗（同源，互串） |
| 落点 B | `src/views/browser/composables/useWebviewBridge.ts:183`（`wv.setZoomLevel(next)`） |
| **机制证据** | `electron.d.ts:18731` NOTE 原文：「The zoom policy at the Chromium level is **same-origin by default**, meaning that the zoom level for a specific domain **propagates across all instances of windows with the same domain**. To use per-webContents zoom instead, set the zoom mode to `'isolated'`」 |

**四种模式语义（`electron.d.ts:18738-18752`）**

| 模式 | 行为 |
|---|---|
| `default` | 按 origin 自动共享（当前行为） |
| `isolated` | 按 webContents 独立，互不影响；**跨导航保持** |
| `manual` | 关闭自动缩放，仅派发 `zoom-changed`，由应用自行管理 |
| `disabled` | 该 webContents 完全禁止缩放，回到默认级别 |

**两个可证的"模型不一致"**

1. **浏览器模块**：`useBrowser.ts:62` 把 `zoomLevel` 建模为**按标签**（`tab.zoomLevel`），
   但 `wv.setZoomLevel()` 在 `default` 模式下**按 origin 生效** ⇒ 同域两个标签实际互串，
   而 store 里两份 zoomLevel 各自独立 ⇒ **UI 显示与实际渲染脱节**；
   且**导航到新域后 zoom 会被该域的历史值覆盖**，与"每标签一个 zoom"的模型再次不符。
   → 改 `isolated` 可让运行时与既有数据模型**对齐**（且跨导航保持，正是标签该有的语义）。
2. **主窗口 / 小窗 / 锁屏窗**：三者加载**同一 `index.html`（仅 hash 路由不同）⇒ 同源** ⇒ 缩放互串，
   而已知主窗口是「恒定全屏 + 共用 UI 布局」的设计，缩放一旦串过去会直接破坏小窗排版。

**⚠️ 前置实测（必做，不要跳过）**

按红线 #5「不臆测」，**"用户能否触发缩放"这件事我尚未实测**。触发路径可能是：
① 未设 `Menu.setApplicationMenu(null)` ⇒ Electron 默认菜单的 View > Zoom In/Out 加速键（Ctrl + `=` / `-`）；
② Ctrl + 滚轮。
**请先在真机按 Ctrl+`=` 看小窗/浏览器 UI 是否跟着变**，再决定动不动。

- 若**不可触发** → 本项降级为「防御性加固」，可选做（成本一行）。
- 若**可触发** → 按下面实施。

**实施要点**

- 主窗口：`win.webContents.setZoomMode('disabled')`（若要彻底禁掉误触）；
  或 `'isolated'`（若希望主窗口可缩放但不外溢）。
- ⚠️ **`setZoomMode` 只存在于 `WebContents`，`<webview>` 标签未暴露**：
  全 d.ts 中 `setZoomMode` **仅出现 1 处（L18753）**，而 `setZoomLevel` 出现在 18736 / 19129 / 20488 三处。
  ⇒ webview 侧两条可行路径：
  - **(a)** 挂在主进程**已有的** `app.on('web-contents-created')` 里（`mainWindow.ts:169-176`，
    现成判断 `contents.getType() === 'webview'`），加一行 `contents.setZoomMode('isolated')`；
  - **(b)** 或给 `<webview>` 标签加 `webpreferences="zoomMode=isolated"`（`WebPreferences.zoomMode`，见 `electron.d.ts:19665`）。

**改动面**：主进程 1~2 行 + （若做 webview 侧）1 行。
**风险**：极低。确定性行为变更，无平台差异。

**验证方式**：主窗口设 `disabled` 后按 Ctrl+`=` 应无反应；浏览器开两个**同域**标签，各自缩放后互不影响，导航后保持。

---

### 🔶 P1 —— 原生通知 + 操作按钮（属「新增功能」，非替换）

- [ ] **决策**：做 / 不做（这是产品交互变更，需你拍板）

| 项 | 内容 |
|---|---|
| 新增版本 | E40 增加 Windows `urgency` 选项；**E41 扩展 Windows 通知支持 buttons / select dropdowns / replies** |
| 现状证据 | **全库零处 `new Notification`**（`electron/` 全文扫描仅命中 `index.ts:74` 一句注释与 `browserPermission.ts:27` 的权限中文名）⇒ 提醒全部走**自绘窗口** |
| 可能的收益 | 本 App 核心是「强制休息/护眼」= **打断型提醒**。原生 toast 在用户全屏工作时更可靠地浮现，且能**直接把「开始休息 / 稍后提醒」做成按钮**，省掉"点开窗口再操作"一跳 |

**为什么标 P1 而不是 P0**：它不是"替换一个实现"，而是**新增一条提醒通道**，
会与现有提醒引擎（`newReminder.ts` / `job.ts` / `applyStateWindowBehavior`）的交互设计重叠。
**需先回答**：原生 toast 与现有自绘提醒窗是**并存**还是**替代**？锁屏态（`lockScreen=1` + screen-saver 级置顶）语义如何与 toast 共存？

**改动面**：中（新增通知模块 + 提醒引擎分支 + 设置项开关）。

---

### 🔷 P2 —— UI / 主题层打磨（低成本，纯收益，零风险）

- [ ] `-electron-corner-smoothing`（E36 落地 / E37 主推）—— squircle 圆角
  - [ ] 决策
  - 自定义 CSS 属性，`border-radius` 的 squircle 版本，可作用于 border/outline/shadow。
  - ⚠️ **Windows 上 `system-ui` 的计算值是 0%**（macOS 才是 60%）⇒ **必须显式写百分比**，否则毫无效果。
  - 建议落点：卡片类组件（与现有 `card_textures.dart` / 卡片纹理体系同层）。应先做**单点对比截图**再决定铺开。
- [ ] `win.setAccentColor(null)`（E40）—— 跟随系统强调色
  - [ ] 决策
  - `null` 表示"重置为跟随系统"。当前主题系统由 CSS 变量 `--color-primary` 驱动（主色 `#6C5CE7`），
    可考虑增加一档「跟随 Windows 强调色」。**属可选偏好，不是缺陷**。
- [ ] `webContents.caretBrowsingEnabled`（E44）—— 光标浏览
  - [ ] 决策
  - 可给 `src/views/ebookReader` 做键盘/无障碍浏览辅助。边缘需求。

---

## 三、明确不建议接入（已否，勿重复评估）

> 本节的用途：**将来再看到这些特性名时，直接引用此处结论，不要再走一遍调研。**

| 特性 | 版本 | 否决理由（均为本仓实测事实） |
|---|---|---|
| `windowStatePersistence` | E44 | ① 主窗口 `resizable:false` + `frame:false` + **恒定 `setFullScreen(true)`**（`mainWindow.ts:99-117` 与 `:192`）⇒ 位置/尺寸**语义不存在**；② 小窗是**自研 IPC + `setBounds` 拖拽**（`newWindow.ts:343-359`），交给原生会与现逻辑打架；③ 该 API 被官方标注 **`_Experimental_`**（`electron.d.ts:4101`）。另：**此 API 要求传 `name`，否则完全不生效**。 |
| ASAR 完整性校验 | E39 转正 | `electron-builder.json5:5` 是 **`"asar": false`** ⇒ 无 app.asar，整条链路不存在。 |
| 移除 32 位构建 | E44 | `electron-builder.json5:49-51` win 目标**仅 `arch: ["x64"]`**，不受影响。（若将来要出 ia32 包则必须另想办法。） |
| 剪贴板 W3C 异步重构 | E44 | **已完成**：`electron/main/module/utils/clipboardCompat.ts`（306 行适配层），第 9 轮已修掉 `ClipboardItem is not defined` 启动崩溃。**无遗留**。 |
| PDF 改 OOPIF（不再建独立 WebContents） | E41 | 本仓 PDF 走**自研 pdfjs-dist + 叠加层**（`src/views/ebookReader`），不依赖内建 PDF 查看器。⚠️ **唯一残留检查点**：若有代码按 `WebContents` 类型/`plugin-crashed` 之类识别 PDF 资源，会失效（官方指引：改用 **frame tree**）。**建议扫一遍 `pdf.ts` / 浏览器模块的打印与下载分流逻辑**。 |
| Linux 桌面集成系 | E39~E44 | Wayland 默认（`--ozone-platform` 默认 `auto`）、`--no-experimental-global-navigator`、`setBadgeCount`/`setProgressBar` 免 libunity、WCO 系统主题图标、`win.setOpacity`、框架窗口默认圆角、GTK4 默认。**Windows 主战场，全跳过。** |
| macOS 专属 / 通知迁移 | E36~E44 | Writing Tools 与 Services（需 `menu.popup({ frame })`）、`MenuItem.badge`、`createFromNamedImage` 支持 SF Symbols、subLabel。**跳过。** ⚠️ **但记一条**：E42 起 macOS 通知由 `NSUserNotification` 改为 **`UNNotification`**，**未签名的应用通知会直接 `failed`**；将来若发 macOS 包必须签名。E44 还要求 **macOS ≥ 13**（且 E38 起已要求 ≥12）。 |
| `--host-rules` 开关 | E39 弃用 | 用 `--host-resolver-rules` 替代。本仓未使用该开关。 |
| `net.request` 的 `bypassCustomProtocolHandlers` | E38~E40 | 本仓已有 `protocol.ts`（自定义 `jlocal`）+ 多处 `net.fetch`。该选项仅在"**要 fetch 自己的自定义 scheme 又刻意绕过自己的 handler**"时才需要 —— 当前无此场景。 |
| `plugin-crashed` 事件 | E38 移除 | 全库未监听。 |
| `webFrame.routingId` / `findFrameByRoutingId` | E38 弃用 | 全库未使用（应改用 `frameToken` / `findFrameByToken`）。 |
| `webUtils.getPathForFile` | E32（**不在本次区间**） | 列出仅为澄清：本次 36→44 区间内**不存在**该改动，若将来遇到 `File.path` 为 undefined 的问题，根源在 E32，不在此区间。 |
| `ELECTRON_SKIP_BINARY_DOWNLOAD` | E42 移除 | 见第一节踩坑提示；本仓未使用，但 CI 若将来引入需注意。 |

---

## 四、顺带发现的风险项（**独立于 36→44**，建议单独立项）

### R-1 主窗口安全配置过于宽松

- [ ] 决策：评估 / 维持现状

`mainWindow.ts:107-116` 主窗口同时开启：
`nodeIntegration: true` + `webSecurity: false` + `webviewTag: true` + `plugins: true`，
而浏览器模块（`src/views/browser/components/WebViewPane.vue:12`）用 **`<webview>` 加载任意公网页面**。

这正是 Electron 36→44 期间**持续收紧**的那一类配置面。**注意区分**：
- `<webview>` 官方**不推荐**、倾向用 `WebContentsView` —— 但那是**大重构**，且本仓多标签逻辑
  （4 张 drift 表、单向 provider 通道、`_historyStep` 历史步进、三级广告拦截）已相当完善，
  **明确不建议现在动**。
- 真正值得单独评估的是 **`webSecurity: false` + `nodeIntegration: true` 的暴露面**，
  以及是否可用 `contextIsolation` + preload 收窄。
- ⚠️ 已知约束：`webSecurity:false` **不能**替代 `protocol.registerSchemesAsPrivileged` 的
  `corsEnabled`（第 43 条坑已记录，`protocol.ts` 已修）。评估时必须一并考虑自定义协议。

### R-2 设备主密钥明文落盘

- [ ] 决策：改用 safeStorage 包裹 / 维持现状

`electron/main/module/vault/deviceKey.ts:30-38`：**32 字节随机主密钥以明文 64 位十六进制写入 electron-store**，
由 `vault/crypto.ts` 的 PBKDF2 派生实际加密密钥 —— 即**读到该文件即可解开全部"数据型密钥"保险库**
（密保、股票 API Key 等）。

- **全库当前 0 处使用 `safeStorage`**（全文扫描确认）。
- E42 强化了 `safeStorage`：**新增异步功能 + 支持更多后端**。Windows 上它走 **DPAPI**（绑定当前用户账户）。
- 用 `safeStorage.encryptString()` 包裹这个主密钥是**纯收益**加固：落盘变为 DPAPI 密文，
  异机/异账户拷走配置文件也解不开。
- ⚠️ **必须纳入评估的副作用**：DPAPI 绑定当前 Windows 用户 profile ⇒
  用户**重装系统 / 换账户 / profile 漫游**会导致密钥不可恢复。
  本仓已有「强制重新录入」迁移策略（`appLock.ts:243`），语义上**是兼容的**，
  但需确认对文件保险箱（`fileVault.ts`）的后果是否可接受 —— **这是本项目真正的决策点，不是技术障碍**。

---

## 五、决策台账（后续填这里）

| 编号 | 项 | 决策 | 日期 | 备注 |
|---|---|---|---|---|
| P0-1 | `net.WebSocket` | _待定_ | | |
| P0-2 | `setZoomMode` 缩放隔离 | _待定_ | | 需先实测 Ctrl+= 触发路径 |
| P1 | 原生通知 + 按钮 | _待定_ | | 需先定交互（并存 or 替代） |
| P2-a | `-electron-corner-smoothing` | _待定_ | | 需先单点截图对比 |
| P2-b | 跟随系统强调色 | _待定_ | | |
| P2-c | `caretBrowsingEnabled` | _待定_ | | |
| R-1 | 主窗口安全配置评估 | _待定_ | | |
| R-2 | safeStorage 包裹设备主密钥 | _待定_ | | 先定"密钥丢失可接受性" |

---

## 六、复现与核查方法（给未来的自己）

**核对新 API 是否存在 / 语义如何**——一律以本机 `node_modules/electron/electron.d.ts` 为准（版本精确匹配）：

```bash
# 查某个 API 在哪些接口上暴露（能暴露"标签没暴露、只有 WebContents 有"这类差异）
grep -n "setZoomMode" node_modules/electron/electron.d.ts

# 查选项对象支持哪些字段
grep -n -A 30 "interface WebSocketOptions" node_modules/electron/electron.d.ts
```

**核对本仓是否已使用某能力**（注意排除构建产物与 `release/`，否则全是噪声）：

```
Grep 工具，glob: !**/{release,node_modules,dist-electron,dist}/**
```

**类型校验**（本机 bash 缺 `sed`/`dirname`，`node_modules/.bin` 的 shim 不可用，必须直调 JS 入口）：

```bash
node ./node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit
node ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

**版本 → 栈对照**（权威源 `releases.electronjs.org/schedule.json`）：

| 版本 | Chromium | Node | V8 | 状态 |
|---|---|---|---|---|
| E36 | 136 | 22.14 | 13.6 | EOL |
| E37 | 138 | 22.16 | 13.8 | EOL |
| E38 | 140 | 22.16 | 14.0 | EOL |
| E39 | 142 | 22.20 | 14.2 | EOL |
| E40 | 144 | 24.11.1 | 14.4 | EOL |
| E41 | 146 (推定) | 24.14 | — | EOL |
| E42 | 148 | 24.15 | — | 维护中 |
| E43 | 150 | 24.17 | 15.0 | 维护中 |
| **E44** | **152.0.7977.54** | **24.18.1** | **15.2** | **当前（本仓）** |

> E41 的 Chromium 主版本为按 E40(144)/E42(148) 序列推定，未逐条核实；其余均有 release notes 出处。
