# 电子书书架列表 Spec

## Why
电子书阅读器目前每次打开文件都需手动通过文件对话框选择，无法快速回溯之前阅读过的书籍。新增「书架」功能，将每次打开过的电子书路径与元信息持久化到数据库，并在阅读器内以列表/卡片形式展示，用户点击即可快速打开继续阅读，提升阅读体验。

## What Changes
- **新增数据库表** `ebook_bookshelf`：存储书架元信息（file_path 主键、name、format、percent、last_read_at、added_at），复用主数据库 db.sqlite
- **新增主进程 IPC**（`electron/main/module/ebook.ts`）：
  - `ebook:get-bookshelf`：获取书架列表（按 last_read_at 降序）
  - `ebook:add-to-bookshelf`：添加/更新书架记录（upsert，打开文件时调用）
  - `ebook:remove-from-bookshelf`：按 file_path 删除单条记录
- **修改 preload**：`electron/preload/index.ts` 在 `ebook` 命名空间暴露 `getBookshelf` / `addToBookshelf` / `removeFromBookshelf` 方法及类型
- **修改 store**：`src/store/useEbookReader.ts` 新增 `bookshelf` 状态与 `loadBookshelf` / `addToBookshelf` / `removeFromBookshelf` actions
- **修改主入口视图**：`src/views/ebookReader/index.vue`
  - 新增 `view` 视图状态（`'bookshelf'` / `'reader'`）
  - 工具栏增加「书架」按钮，可随时切回书架视图
  - 未打开文件时默认显示书架视图
  - 书架视图：卡片网格，展示文件名、格式徽标、进度条、上次阅读时间、删除按钮
  - 点击卡片直接打开对应文件并切到阅读视图
  - 打开文件成功后自动调用 `add-to-bookshelf` 更新书架

## Impact
- **Affected specs**: ebook-reader（在阅读器基础上新增书架能力）
- **Affected code**:
  - `electron/main/module/ebook.ts`（新增 3 个 IPC + 建表）
  - `electron/preload/index.ts`（暴露 3 个新方法）
  - `src/vite-env.d.ts`（补充 ebook 命名空间类型声明）
  - `src/store/useEbookReader.ts`（新增 bookshelf 状态与 actions）
  - `src/views/ebookReader/index.vue`（新增书架视图与切换逻辑）

## ADDED Requirements

### Requirement: 书架数据持久化
系统 SHALL 在用户每次成功打开电子书文件时，将该文件的路径、文件名、格式、当前进度与时间信息持久化到 `ebook_bookshelf` 表，并在书架列表中展示。

#### Scenario: 打开文件时记录到书架
- **WHEN** 用户通过文件对话框成功打开一个 txt 或 epub 文件
- **THEN** 系统调用 `ebook:add-to-bookshelf`，以 file_path 为主键 upsert 一条记录
- **AND** 记录包含 name、format、percent（取当前进度，无则为 0）、last_read_at（当前时间）、added_at（首次添加时写入，更新时不改）
- **AND** 同一文件重复打开时仅更新 last_read_at 与 percent，不产生重复记录

#### Scenario: 进度变化时同步书架
- **WHEN** 阅读过程中进度更新（触发 save-progress）
- **THEN** 系统同步更新 `ebook_bookshelf` 表中对应记录的 percent 与 last_read_at
- **AND** 书架列表下次刷新时显示最新进度

### Requirement: 书架列表展示
系统 SHALL 提供书架视图，以卡片网格形式展示所有已打开过的电子书，按最近阅读时间倒序排列。

#### Scenario: 展示书架列表
- **WHEN** 用户进入书架视图（未打开文件时默认进入，或点击工具栏「书架」按钮）
- **THEN** 系统调用 `ebook:get-bookshelf` 获取列表
- **AND** 以卡片网格展示，每张卡片包含：文件名、格式徽标（txt/epub）、进度条（percent）、上次阅读时间
- **AND** 列表按 last_read_at 降序排列（最近阅读的排最前）

#### Scenario: 空书架
- **WHEN** 书架无任何记录
- **THEN** 显示 `el-empty` 提示「书架空空如也，打开一本电子书吧」并附带「打开文件」按钮

#### Scenario: 文件已被移动或删除
- **WHEN** 书架中某文件在磁盘上已不存在，用户点击该卡片
- **THEN** 系统提示「文件不存在，可能已被移动或删除」
- **AND** 可选择从书架中移除该记录

### Requirement: 从书架快速打开
系统 SHALL 支持用户点击书架卡片快速打开对应电子书，并恢复到上次阅读位置。

#### Scenario: 点击卡片打开
- **WHEN** 用户点击书架中某张卡片且文件存在
- **THEN** 系统加载该文件，切换到阅读视图
- **AND** 阅读组件读取 ebook:get-progress 恢复到上次位置（已有能力，复用）

### Requirement: 从书架移除
系统 SHALL 支持用户从书架中移除某条记录，且不影响磁盘上的原文件。

#### Scenario: 移除书架记录
- **WHEN** 用户点击卡片上的「删除」按钮并确认
- **THEN** 系统调用 `ebook:remove-from-bookshelf`，按 file_path 删除该条书架记录
- **AND** 该记录从书架列表中消失
- **AND** 不删除磁盘原文件，也不删除 ebook_progress 中的进度记录（仅移除书架入口）

### Requirement: 视图切换
系统 SHALL 支持在书架视图与阅读视图之间切换。

#### Scenario: 从阅读视图返回书架
- **WHEN** 用户在阅读视图中点击工具栏「书架」按钮
- **THEN** 系统切换到书架视图
- **AND** 不关闭当前文件，点击书架卡片或重新打开可继续阅读

#### Scenario: 默认视图
- **WHEN** 用户进入电子书阅读器页面且未打开任何文件
- **THEN** 默认显示书架视图
- **WHEN** 用户进入页面且 store 中有上次打开的文件
- **THEN** 仍默认显示书架视图（用户可点击卡片继续阅读）

## MODIFIED Requirements

### Requirement: 打开文件流程
`src/views/ebookReader/index.vue` 的 `openFile` 函数 SHALL 在成功打开文件后调用 `addToBookshelf`，并切换到阅读视图；同时支持从书架卡片触发的打开流程（复用同一加载逻辑）。
