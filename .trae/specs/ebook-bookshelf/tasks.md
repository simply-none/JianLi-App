# Tasks

## 阶段一：主进程 IPC 与数据库
- [x] Task 1: 实现 `ebook_bookshelf` 表与书架 IPC
  - [x] SubTask 1.1: 在 `electron/main/module/ebook.ts` 新增 `createBookshelfTable()`，建表 `ebook_bookshelf`（file_path TEXT PRIMARY KEY、name TEXT、format TEXT、percent REAL、last_read_at TEXT、added_at TEXT），在 `initEbook()` 中调用
  - [x] SubTask 1.2: 实现 `ebook:get-bookshelf` handler，按 last_read_at 降序查询全部记录，返回 `{ success, data: BookshelfRecord[] }`
  - [x] SubTask 1.3: 实现 `ebook:add-to-bookshelf` handler，入参 `{ filePath, name, format, percent }`，INSERT OR REPLACE（added_at 仅首次写入：用 `COALESCE((SELECT added_at FROM ... WHERE file_path=?), ?)` 保留原值），同步更新 last_read_at 与 percent
  - [x] SubTask 1.4: 实现 `ebook:remove-from-bookshelf` handler，入参 filePath，DELETE WHERE file_path=?，返回 `{ success }`

## 阶段二：preload 与类型声明
- [x] Task 2: 暴露书架 API 与类型
  - [x] SubTask 2.1: 在 `electron/preload/index.ts` 的 `ebook` 命名空间新增 `getBookshelf()` / `addToBookshelf(data)` / `removeFromBookshelf(filePath)` 三个方法，均通过 `ipcRenderer.invoke` 调用对应 channel，含完整中文 JSDoc
  - [x] SubTask 2.2: 在 `src/vite-env.d.ts` 的 `Window.ipcRenderer.ebook` 类型声明中补充上述三个方法的类型签名与 `BookshelfRecord` 类型

## 阶段三：store 扩展
- [x] Task 3: 在 store 中增加 bookshelf 状态与 actions
  - [x] SubTask 3.1: 在 `src/store/useEbookReader.ts` 新增 `bookshelf` ref（`BookshelfItem[]`）与 `BookshelfItem` 接口（path、name、format、percent、lastReadAt、addedAt）
  - [x] SubTask 3.2: 实现 `loadBookshelf()` action：调用 `ipcRenderer.ebook.getBookshelf()` 填充 bookshelf
  - [x] SubTask 3.3: 实现 `addToBookshelf(item)` action：调用 `ipcRenderer.ebook.addToBookshelf` 后刷新 bookshelf
  - [x] SubTask 3.4: 实现 `removeFromBookshelf(filePath)` action：调用 `ipcRenderer.ebook.removeFromBookshelf` 后从 bookshelf 中移除该项

## 阶段四：主入口视图集成
- [x] Task 4: 在 `src/views/ebookReader/index.vue` 新增书架视图与切换逻辑
  - [x] SubTask 4.1: 新增 `view` ref（`'bookshelf' | 'reader'`），默认 `'bookshelf'`；onMounted 时调用 `loadBookshelf()`
  - [x] SubTask 4.2: 工具栏左侧新增「书架」按钮（Library 图标），点击切换到书架视图
  - [x] SubTask 4.3: 抽取 `loadFile(filePath, name, format)` 公共方法（供 openFile 与书架卡片点击复用），成功后调用 `addToBookshelf` 并切换 `view='reader'`
  - [x] SubTask 4.4: 修改 `openFile`，文件选择成功后调用 `loadFile`；并在进度更新时同步调用 `addToBookshelf`（传入最新 percent）以刷新书架进度
  - [x] SubTask 4.5: 新增书架视图模板：卡片网格（el-row/el-col 或 flex wrap），每张卡片含文件名、格式徽标、进度条（el-progress）、上次阅读时间、删除按钮；空书架显示 el-empty 引导
  - [x] SubTask 4.6: 卡片点击调用 `loadFile`；若文件不存在（用 fs 检查或捕获读取错误）提示「文件不存在」并询问是否从书架移除
  - [x] SubTask 4.7: 删除按钮弹出 `ElMessageBox.confirm` 确认后调用 `removeFromBookshelf`

## 阶段五：验证
- [x] Task 5: 类型检查与验证
  - [x] SubTask 5.1: 运行 `npx vue-tsc --noEmit` 确保无类型错误
  - [ ] SubTask 5.2: 启动 `npm run dev`，验证打开 txt/epub 后书架出现记录、点击卡片可快速打开、删除按钮可移除记录（需用户本地运行应用验证）
  - [ ] SubTask 5.3: 验证进度更新后书架卡片进度条同步刷新（需用户本地运行应用验证）

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 4
