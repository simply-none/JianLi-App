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

## 性能红线（2026-09-28 修复「鼠标快速移动卡顿」）
排查结论：卡顿主因**不在渲染端**，而在本模块的后台监听 + 121MB 表上的全表扫描。

### 一、轮询必须做到「图片没变就零编码」——四层守卫，顺序不可调整
```
┌─ 1. readText() 文本未变 ────────────────────── 最便宜
├─ 2. availableFormats() 无 image/* ─────────── 便宜（纯文本剪贴板到此结束）
├─ 3. cheapImageKey() 尺寸+位图长度，不编码 ──── 便宜 ← 关键！
└─ 4. toDataURL()（PNG 编码）仅新图片才做 ────── 昂贵
```
`startClipboardMonitor` 的守卫条件 `!hasText || text === lastClipboardText` 决定了：**剪贴板里停留一张图片时 `readText()` 恒为空**，所以只要剪贴板里有图，每轮都会走进图片分支。因此**第 3 层是这个函数的全部要点**——它必须在 `toDataURL()` 之前拦掉「图片没变」的情况。

**用户可复现的判定依据**（非常有用的症状指纹）：**最近一条剪贴板记录是文本时不卡，是图片时就卡。**

#### ⚠️ 三次失败的教训，务必不要重犯
1. **把廉价比对放在昂贵操作之后**（v1）：`toDataURL()` → `imageFingerprint()` → 比对。等于每轮白编码一次再丢弃。
2. **依赖不存在的 API**（v2）：加了 `clipboard.getChangeCount()` 作序列号守卫，但 **Electron 36.9.5 的 `clipboard` 模块根本没有这个 API**：
   - `electron.d.ts` 未声明（`tsc` 报 TS2339）；
   - 直接搜 `electron.exe` 二进制，`ChangeCount` 仅以 Chromium **媒体模块指标名**出现（`WebContentsAutoScaler::...ScaleOverrideChangeCount`、`MediaRecorder.TrackTransformationChangeCount`），与剪贴板**毫无关系**。
   - 用 `(clipboard as unknown as {getChangeCount?}).getChangeCount` 取函数调用 ⇒ 每次拿到 `undefined` ⇒ **守卫恒失效但代码看起来"已优化"**，白白浪费一轮排查。
   - **验证 API 是否真实存在，要搜二进制符号/写最小复现，不能只看"代码没报错"。**
3. **`readBuffer('image/png')` 并不廉价**（v3，最隐蔽的一个）：
   - Windows 剪贴板里的图片通常以 **DIB/Bitmap** 形式存放，**并非 PNG**。当剪贴板没有原生 PNG 数据时，Electron 的 `readBuffer('image/png')` 会在内部**临时把位图编码成 PNG** 再返回 —— 等于把「省掉的编码」又加了回来，守卫形同虚设。
   - 一度以为它「读原始字节、亚毫秒级」，那是基于 Node Buffer 拷贝的**错误类比**（真正的 OLE 读取 + 可能的隐式编码远不止此）。
   - **教训：`readBuffer(mimeType)` 的代价取决于剪贴板里是否真有该 mimeType 的原生数据。对 `image/png` 而言，Windows 上大概率没有。**

#### 正确的廉价指纹（v4，现行）
`cheapImageKey()` = `readImage().getSize()` + `readImage().toBitmap().length`，即 `宽x高:位图字节数`：
- `getSize()` 只读头部尺寸元数据；
- `toBitmap()` 返回 BGRA 原始像素缓冲（无压缩、无编码，纯内存拷贝）。
- **两者都不触发 PNG 编码**，这才是真正意义上「不编码」的判断。
- 为什么不只用尺寸：同尺寸的不同截图会碰撞 → 漏记录。加上位图字节数后，碰撞概率极低（代价仅是极少见情况下漏存一条历史）。

#### 缓存失效（stale）处理约定
- 剪贴板切成纯文本（无 `image/*` 格式）时：**清空** `lastImageCheapKey` / `lastImageFingerprint`，避免「图片→文本→同一张图」来回切时误判。
- 文本分支落库成功后：同样清空两个图片缓存。
- 启动预热：库里存的是 dataURL，**无法反推原始位图**，故 `lastImageCheapKey` 留空 —— 首次轮询会多编码一次（可接受的一次性代价），之后即靠廉价指纹命中。
- `lastImageCheapKey` 只在**成功落库/记账后**才刷新，失败则下轮重试。
- `cheapKey` 为空（拿不到尺寸/异常）时，**回落到昂贵指纹兜底去重**，保证不会重复入库。

#### 另一个剪贴板轮询器（易漏）
`modules/download/downloadInterceptor.ts` 的 `startClipboardMonitor()` 也有一套 **1s 轮询**，由 `download/index.ts` 的 `initDownloader()` 启动。它只做 `readText()`（较便宜，不做图片读取），但**改剪贴板相关逻辑时别忘了它的存在**——同一进程里跑着两个 1s 剪贴板轮询。

### 二、大表必须有排序索引
`ensureClipboardIndexes` 建 `idx_clipboard_create_time(create_time DESC, id DESC)`。列表分页与启动预热都是 `ORDER BY create_time DESC, id DESC`，无索引时执行计划是 `SCAN` + `USE TEMP B-TREE FOR ORDER BY`。
- 实测（121MB / 2.6 万行）：列表 **444ms → 15ms**；启动预热 **107ms → 16ms**，约 30 倍。这解释了"一周前不卡、现在卡"——表在长，扫描线性变慢。

### 三、列表查询禁 `SELECT *`
只取 `id, text, html, image, create_time, use_count, last_used`。`rtf` / `bookmark` / `findText` 渲染端**从未读取**（`types.ts` 里只是类型占位），原来每次分页都把它们搬过 IPC 结构化克隆。

### 四、入库长度必须设上限
`MAX_TEXT_LENGTH`（512KB，超限截断而非丢弃）；`safeText.length > 8192` 时**跳过合并查找**直接新增（`text` 等值匹配无法走索引，成本线性上涨）。库里曾出现 **7.3MB 单条 text**。

**渲染端同步加固**（`utils/clipboardFormat.ts`）：`splitByKeyword` 增加了 `PREVIEW_CHAR_LIMIT`(20000) 截断 + `MAX_SEGMENTS`(300) 封顶。卡片折叠用 `max-height` + mask 裁剪，**DOM 节点仍真实存在**——7.3MB 文本 + 关键词搜索会切出上万个 `<span>` 直接卡死渲染进程。`countChars` 同样改为截断计数。

**改 `clipboard.ts` 须重启 Electron。** 另外 `newSql.ts` 的 WAL `wal_autocheckpoint` 已从 1000 页(4MB) 提到 6000 页(≈24MB)，降低大库上的 checkpoint 频次。


