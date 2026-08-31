# PDF 工具箱 (pdfTools)

## 职责
渐离App 新增的**独立 PDF 文件级操作模块**（对标 Smallpdf / Acrobat「组织页面」，但本地离线、文件不出本机）。与电子书阅读器（`ebookReader`）解耦：阅读器负责「读 PDF」，本模块负责「改 PDF」。一期提供：合并 / 拆分 / 组织页面(重排·删除·旋转·提取) / 导出图片。

## 关键文件
- 入口视图：`src/views/pdfTools/index.vue`（卡片仪表盘 + 工具切换）
- 子工具组件（原子化）：
  - 一期：`MergeTool.vue` / `SplitTool.vue` / `OrganizeTool.vue` / `ExportImagesTool.vue`
  - 二期：`InsertTool.vue` / `ReplaceTool.vue` / `DuplicateTool.vue` / `CropTool.vue` / `DecorateTool.vue` / `WatermarkTool.vue` / `CoverTool.vue` / `ResizeTool.vue` / `DetectBlankTool.vue` / `FlattenTool.vue`
  - 三期：`CompressTool.vue` / `RedactTool.vue` / `SecurityTool.vue` / `PageLabelsTool.vue` / `AttachTool.vue` / `CompareTool.vue`
- 复用原子组件（新增）：`PdfSourcePicker.vue`（单 PDF 源选择）
- 通用原子组件：`components/PdfToolCard.vue`（卡片） / `FileDropZone.vue`（选择/拖入文件） / `ThumbnailGrid.vue`（缩略图网格，IntersectionObserver 懒渲染） / `PdfResultBar.vue`（结果反馈）
- 渲染端 API：`api/pdfApi.ts`（封装 `window.ipcRenderer.pdf.*`）
- 缩略图/栅格化：`composables/usePdfjs.ts`（复用电子书阅读器 worker + polyfill）
- store：`store/usePdfTools.ts`
- 类型：`types.ts`
- 主进程：`electron/main/module/pdf.ts`（`initPdf()` 注册 `pdf:*` IPC）；preload `ipcRenderer.pdf.*` 桥接

## 路由 / 入口
- `RouteNames.PDF_TOOLS` → `/pdfTools`
- 侧边栏 `src/layout/index.vue` 的「效率工具」分组加入 `'pdfTools'`；`src/utils/index.ts` 的 `iconMap` 加 `pdfTools: 'FileBox'`
- 可见开关：`src/views/routeSetting/index.vue` 自动从 `layoutRouters` 生成（无需额外改动）

## 用到的 IPC 通道（preload `pdf.*`）
- `pdf:pick-files` → 多文件选择，返回 `{ files: string[] }`
- `pdf:pick-dir` → 选择目录，返回 `{ dir }`
- `pdf:pick-save(defaultName)` → 保存对话框，返回 `{ filePath }`
- `pdf:merge({ files, outputPath })` → 顺序合并，返回 `{ outputPath, pages }`
- `pdf:organize({ file, outputPath, pageMap:[{index,rotation}] })` → 按最终页序重排/删除/旋转/提取，返回 `{ outputPath, pages }`
- `pdf:split({ file, outputDir, baseName, mode })` → 按 range/everyN/oddEven 拆分，返回 `{ files: string[] }`
- `pdf:write-files({ dir, files:[{name,base64}] })` → 批量写文件（导出图片用）
- 二期：`pdf:insert({file,outputPath,insertFile,atIndex,insertIndices?})` / `pdf:replace({file,outputPath,replaceFile,targetStart,replaceIndices?})` / `pdf:duplicate({file,outputPath,indices})` / `pdf:crop({file,outputPath,margins})` / `pdf:decorate({file,outputPath,opts})` / `pdf:watermark({file,outputPath,opts})` / `pdf:add-cover({file,outputPath,opts})` / `pdf:resize({file,outputPath,size})` / `pdf:flatten({file,outputPath})`
- 三期：`pdf:compress({file,outputPath})` / `pdf:redact({file,outputPath,opts})` / `pdf:encrypt()`(规划中·诚实提示) / `pdf:decrypt()`(规划中·诚实提示) / `pdf:page-labels({file,outputPath,labels})`(走底层 /Labels 数字树) / `pdf:attach({file,outputPath,data,fileName,mime?})`(pdf-lib attach 嵌入附件)
- 渲染端空格检测复用 `composables/usePdfjs.ts#findBlankPages`（pdf.js 栅格化 + 非白像素占比判定），清理走 `pdf:organize` 删除对应页。

## 库与架构
- **pdf-lib**：主进程二进制操作（合并/拆分/组织），不渲染。
- **pdf.js**：渲染端缩略图与图片栅格化；worker 经 `GlobalWorkerOptions.workerPort` 注入，复用 `src/views/ebookReader/workers/pdfWorker.ts`（内含 polyfill）。
- 文件字节读取复用 `ebook:read-file-bytes`（主进程读盘），渲染端 `atob` → `Uint8Array` → `getDocument`。

## 红线 / 注意
- 渲染端**禁 `import electron/*`**；所有磁盘/二进制走 `pdf:*` IPC；改主进程 `pdf.ts` **须重启 Electron**。
- **安全默认**：所有写操作「另存为」新文件（`pdf:pick-save` 指定路径），绝不直接覆盖原文件。
- 主题用自定义 token（`--bg-card`/`--text-*`/`--color-*`），禁硬编码、禁 `--el-*`（见 `references/theme.md`）。
- 组件原子化、单文件职责单一、带注释（见 `AGENTS.md`）。

## 二期 / 三期（已实现）
- 二期（页面修饰处理）：插入页面 / 替换页面 / 复制页面 / 裁剪白边 / 页码·页眉·页脚 / 文字水印 / 添加封面 / 统一尺寸缩放 / 空白页检测（栅格化识别+一键清理）/ 展平标注。
- 三期（文档级）：压缩减体（best-effort 对象流）/ 密文遮盖（整页或矩形永久涂黑）/ 加密·解密（**规划中**，依赖 qpdf 外部引擎，UI 诚实提示）/ 页面标签（pdf-lib 1.17 无 setPageLabels，走底层 /Labels 数字树手写）/ 嵌入附件（pdf-lib attach）/ 双栏对比（pdf.js 渲染并排）。
- 诚实边界：`pdf:encrypt`/`pdf:decrypt` 因缺 qpdf 引擎，后端直接返回提示、前端 `SecurityTool` 灰显并透传，不伪造能力。
