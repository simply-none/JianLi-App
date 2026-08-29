# 内置浏览器 (browser)

## 职责
应用内内置浏览器面板，承载网页浏览/内嵌网页内容（区别于 `netRequest` 的自动化爬虫，本模块是「给人看的」常规浏览）。2026-08 完成 P1~P3 架构重构：每标签独立 webview、导航栏/地址栏、历史/书签（SQLite）、下载管理、页内查找、缩放、DevTools、右键菜单、快捷键；随后新增资源嗅探（webRequest 捕获媒体/图片资源）。

## 目录结构（组件化拆分）
```
src/views/browser/
├── index.vue                  # 主面板：组装 TabBar/NavBar/WebViewPane + 抽屉/右键菜单
├── api/browserApi.ts          # SQLite 数据层（历史/书签，经 new-sql 通道）
├── composables/
│   ├── useWebviewBridge.ts    # webview 实例注册表 + 导航/缩放/DevTools/查找动作（模块级单例）
│   ├── useBookmarks.ts        # 书签状态单例（星标/面板/地址栏建议共享）
│   ├── useDownloads.ts        # 下载状态单例（订阅主进程 browser-download:updated 推送）
│   └── useBrowserShortcuts.ts # 快捷键（Ctrl+T/W/L/F/D、Ctrl+Tab、Alt+←/→ 等）
└── components/
    ├── TabBar.vue             # 标签栏（favicon/loading/中键关闭/双击空白新建）
    ├── NavBar.vue             # 导航栏（后退/前进/刷新/主页 + 地址栏 + 缩放 + 主菜单）
    ├── AddressBar.vue         # 地址栏（URL/搜索智能识别、历史书签建议、安全标识、星标）
    ├── WebViewPane.vue        # 单标签容器（懒加载 webview + 加载条 + 错误页）
    ├── NewTabPage.vue        # 新标签页（搜索 + 快捷网站 + 常访问）
    ├── HistoryDrawer.vue      # 历史抽屉（按日期分组、搜索、删除、清空）
    ├── BookmarkPanel.vue      # 书签抽屉
    ├── DownloadDrawer.vue     # 下载抽屉（进度/打开/取消）
    ├── SnifferDrawer.vue      # 资源嗅探抽屉（类型筛选/下载/复制/打开）
    ├── FindInPage.vue         # 页内查找条
    └── ContextMenu.vue        # 网页右键菜单（通用浮层）
```

## 核心架构决策（勿回退）
- **每标签一个独立 webview 实例，v-show 切换**（旧版单 webview 复用导致切换标签丢登录态/滚动/表单，已废弃）
- **懒加载**：标签首次激活才挂载 webview（WebViewPane.shouldMount）
- **会话分区**：webview `partition="persist:browser"`，登录态跨会话持久
- **`:src` 只绑定挂载时的初始地址**，后续导航一律走 `loadURL`（避免 Vue 响应式更新 src 造成重复导航）
- webview 属性固定 `allowpopups` + `webpreferences="nodeIntegration=no,contextIsolation=yes"`
- `new-window` 事件 → 创建新标签；`did-fail-load` 过滤 `-3`（用户中断）后展示错误页

## 数据层
- 浏览历史 `browser_history` / 书签 `browser_bookmark`（SQLite，主键均为 `key`=url + 唯一索引，经 `new-sql:query/upsert/insert/update/delete`，建表套路同 habitApi 的幂等补列）
- 历史写入：`addHistory` 查-后-写实现 visit_count 自增；连续同地址去重在 `useWebviewBridge.recordHistory`
- 标签会话（{id,title,url}）仍存 localStorage（`browser-tabs` / `browser-active-tab-id` / `browser-default-engine`），重启恢复、懒加载

## 主进程
- `electron/main/module/browserDownload.ts`：经 `app.on('web-contents-created')` + `did-attach-webview` 对 webview session 挂钩 `will-download`；文件自动落系统「下载」文件夹（重名加 (n)）；IPC：`browser-download:list/cancel/open/show-in-folder/clear`；进度经 `browser-download:updated` 推送主窗口
- `electron/main/module/browserSniffer.ts`：资源嗅探。在 `persist:browser` 会话挂 `webRequest.onHeadersReceived`（唯一能读 content-type 的挂点），按 `details.webContentsId` ↔ 渲染端 `webview.getWebContentsId()` 关联标签。**常驻录制**（勿回退）：所有请求都做媒体检测并按 webContentsId 写环形缓冲（上限 300），`browser-sniffer:start` 返回该缓冲实现「先开网页后开嗅探」的回填；仅对嗅探中标签推送（`browser-sniffer:updated`）；类型识别 content-type 优先/扩展名兜底（m3u8/mpd 标记为流媒体）；webContents destroyed 时清缓冲防泄漏；media 请求缺 webContentsId 会打一次性诊断日志。下载动作渲染端直接 `webview.downloadURL(url)` 流入 browserDownload 管线。IPC：`browser-sniffer:start/stop/clear/export`（export 为 TXT 纯 URL 清单落「下载」文件夹）。抽屉（SnifferDrawer.vue）能力：类型+最小大小过滤（size=0 未知大小始终显示）、图片缩略图（资源 URL 直出 + loading=lazy + referrerpolicy=no-referrer 绕防盗链 + 失败回退图标）、勾选批量下载（150ms 间隔防限流、流媒体跳过）、导出 TXT、复制所选链接
- 已在 `electron/main/index.ts` 的 `createWindow` 末尾注册 `initBrowserDownload()` 与 `initBrowserSniffer()`

## 用到的 IPC 通道
- `browser-download:*`（见上）；历史/书签走 newSql 通用通道；剪贴板用 `window.ipcRenderer.clipboard`
- 外部链接复用 `open-external-url`（`autoUpdate.ts`）

## 快捷键（useBrowserShortcuts）
Ctrl+T 新建 / Ctrl+W 关闭 / Ctrl+Tab、Ctrl+Shift+Tab 循环切换 / Ctrl+1~9 定位 / Ctrl+L 或 Ctrl+K 聚焦地址栏 / Ctrl+F 查找 / Ctrl+D 收藏 / Ctrl+R、F5 刷新 / Alt+←、Alt+→ 后退前进。跨组件通信走 window CustomEvent（`browser:focus-address`、`browser:toggle-find`）。

## 特有坑 / 注意
- 渲染端不 `import electron/*`；系统能力一律 IPC
- 改主进程（browserDownload.ts / index.ts）需重启 Electron；渲染端热重载即可
- webview `webviewRef` 是 Vue ref 拿 DOM 元素，方法（canGoBack/loadURL/findInPage/setZoomLevel 等）直接调用；webview 未挂载时桥函数返回 false/空操作
- 新增图标需先在 `@lucide/vue` 验证存在并登记 `LucideIcon.vue` 的 nameMap
- 缩放：zoomLevel 步进 0.5、范围 [-3,3]，百分比 = 1.2^level × 100
