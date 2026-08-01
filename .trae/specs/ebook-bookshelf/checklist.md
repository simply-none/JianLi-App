# Checklist

## 主进程 IPC 与数据库
- [x] `ebook_bookshelf` 表已创建（file_path PK、name、format、percent REAL、last_read_at、added_at）
- [x] `ebook:get-bookshelf` 能按 last_read_at 降序返回全部记录
- [x] `ebook:add-to-bookshelf` 能 upsert 记录（added_at 首次写入后不被覆盖）
- [x] `ebook:remove-from-bookshelf` 能按 file_path 删除记录
- [x] 所有 IPC 异常捕获，返回结构化 `{ success, error }`，不抛出未捕获异常

## preload 与类型
- [x] `electron/preload/index.ts` 的 `ebook` 命名空间已暴露 getBookshelf/addToBookshelf/removeFromBookshelf 三个方法
- [x] 三个方法均有完整中文 JSDoc（用途、参数、返回值、异常）
- [x] `src/vite-env.d.ts` 已补充三个方法的类型签名与 BookshelfRecord 类型

## store
- [x] `src/store/useEbookReader.ts` 已新增 bookshelf 状态与 BookshelfItem 接口
- [x] `loadBookshelf` 能从数据库加载并填充 bookshelf
- [x] `addToBookshelf` 能写入数据库并刷新 bookshelf
- [x] `removeFromBookshelf` 能删除数据库记录并同步移除 bookshelf 项

## 主入口视图
- [x] 新增 `view` 视图状态，默认书架视图
- [x] 工具栏「书架」按钮可切换到书架视图
- [x] 打开文件成功后自动 addToBookshelf 并切到阅读视图
- [x] 进度更新时同步刷新书架 percent
- [x] 书架卡片展示文件名、格式徽标、进度条、上次阅读时间
- [x] 空书架显示 el-empty 引导并附带「打开文件」按钮
- [x] 点击卡片可快速打开对应文件
- [x] 文件不存在时提示并支持从书架移除
- [x] 删除按钮有二次确认，删除后列表同步更新

## 代码规范
- [x] 所有新增函数、参数（含可选/默认值）、返回值、异常均有中文注释
- [x] 新增代码符合工作区既有代码风格与目录约定
- [x] 复用的图标已在 LucideIcon 组件 nameMap 中（如 Library）

## 验证
- [x] `npx vue-tsc --noEmit` 通过，无 TypeScript 类型错误
- [ ] `npm run dev` 启动正常，无控制台报错
- [ ] 手动验证打开 txt/epub 后书架出现记录
- [ ] 手动验证点击卡片快速打开并恢复进度
- [ ] 手动验证删除按钮移除记录
- [ ] 手动验证进度更新后书架进度条同步
