# Tasks

## 阶段一：基础设施与依赖
- [x] Task 1: 安装依赖并搭建模块骨架
  - [x] SubTask 1.1: 使用 cnpm 安装 `epubjs`、`iconv-lite`、`chardet`，命令：`cnpm install epubjs iconv-lite chardet`（禁止使用 npm/yarn 安装）
  - [x] SubTask 1.2: 新建 `electron/main/module/ebook.ts`，导出空 `initEbook()` 函数
  - [x] SubTask 1.3: 在 `electron/main/index.ts` 中导入并调用 `initEbook()`
  - [x] SubTask 1.4: 在 `electron/preload/index.ts` 暴露 `ebook` API 命名空间（readTxt、getProgress、saveProgress 等空方法）

## 阶段二：主进程 IPC 实现
- [x] Task 2: 实现 TXT 读取与编码检测 IPC
  - [x] SubTask 2.1: 在 `ebook.ts` 实现 `ebook:read-txt` handler，使用 `fs` 读取文件
  - [x] SubTask 2.2: 集成 `chardet` 检测编码，`iconv-lite` 转换为 UTF-8 字符串
  - [x] SubTask 2.3: 返回 { content, encoding, size }，异常时返回 { error }
- [x] Task 3: 实现阅读进度持久化 IPC（sqlite）
  - [x] SubTask 3.1: 在 `ebook.ts` 中创建 `ebook_progress` 表（file_path 主键、format、cfi、percent、updated_at）
  - [x] SubTask 3.2: 实现 `ebook:get-progress`（按 file_path 查询）
  - [x] SubTask 3.3: 实现 `ebook:save-progress`（upsert 一条进度记录）

## 阶段三：渲染进程状态与路由
- [x] Task 4: 创建 Pinia store 与路由
  - [x] SubTask 4.1: 新建 `src/store/useEbookReader.ts`，管理 { currentFile, format, progress, settings:{fontSize, theme} }
  - [x] SubTask 4.2: 在 `src/router/index.ts` 的 `RouteNames` 增加 `EBOOK_READER`，并在 `layoutRouters` 增加 `/ebookReader` 路由
- [x] Task 5: 实现主入口视图 `src/views/ebookReader/index.vue`
  - [x] SubTask 5.1: 顶部工具栏：打开文件按钮、文件名、格式徽标、主题切换、字体大小、目录按钮
  - [x] SubTask 5.2: 调用 `dialog.getFilePath` 选择文件，按后缀决定加载哪个子组件
  - [x] SubTask 5.3: 使用动态组件 `<component :is="readerComponent">` 切换 TxtReader/EpubReader
  - [x] SubTask 5.4: 不支持的格式（含 mobi 等）显示 `el-empty` 提示「当前支持 txt、epub」

## 阶段四：阅读组件实现
- [x] Task 6: 实现 `TxtReader.vue`
  - [x] SubTask 6.1: 调用 `ipcRenderer.ebook.readTxt(filePath)` 获取内容
  - [x] SubTask 6.2: 按字符数分页，提供上一页/下一页、跳转进度
  - [x] SubTask 6.3: 翻页时通过 `ebook:save-progress` 持久化字符位置
  - [x] SubTask 6.4: 应用 fontSize、theme 设置
- [x] Task 7: 实现 `EpubReader.vue`（基于 epubjs）
  - [x] SubTask 7.1: 用 `ePub(ArrayBuffer)` 加载，`book.renderTo(ref)` 渲染
  - [x] SubTask 7.2: 实现 `rendition.next()` / `prev()` 翻页，键盘左右键支持
  - [x] SubTask 7.3: 加载 `book.navigation` 渲染目录抽屉
  - [x] SubTask 7.4: 监听 `relocated` 事件获取 cfi，调用 `ebook:save-progress` 持久化
  - [x] SubTask 7.5: 打开时查询 `ebook:get-progress`，若有 cfi 则 `rendition.display(cfi)` 恢复
  - [x] SubTask 7.6: 应用主题（通过 `rendition.themes.register/select`）与字体大小

## 阶段五：验证
- [ ] Task 8: 类型检查与运行验证
  - [x] SubTask 8.1: 运行 `vue-tsc --noEmit` 确保无 TypeScript 类型错误
  - [ ] SubTask 8.2: 启动 `npm run dev`，手动验证 txt/epub 两种格式打开流程
  - [ ] SubTask 8.3: 验证进度持久化（关闭重开同一文件可恢复位置）
  - [ ] SubTask 8.4: 验证打开不支持的格式（如 mobi）时显示正确提示

## 阶段六：验证修复
- [ ] Task 9: 修复验证发现的问题
  - [x] SubTask 9.1: 修复「不支持格式提示」未使用 el-empty 的问题
    - 现状：`src/views/ebookReader/index.vue` 的 `openFile()` 中，遇到不支持格式（如 mobi）时使用 `ElMessage.warning('暂不支持该格式（当前支持 txt、epub）')` 弹出消息提示，未在阅读内容区显示 `el-empty` 组件
    - 期望：在阅读内容区使用 `el-empty` 组件显示「当前支持 txt、epub」提示，且不报错
    - 修复建议：可新增 `unsupportedFormat` 状态，打开不支持格式时设置该状态并渲染 `el-empty`，同时保留 ElMessage 提示或替换为 el-empty 内的按钮引导
    - 修复结果：已新增 `unsupportedTip` 响应式状态，内容区按优先级三分支显示（不支持格式 el-empty / 阅读组件 / 引导 el-empty），vue-tsc 通过
  - [ ] SubTask 9.2: 运行时验证（沙箱环境无法执行，需用户在本地完成）
    - 启动 `npm run dev` 验证无控制台报错
    - 手动验证 txt/epub 两种格式打开与阅读流程
    - 验证关闭重开同一文件，阅读进度可恢复
    - 验证打开不支持的格式（如 mobi）时显示正确提示

# Task Dependencies
- Task 2、3 依赖 Task 1
- Task 4 依赖 Task 1
- Task 5 依赖 Task 4
- Task 6、7 依赖 Task 5 与对应主进程 IPC（Task 2/3）
- Task 8 依赖所有前置任务
- Task 9 依赖 Task 8 验证结果
