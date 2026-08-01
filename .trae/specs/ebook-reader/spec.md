# 电子书阅读器 Spec

## Why
当前应用是一个工作/健康类桌面工具（electron + vue3），用户希望在工作之余或休息时能够阅读电子书。目前项目缺少电子书加载与阅读能力，无法直接打开 txt、epub 等常见电子书格式。增加一个统一的电子书阅读器，可以让用户在同一个应用内打开并阅读多种格式的电子书，提升产品体验。

> 说明：mobi 格式由于纯 JS 生态无成熟解析器，且依赖 calibre 外部工具体积过大，本期暂不实现，仅支持 txt 与 epub。

## 技术方案调研

### 1. TXT 格式
- **特性**：纯文本，无目录、无元数据，需要处理编码（GBK/UTF-8/UTF-16 等）
- **推荐方案**：在主进程用 `fs` 读取，使用 `iconv-lite` + `chardet` 检测并转换编码后返回字符串，渲染进程分页展示
- **优点**：实现简单、性能好
- **缺点**：无章节结构，需自行分页/分段

### 2. EPUB 格式
- **特性**：本质是 ZIP 压缩包，内含 XHTML + OPF 元数据 + NCX 目录，是电子书事实标准
- **方案 A（推荐）**：使用 `epubjs`（epub.js）
  - 完整功能：自动分页、目录导航、主题、字体调整、搜索、书签
  - 工作流：`ePub(url/ArrayBuffer)` → `book.renderTo(el)` → `rendition.display()`
  - 成熟稳定，社区活跃
- **方案 B**：基于项目已有的 `jszip` 自行解析 OPF/NCX
  - 优点：无新依赖
  - 缺点：需自行实现分页、目录、样式，工作量大
- **决策**：采用方案 A（epubjs），降低实现成本

### 3. MOBI 格式（本期不实现）
- **特性**：Amazon Kindle 早期格式，结构复杂
- **现状**：纯 JS 生态无成熟解析器；依赖 calibre 的 `ebook-convert` 转换虽可靠，但 calibre 体积过大（约 300MB），对轻量桌面工具不合适
- **决策**：本期暂不实现 mobi，后续若有需要再评估 calibre 转换方案

### 4. PDF 格式（可选扩展，不在本期范围）
- 推荐使用 `pdfjs-dist`，未来可扩展

### 通用架构决策
- **文件加载**：复用项目已有的 `jlocal://` 协议加载本地资源；EPUB 直接传 ArrayBuffer 给 epubjs
- **文件选择**：复用 `electron/main/module/dialog.ts` 的 `getFilePath`
- **进度存储**：使用项目已有的 `sqlite3`，新建 `ebook_progress` 表存储阅读进度
- **状态管理**：使用 Pinia（项目已用）新建 `src/store/useEbookReader.ts`

## What Changes
- **新增依赖**：`epubjs`（EPUB 渲染）、`iconv-lite` + `chardet`（TXT 编码检测与转换）
- **新增 main 模块**：`electron/main/module/ebook.ts`
  - IPC：读取 txt 文件（自动检测编码）
  - IPC：读写阅读进度到 sqlite
- **修改 preload**：`electron/preload/index.ts` 暴露 `ebook` 相关 API
- **新增视图**：`src/views/ebookReader/`
  - `index.vue` 主入口（文件选择、格式路由、全局工具栏）
  - `components/TxtReader.vue` TXT 阅读组件
  - `components/EpubReader.vue` EPUB 阅读组件（基于 epubjs）
  - `components/Toolbar.vue` 工具栏（字体、主题、目录、进度）
- **新增 store**：`src/store/useEbookReader.ts`（当前文件、阅读进度、设置）
- **新增路由**：`/ebookReader`，并在 `RouteNames` 增加 `EBOOK_READER`
- **进度持久化**：新建 sqlite 表 `ebook_progress`（字段：file_path、format、cfi/position、percent、updated_at）

## Impact
- **Affected specs**: 无（首次新增）
- **Affected code**:
  - `electron/main/module/ebook.ts`（新增）
  - `electron/main/index.ts`（注册 ebook 模块的 initFile）
  - `electron/preload/index.ts`（暴露 ebook API）
  - `src/router/index.ts`（新增路由）
  - `src/views/ebookReader/`（新增目录与组件）
  - `src/store/useEbookReader.ts`（新增）
  - `package.json`（新增 epubjs、iconv-lite、chardet 依赖）

## ADDED Requirements

### Requirement: 打开电子书文件
系统 SHALL 支持用户通过文件选择对话框打开 txt、epub 格式的电子书文件，并根据文件后缀自动选择对应的阅读组件。

#### Scenario: 打开 TXT 文件
- **WHEN** 用户选择一个 .txt 文件
- **THEN** 系统读取文件内容，自动检测编码（GBK/UTF-8/UTF-16），并以分页文本形式展示
- **AND** 顶部工具栏显示文件名与「上一页/下一页」控件

#### Scenario: 打开 EPUB 文件
- **WHEN** 用户选择一个 .epub 文件
- **THEN** 系统使用 epubjs 渲染，展示封面/正文，支持左右翻页
- **AND** 工具栏提供目录（TOC）、字体大小、主题切换入口

#### Scenario: 不支持的格式
- **WHEN** 用户选择非 txt/epub 的文件（包括 mobi 等暂不支持的格式）
- **THEN** 系统提示「暂不支持该格式（当前支持 txt、epub）」并放弃打开

### Requirement: 阅读进度持久化
系统 SHALL 在用户翻页或关闭阅读器时，将当前阅读位置（EPUB 的 cfi、TXT 的字符位置）持久化到 sqlite，并在下次打开同一文件时恢复到上次位置。

#### Scenario: 保存进度
- **WHEN** 用户翻页或关闭阅读器
- **THEN** 系统将 {file_path, format, cfi/position, percent, updated_at} 写入 `ebook_progress` 表
- **AND** 同一 file_path 仅保留一条最新记录（upsert）

#### Scenario: 恢复进度
- **WHEN** 用户再次打开之前阅读过的文件
- **THEN** 系统查询 `ebook_progress` 表
- **AND** 若存在记录，自动跳转到上次的 cfi/position

### Requirement: 阅读设置
系统 SHALL 提供字体大小、主题（日间/夜间/护眼）的切换，并将设置持久化到 store，下次打开时生效。

#### Scenario: 切换主题
- **WHEN** 用户点击工具栏的主题切换按钮
- **THEN** 阅读区域立即应用新主题（背景色、文字颜色）
- **AND** 设置持久化，重启后保持

## MODIFIED Requirements

### Requirement: 主进程模块注册
主进程 `electron/main/index.ts` SHALL 在初始化时调用 `ebook.ts` 导出的初始化函数，注册所有 ebook 相关的 IPC 监听。
