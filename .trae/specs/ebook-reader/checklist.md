# Checklist

## 依赖与基础设施
- [x] `package.json` 已新增 `epubjs`、`iconv-lite`、`chardet` 依赖，且通过 **cnpm** 安装成功（执行命令 `cnpm install epubjs iconv-lite chardet`，禁止使用 npm/yarn）
- [x] `electron/main/module/ebook.ts` 文件已创建并导出 `initEbook()` 函数
- [x] `electron/main/index.ts` 已调用 `initEbook()` 完成模块注册
- [x] `electron/preload/index.ts` 已通过 contextBridge 暴露 `ebook` 命名空间 API

## TXT 读取
- [x] `ebook:read-txt` IPC 能读取 txt 文件并通过 chardet/iconv-lite 正确转码
- [x] GBK、UTF-8、UTF-16 编码的 txt 文件均能正确显示中文，无乱码
- [x] 读取异常时返回结构化错误对象，不抛出未捕获异常

## 进度持久化
- [x] `ebook_progress` 表能正确创建（含 file_path、format、cfi、percent、updated_at 字段）
- [x] `ebook:save-progress` 能 upsert 进度记录（同 file_path 仅保留最新一条）
- [x] `ebook:get-progress` 能按 file_path 查询并返回进度

## 路由与状态
- [x] `RouteNames` 已新增 `EBOOK_READER`，`/ebookReader` 路由可正常访问
- [x] `src/store/useEbookReader.ts` 能正确管理当前文件、格式、进度、设置状态

## 阅读组件
- [x] `index.vue` 能根据文件后缀动态切换 TxtReader/EpubReader
- [x] `TxtReader.vue` 能分页展示文本，翻页时保存进度，恢复时跳转到上次位置
- [x] `EpubReader.vue` 能用 epubjs 渲染，支持翻页、目录、字体大小、主题切换
- [x] `EpubReader.vue` 能通过 cfi 持久化并恢复阅读位置
- [x] 不支持的文件格式（含 mobi 等）显示 `el-empty` 提示「当前支持 txt、epub」，不报错

## 代码规范
- [x] 所有新增函数、类、模块均含中文注释
- [x] 所有参数（含可选/默认值）均有中文注释
- [x] 所有返回值（成功/失败）均有中文注释
- [x] 所有异常（类型、信息）均有中文注释
- [x] 新增代码符合工作区既有的代码风格与目录约定

## 验证
- [x] `vue-tsc --noEmit` 通过，无 TypeScript 类型错误
- [ ] `npm run dev` 启动正常，无控制台报错
- [ ] 手动验证 txt/epub 两种格式打开与阅读流程
- [ ] 验证关闭重开同一文件，阅读进度可恢复
- [ ] 验证打开不支持的格式（如 mobi）时显示正确提示
