# 电子书阅读器 (ebookReader)

## 职责
EPUB / TXT / PDF 三格式阅读：进度保存、书架、分类、笔记与划线、书签、背景图，支持按内容哈希（sha256）跨路径复用标注/书签/进度。预览见 `components/` 与 `composables/` 按格式拆分（epub / txt / pdf）。

## 关键文件
- 主页面：`src/views/ebookReader/index.vue` + `components/EpubReader.vue` 等 + `composables/`（`useEpubRender`/`useTxtRender`/`usePdfRender`/`useEpubHighlight`/`useTxtHighlight`/`usePdfHighlight`/`useEpubBookmarks`/`usePdfBookmarks`/`useBookshelf`/`useEpubSearch`）+ `workers/pdfWorker.ts` + `types.ts`
- **TTS 朗读（EPUB / TXT）**：调度层 `composables/useBookTts.ts`（模块级单例，状态机 idle/playing/paused）+ 句子切分 `composables/ttsSentences.ts` + 格式适配器 `composables/useEpubTts.ts` / `composables/useTxtTts.ts` + 浮动播放条 `components/TtsPlayBar.vue`；朗读引擎复用 `src/utils/tts` 的 `TTSManager`（5 provider 自动回退，仅 `WebTTSProvider` 接 `onboundary` 逐字回调）。
- 关联主进程：`electron/main/module/ebook.ts`（`initEbook` 建 7 张表），preload 暴露 `ipcRenderer.ebook.*` 全量
- store：`src/store/useEbookReader.ts`
- 数据库：复用主库 `db.sqlite`，表 `ebook_progress`/`ebook_bookshelf`/`ebook_annotation`/`ebook_bookmark`/`ebook_category`/`ebook_book_category`/`ebook_bg_image`

## 路由
- `RouteNames.EBOOK_READER` → `/ebookReader`
- 无小窗（`windowSections` 无 ebook 条目）

## 用到的 IPC 通道（preload `ebook.*`）
- 读取：`ebook:read-txt`（chardet+iconv-lite 编码检测）、`ebook:read-file-bytes` / `ebook:get-file-size` / `ebook:read-file-range`（PDF 区间加载）、`ebook:compute-file-hash`
- 进度：`ebook:get-progress` / `ebook:save-progress`
- 书架：`ebook:get-bookshelf` / `add-to-bookshelf` / `remove-from-bookshelf` / `clear-bookshelf` / `scan-folder`
- 分类：`ebook:get-categories` / `add-category` / `update-category` / `delete-category` / `get-book-categories` / `set-book-categories`
- 标注：`ebook:get-annotations` / `add-annotation` / `update-annotation` / `remove-annotation` / `remove-annotations` / `get-annotation-counts`
- 书签：`ebook:get-bookmarks` / `add-bookmark` / `remove-bookmark`
- 其它：`ebook:save-book-meta` / `add-bg-image` / `get-bg-images` / `delete-bg-image` / `export-annotations`
- **传书（2026-09-10 新增，不经 preload 封装，渲染端直连 `window.ipcRenderer.handlePromise`）**：`ebook:transfer-scan` / `ebook:transfer-list` / `ebook:transfer-download` / `ebook:transfer-upload`（主进程 `electron/main/module/ebookTransfer.ts` 注册，见下方「一键传书」）

## 复用 / 集成点
- 主进程 `ebook.ts` 数据访问**合规**走 `newSql.ts` 的 `query/upsert/update/del` + `ensureTableExists` 自动补列；无命令面板 REGISTRY、无小窗四件套。

## 特有坑 / 注意
- **epubjs 强制样式**：分页布局下 epubjs 对 iframe `body` 写死 `margin:0 !important`（`useEpubRender.ts:585`）。页边距只能用**视口容器 padding** 实现；给 body 加 margin 会破坏分页宽度计算、末栏被裁切。字号/字体经 `themes.override` 注入。
- **pdf.js v6 worker**：必须经 `workers/pdfWorker.ts` 用 `GlobalWorkerOptions.workerPort` 注入 `pdf.worker.min.mjs`（异步加载）。PDF 用**区间加载**（`ebook:read-file-range` + `PDFDataRangeTransport`），按字节按需拉取，切勿整文件读入内存，否则大文件初始化极慢。
- **content_hash 身份**：换路径重新导入按 `sha256` 复用同内容的标注/书签/进度（多副本共享）；但书架行各路径独立，删除某副本只删其书架引用、不删共享数据。书架徽标计数依赖 `get-annotation-counts` 传 `contentHashes`。
- TXT 编码自动检测（GB2312/GBK→GB18030），并去除首部 BOM。
- **附件抽屉（PDF 专用）**：`components/AttachmentsDrawer.vue` + 工具栏「附件」按钮（`v-if="currentFile.format === 'pdf'"`）。读取/另存复用 PDF 工具箱已封装的 `pdfApi.getAttachments / extractAttachment`（即 `pdf:get-attachments` / `pdf:extract-attachment`，主进程 `pdf.ts#readEmbeddedFiles` 解析 `/Names /EmbeddedFiles` 名称树）。**列表只回元信息（name/mime/size），附件字节由主进程直接写盘、不经过渲染端 IPC**，避免大附件卡顿。切换文件时在 `watch(currentFile.path)` 里重置附件状态。踩坑细节见 `modules/pdf-tools.md`。

## 一键传书（PC ↔ 手机，2026-09-10 新增，与移动端书架「传书」对齐）
- **入口**：工具栏「打开文件」右侧的「传书」按钮（LucideIcon `ArrowLeftRight`）→ 弹窗 `components/BookTransferDialog.vue`（`v-model="bookTransferVisible"`，`:books="ebookStore.bookshelf"`，`@done="loadBookshelf"` 刷新书架）。
- **能力**：扫描设备 → 选方向（`从这台导入` 拉 / `传到这台` 推）→ 表格**多选**（`el-table` `type="selection"`，表头即全选）→ 底部「传输选中（N）」一键批量传输。
- **文件**：主进程 `electron/main/module/ebookTransfer.ts`；渲染端 `api/ebookTransferApi.ts`（`ebookTransferApi.scan/listRemote/download/upload`）+ `components/BookTransferDialog.vue`。
- **协议**：与移动端 `lib/features/ebook/services/ebook_transfer.dart` 对称，复用同步数据面 **47124** 的 `/ebook/list`、`/ebook/download?path=`、`/ebook/upload?name=&format=` 三端点；设备发现复用 `syncModule.scanPeers()`（UDP 广播 47123）。**PC 端同时是接收端（三条路由）与客户端（拉/推）**，角色比移动端多一层。
- **去重**：拉/推两侧统一走 `saveBookBytes()`（内容 sha256 → `content_hash` 去重 → 落盘 `userData/jianli-books` → `INSERT OR REPLACE` 入库），与移动端 `importBookBytes` 同身份键。
- ⚠️ **超时差异化**：书目列表 8s，单本下载/上传 **120s**（书籍可达数十 MB，不能沿用 sync 的 5s `AbortSignal.timeout`）。
- ⚠️ **只对 epub/txt 生效**：PDF 走的是 `ebook:read-file-range` 区间加载体系，未纳入传书；列表两侧都按 `format === 'epub' || 'txt'` 过滤。
- ⚠️ **切换方向/设备要清空勾选**（防跨端混选），传输后 `clearSelection()` 并 `emit('done')` 让父组件 `loadBookshelf()`。
- ⚠️ **批量是主进程串行循环**：一次 IPC 传完所有书再统一返回，故 UI 只显示「传输中…」，不逐本刷新进度（与移动端在 UI 层循环、能显示 i/total 不同）。

## 右键外部文件入口（用渐离阅读）
- 资源管理器右键 epub / pdf / txt 的「用渐离阅读」（`--open-reader`）经统一 shellMenu 管线送到 `App.vue` → `useEbookReader().requestOpenExternal(files)` + 跳 `EBOOK_READER`。
- `requestOpenExternal` 把文件写入 `pendingOpenBooks`，`ebookReader/index.vue` 挂载时消费：循环 `loadFile(path, name, format)`（按扩展名判 format）写书架并切阅读视图，默认打开首个；并 `watch(pendingOpenBooks)` 保后续到达。
- 该动作同时注册 ProgID `JianliApp.<ext>` 进「打开方式」列表；用户在设置页「设为默认打开」后双击文件即进本 App（可撤销）。详见 `modules/file-vault.md`「资源管理器右键菜单（统一）」。

## TTS 朗读（EPUB / TXT，2026-09-25 新增）
- **入口**：阅读视图顶部工具栏「朗读」按钮（仅 `format === 'epub' || 'txt'`，点击 toggle 开始/暂停）+ 底部浮动播放条 `TtsPlayBar.vue`（上一句/暂停/停止/下一句/语速循环档位 + 本章进度 + 当前句片段；全屏模式浮动控制条也有同样的「朗读」圆形按钮）。播放条仅在已注册适配器（EPUB/TXT 阅读器挂载）且 `view === 'reader'` 时显示；PDF 无适配器故不出现。
- **调度层 `useBookTts`（模块级单例）**：统一驱动朗读循环，与具体格式解耦。状态机 `idle/playing/paused`；对外动作 `play/pause/resume/stop/toggle/next/prev/setRate/registerAdapter/unregisterAdapter`；响应式状态 `status/rate/sectionProgress/globalIndex/currentSentenceText/error/supportsBoundary/providerType/isLoading` + 计算 `isPlaying/isPaused/isIdle/hasAdapter`。逐句循环：确保可见 → `onSentenceStart`（句级高亮）→ `TTSManager.speak(text, opts, handlers)` → 落库断点 → 下一句；EPUB 当前队列耗尽自动 `hasNextQueue/nextQueue` 续到下一章。
- **句子切分 `ttsSentences.ts`**：`splitSentences(text)` 按 `。！？!?；;…\n` 切句并保留标点，超 200 字硬切，供两适配器复用。⚠️ **硬切分支的偏移陷阱**：`windowText = text.slice(start,end)` 是子串，`lastIndexOf` 返回的是「相对窗口起点」偏移，换算 `cut` 必须写成 `start + 逗号相对索引 + 1`，否则 `cut` 回退 → 死循环 → `Invalid array length`。
- **EPUB 适配器 `useEpubTts`**：`useEpubRender` 之后调用 `useEpubTts(ctx)` 注册。从当前章节 `Contents` 用 TreeWalker 抽正文文本节点（跳过 script/style/nav/header/footer），逐句算 EpubCFI range（`contents.cfiFromRange`）。**句级/逐词高亮复用「手动划线」同一条渲染通道**：直接调 `rendition.annotations.highlight(cfiRange, data, cb, 'epub-highlight', SENTENCE_STYLE)`（紫底 `fill:'#6C5CE7' fill-opacity:0.26），逐词在句子 Range 内算 sub-range 反算 CFI 后叠加琥珀橙 `WORD_STYLE`（`fill:'#F59E0B' fill-opacity:0.58`，仅 Web 的 `onBoundary(name==='word')` 触发）。**刻意复用 epub.js 自带标注通道**而非父层 div 覆盖层——因为父层覆盖层跨 iframe 合成层级 / 坐标换算在部分环境下根本不显示（这是前几版 TTS 高亮失效的真因；手动划线能显示即证明该通道可用）。`annotations` 自带 `inject` 渲染钩子，翻页/换主题重排后自动把暂存高亮重挂到新视图，无需手动 `rendition.on('rendered')` 安全网。翻页跟随 `ensureVisible` 用 CFI 比较当前 `currentLocation()`，不在页内则 `displayAndWait(cfi)`。章节续接 `spine.spineItems` 找下一 `href`。断点串 = 句子起始 CFI（point CFI），`restoreFromBreakpoint` 先 `displayAndWait` 定位再切片队列。**⚠️ 必须从「当前视图」开始读**：`buildQueue` 用 `currentLocation().start.cfi`（可见页顶部）配合 `findStartIndexByCfi` 二分切片，绝不可从整章 DOM 顶部（章节/首页开头）开始；`getContents()` 多视图时按 `sectionIndex === currentLocation().start.index` 选当前 section，避免分页预载相邻章取错。`cfiCompare` 已用于 `ensureVisible`，复用可靠。TXT 适配器因走 `render.currentStartOffset()` 天然从当前视图读，无需同样处理。
- **TXT 适配器 `useTxtTts`**：`useTxtTts(ctx, render)` 注册，复用 `render` 的 `jumpToOffset/scrollToOffset/currentStartOffset`。从当前阅读位置到文末按全局字符偏移切句（`globalStart/globalEnd/bp`），高亮走**覆盖层** `TxtOverlay`（在 `.txt-flow` 内挂 `div.tts-overlay-layer`，按 `Range.getClientRects()` 相对 `flowRect` 画色块，随翻页 transform/滚动自动跟随且不改正文 DOM）。翻页跟随 `scrollMode ? scrollToOffset : jumpToOffset`。断点串 = 起始全局偏移。
- **边界回调 / 逐字高亮**：依赖 `src/utils/tts/types.ts` 的 `TTSHandlers`（`onStart/onBoundary/onEnd`）与 `WebTTSProvider` 的 `SpeechSynthesisUtterance.onboundary`；非 Web 引擎（system/kokoro/piper/vits）仅句级高亮。`useBookTts.makeHandlers` 把 `charIndex` 加上句内切片偏移后透传给适配器。**⚠️ 逐词高亮是 Web-only 精确增强**：Chrome 对中文 `speechSynthesis` 的 `onboundary` 经常不触发，故中文/非 Web 下只有句级高亮（即「朗读位置锚点」），这是引擎限制不是 bug。**句级高亮对所有引擎生效**，是始终可见的朗读位置指示器（EPUB 走 `rendition.annotations.highlight` + `SENTENCE_STYLE={fill:'#6C5CE7','fill-opacity':'0.26'}` 紫底 / `WORD_STYLE={fill:'#F59E0B','fill-opacity':'0.58'}` 琥珀橙逐词，复用 `useEpubHighlight` 的标注渲染通道，画在 iframe 内 SVG 上；语音边界与色块都来自同一份 Range，天然同定位块）。`ensureVisible` 用 CFI 区间比较判定可见性，不在当前页/视口才翻页或滚动跟随；`currentLocation()` 取不到时直接 `displayAndWait` 定位（不盲目每句 display 抖动）。
- **复用 TTS 设置**：不另设电子书配置，直接读 `basic_info` 的 `tts_provider/tts_voice/tts_rate`（`getStoreAsync/setStoreAsync`），`setRate` 同步写回 `tts_rate`。默认 provider `web`、开启自动回退。
- **断点续读**：每句落 `localStorage['tts-bp']`（`bookKey/format/bp/index`），下次同书 `play()` 据断点恢复（EPUB 定位切片 / TXT 偏移切片），开始播放后清除旧断点避免二次误用。
- ⚠️ **范围**：首版仅 EPUB + TXT；PDF 未接入适配器（阅读器不调 `useXxxTts`，播放条对其不显示）。不触碰主进程、不新增依赖。
- ⚠️ **注册/卸载**：适配器在 `EpubReader.vue`/`TxtReader.vue` 的 `<script setup>` 内调用对应 `useXxxTts`，并 `onUnmounted` 反注册；切书时 `registerAdapter` 会先 `stop()` 旧朗读并清高亮。
- 类型校验：`vue-tsc --noEmit` 留给本地跑（>30s 阈值则交用户），改完需过一遍。
- ⚠️ **EPUB 适配器性能红线（2026-09-25 修过 OOM）**：`extractQueueFromContents` **绝不可**对每个文本节点调 `contents.cfiFromNode`（生成数万条长 CFI 串会爆堆），也**绝不可**在 `makeCfiRange` 里逐句线性扫描全部节点（O(节点×句) 会卡死+ OOM）。正确做法：nodes 只存 `{node,start,end}` 引用，用 `nodeForOffset` 二分查找定位偏移（O(log n)），`cfiFromRange` 仅每句调一次。逐字高亮复用 `currentSentenceRange` 缓存，不要每词重解析句子 CFI。高亮移除键可靠（`encodeURI(cfi+type)`），同一时刻仅 1 句+1 词高亮，无需担心泄漏。
- ⚠️ **EPUB 高亮样式红线（2026-09-25 修过「高亮不显示」）**：任何传给 `rendition.annotations.highlight/underline(cfiRange, data, cb, className, styles)` 的 `styles` **必须**是 **hex `fill` + `fill-opacity`**（如 `{ fill:'#6C5CE7', 'fill-opacity':'0.26' }`）。**绝不可直接传 `rgba()` 作 `fill` 属性**——epub.js 把 styles 经 `Object.assign` 后由 `marks-pane` 的 `Highlight.bind` 写成 SVG 属性（`el.setAttribute`），而 SVG 1.1 presentation attribute 不认 `rgba()`，被拒的 `fill` 回退成初始值 **black** 且没 `fill-opacity` → 纯黑块盖字，表现为「看不到高亮」。同时 epub.js 默认 `attributes` 带 `"mix-blend-mode":"multiply"`（iframe.js:554），深色主题下把色块压成暗块也看不见，故 **务必显式加 `'mix-blend-mode':'normal'`** 覆盖默认 multiply。正确写法与已正常工作的 `useEpubHighlight.ts:getTypeStyles`（它用 `parseColor` 把任意 CSS 色转 hex+fill-opacity、且高亮类型不开 multiply）保持一致即可。（注：EPUB 朗读 TTS 高亮**刻意复用** `rendition.annotations.highlight` 走同一标注通道——手动划线能正常显示即证明该通道可用；前几版 TTS 改用父层 div 覆盖层反而因跨 iframe 合成层级 / 坐标换算在部分环境下整条不显示，故回退到标注通道。`annotations` 自带 `inject` 渲染钩子，翻页/换主题重排后自动把暂存高亮重挂到新视图，比手动 `getRange`+父层画更稳。该红线对 `useEpubHighlight` 与 `useEpubTts` 同样生效。）
- ⚠️ **EPUB 朗读 CFI→Range 解析红线（2026-09-25，「高亮完全不显示」真因）**：TTS 句级/逐字高亮要从 CFI 还原出 DOM `Range` 时，**只能用 `rendition.getRange(cfiRange)`**，绝不能用自建的 `getContents().range(cfi)`。根因：epub.js 的 `rendition.getRange` 按 CFI 里编码的 **`spinePos`**（`_cfi.spinePos === view.index`）跨「当前可见视图」安全筛选并 `contents.range()`；而本项目 `getContents()` 按 **`sectionIndex === currentLocation().start.index`** 选单个视图再 `contents.range()`。分页模式下会预载相邻章，`sectionIndex` 与 `spinePos` 并不总是一致 → 取到错误视图的 document → `new EpubCFI(cfi).toRange(错误document)` 解析失败/抛错 → 拿不到 Range → 覆盖层无数据可画 → **高亮整条不显示**（这也是为什么最初 SVG 版与后来的 overlay 版都失效，但手动标注却正常——手动标注走 epub.js 自带 `getRange`）。三处都受影响：`addSentenceHighlight` / `addWordHighlight`(else 兜底) / `onRenderedRepaint`。`extractQueueFromContents`/`makeCfiRange` 用 `cfiFromRange` 在同视图 document 上「正向」生成 CFI（不受此限，保留 `getContents()`），但反向解析必须统一走 `rendition.getRange`。
