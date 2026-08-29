# 系统级下载器 (downloader)

## 职责
系统级多线程下载器（类 IDM）：HTTP Range 多连接分段下载、断点续传、任务队列调度、全局限速、接管内置浏览器下载、剪贴板监视。与 `browserDownload.ts`（浏览器原生单线程下载抽屉）并存，通过「接管开关」切换下载走向。

## 目录结构
```
electron/main/module/download/        # 主进程引擎
├── index.ts               # initDownloader()：引擎初始化 + IPC 注册 + 剪贴板监视
├── types.ts               # 类型 / 配置默认值 / 分类扩展名表 / 文件名清洗
├── downloadEngine.ts      # 调度中枢（单例 downloadEngine）：队列、限速、速度统计、推送、启动恢复
├── downloadTask.ts        # 任务状态机：探测(probe)、预分配、分段切分、暂停/恢复、完成重命名
├── segmentDownloader.ts   # 单分段下载：Range 请求 + 分段内重试续传 + 令牌桶限速
├── speedLimiter.ts        # 全局限速器（令牌桶，getter 动态读 maxSpeed）
├── downloadDb.ts          # download_task 表持久化（直接用 newSql 模块，显式建表）
├── downloadIpc.ts         # IPC 通道注册
└── downloadInterceptor.ts # 浏览器下载接管 + 剪贴板监视（1s 轮询）

src/views/downloader/                  # 渲染端
├── index.vue              # 主页面：工具栏 + 分类侧栏 + 任务列表
├── api/downloaderApi.ts   # download:* IPC 封装
├── composables/useDownloader.ts  # 模块级单例：订阅 download:updated 推送 + 剪贴板回调
├── utils/format.ts        # 大小/速度/ETA 格式化 + 分类/状态元信息
└── components/            # TaskItem / CategorySide / NewTaskDialog / DownloaderSettings
```

## 核心机制（勿回退）
- **分段下载**：`probe` 用 GET Range 0-0 探测（206 → acceptRanges + Content-Range 总大小）；支持 Range 且 >1MB 按 `connectionsPerTask` 切连续分段并发下载；不支持则单线程追加。
- **分片文件**：下载到 `<最终路径>.jldl`（fs 预分配 truncate），完成后重命名为最终名（重名加 (n)）。Range 模式多分段各持独立句柄 `'r+'` 定位写。
- **断点续传**：分段进度 `{start,end,downloaded}` 每 3s 落库（segments JSON）；重启时 downloading/waiting 任务统一置 paused；续传时校验 .jldl 文件大小 === totalSize，不符则重置分段。
- **限速**：令牌桶全局共享，`maxSpeed=0` 不限；改配置即时生效（getter 读取）。
- **推送**：`download:updated` 800ms 节流全量列表推主窗口；渲染端 useDownloader 模块级订阅（页面关闭不影响后台下载）。

## IPC 通道
`download:create / list / pause / resume / remove / open / show-in-folder / get-config / set-config`；推送 `download:updated`、`download:clipboard-detected`。`create` 支持 `{url, saveDir?, connections?}`（connections=0 跟随设置，1-64 覆盖单任务线程数）。目录选择复用既有 `get-file-list`（sendSync，'select-dir'），未新增通道。

## 错误提示
HTTP 状态码统一经 `httpErrors.ts` 的 `httpErrorMessage()` 翻译为中文（401/403/404/416/429/5xx 等），probe 与分段下载共用；错误文案展示在任务卡片的 meta 区。

## 数据层
表 `download_task`（id TEXT PRIMARY KEY，显式 CREATE 幂等）：url/filename/save_path/save_dir/status/total_size/received_size/category/accept_ranges/connections/segments(JSON)/headers(JSON)/error_msg/created_at/completed_at。主进程直接 import newSql 的 insert/update/query/del，**不走 IPC**。

## 集成点
- 浏览器接管：`browserDownload.ts` 的 will-download 里先判断 `shouldTakeOverDownload()`（electron-store `downloader:config.takeOverBrowser`），为真则 `preventDefault + item.cancel` 后交 `takeOverBrowserDownload`（收集会话 Cookie/UA 再 createTask，支持登录后下载）。**接管钩子只在 browserDownload 一处，勿在 interceptor 重复挂 will-download**。
- 剪贴板监视：主进程 1s 轮询 `clipboard.readText()`，http 直链 + 扩展名命中分类表才发事件；页面通过 `onClipboardDetected` 弹新建窗。
- 菜单：侧边栏/routeSetting 已加 `downloader`（效率工具组，icon `Download`）；路由 `/downloader`。

## 特有坑 / 注意
- 主进程改动（download/ 与 browserDownload.ts）需重启 Electron；渲染端热重载。
- DownloadItem 的 `getSession()` 运行时存在但类型声明缺失，用 `(item as any).getSession?.()` 兜底 `session.defaultSession`。
- 未知大小（无 Content-Length）任务无法跨重启续传（文件缺失即重下）；同会话内暂停恢复用追加模式。
- 速度展示依赖主进程节流推送，渲染端不要自行再算速度。
- 任务完成重命名失败（文件被占用）时保留 .jldl 并仍标记完成，需手动处理。
